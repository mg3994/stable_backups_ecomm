import { SchemaExtractor } from '../core/SchemaExtractor';

export class BloggerDataService {
  async fetchFeedData(maxResults: number = 50, startIndex: number = 1, labels: string | string[] = '', searchQuery: string = ''): Promise<{ entries: any[], totalResults: number }> {
    let labelPath = '';

    if (labels) {
        const labelsArray = Array.isArray(labels) ? labels : [labels];
        const filteredLabels = labelsArray.filter(l => l.trim() !== '');
        if (filteredLabels.length > 0) {
            const encodedLabels = filteredLabels.map(l => encodeURIComponent(l.trim())).join(',');
            labelPath = `/-/${encodedLabels}`;
        }
    }

    let feedUrl = `/feeds/posts/default${labelPath}?alt=json&max-results=${maxResults}&start-index=${startIndex}`;

    if (searchQuery) {
        feedUrl += `&q=${encodeURIComponent(searchQuery)}`;
    }

    try {
      const res = await fetch(feedUrl);
      const data = await res.json();
      return {
        entries: data.feed.entry || [],
        totalResults: parseInt(data.feed.openSearch$totalResults?.$t || "0")
      };
    } catch (e) {
      console.error("Failed to fetch Blogger feed", e);
      return { entries: [], totalResults: 0 };
    }
  }

  extractSchemaFromEntry(entry: any): any | null {
    const content = entry.content?.$t || "";
    return SchemaExtractor.extractJsonLd(content);
  }

  async fetchSearchSuggestions(query: string): Promise<string[]> {
    if (!query || query.length < 2) return [];

    try {
        const labelRegex = /label:([^|\s]+)/g;
        const labels: string[] = [];
        let match;
        let cleanedQuery = query;
        let labelPrefix = "";

        while ((match = labelRegex.exec(query)) !== null) {
            labels.push(decodeURIComponent(match[1].replace(/_/g, ' ')));
            labelPrefix += match[0] + " ";
        }
        cleanedQuery = query.replace(labelRegex, '').trim();

        // If we have labels but no keyword yet, we should suggest within those labels
        const { entries } = await this.fetchFeedData(50, 1, labels, cleanedQuery);
        const suggestions = new Set<string>();
        const normalizedKeyword = cleanedQuery.toLowerCase();

        entries.forEach(entry => {
            const title = entry.title?.$t || "";
            // If keyword is empty, suggest everything in the label.
            // If not empty, only suggest matches.
            if (!normalizedKeyword || title.toLowerCase().includes(normalizedKeyword)) {
                suggestions.add(labelPrefix + title);
            }

            const data = this.extractSchemaFromEntry(entry);
            if (data) {
                const keywords = SchemaExtractor.getFirst(data.keywords);
                if (keywords && typeof keywords === 'string') {
                    keywords.split(',').forEach(k => {
                        const trimmed = k.trim();
                        if (!normalizedKeyword || trimmed.toLowerCase().includes(normalizedKeyword)) {
                            suggestions.add(labelPrefix + trimmed);
                        }
                    });
                }
                const name = SchemaExtractor.getFirst(data.name);
                if (name && typeof name === 'string' && (!normalizedKeyword || name.toLowerCase().includes(normalizedKeyword))) {
                    suggestions.add(labelPrefix + name);
                }
            }
        });

        return Array.from(suggestions).slice(0, 10);
    } catch (e) {
        console.error("Failed to fetch suggestions", e);
        return [];
    }
  }
}
