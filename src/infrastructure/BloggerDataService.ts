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
        const { entries } = await this.fetchFeedData(50, 1, '', query);
        const suggestions = new Set<string>();
        const normalizedQuery = query.toLowerCase();

        entries.forEach(entry => {
            const title = entry.title?.$t || "";
            if (title.toLowerCase().includes(normalizedQuery)) {
                suggestions.add(title);
            }

            const data = this.extractSchemaFromEntry(entry);
            if (data) {
                const keywords = SchemaExtractor.getFirst(data.keywords);
                if (keywords && typeof keywords === 'string') {
                    keywords.split(',').forEach(k => {
                        const trimmed = k.trim();
                        if (trimmed.toLowerCase().includes(normalizedQuery)) {
                            suggestions.add(trimmed);
                        }
                    });
                }
                const name = SchemaExtractor.getFirst(data.name);
                if (name && typeof name === 'string' && name.toLowerCase().includes(normalizedQuery)) {
                    suggestions.add(name);
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
