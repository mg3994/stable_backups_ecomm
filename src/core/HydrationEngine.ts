import { BloggerIdentityScope, ResolvedEntityReference } from "../types/schema";
import { JsonLdResolver } from "./JsonLdResolver";
import { SchemaExtractor } from "./SchemaExtractor";

export type DocumentFetcher = (blogId: string, postId?: string) => Promise<any>;

export interface HydrationOptions {
  resolver?: JsonLdResolver;
  fetcher?: DocumentFetcher;
  maxDepth?: number;
}

export class HydrationEngine {
  private resolver: JsonLdResolver;
  private fetcher?: DocumentFetcher;
  private maxDepth: number;

  constructor(options?: HydrationOptions) {
    this.resolver = options?.resolver || new JsonLdResolver();
    this.fetcher = options?.fetcher;
    this.maxDepth = options?.maxDepth ?? 5;
  }

  /**
   * Recursively hydrates an entity or document graph by resolving local and cross-document @id references.
   */
  public async hydrateEntity(
    root: any,
    currentScope?: BloggerIdentityScope,
    visitedIris = new Set<string>(),
    currentDepth = 0
  ): Promise<any> {
    if (!root || typeof root !== "object" || currentDepth > this.maxDepth) {
      return root;
    }

    // Index all local graph entities in document if present
    const localMap = this.indexGraphEntities(root, currentScope);

    return await this.hydrateValue(root, currentScope, localMap, visitedIris, currentDepth);
  }

  private indexGraphEntities(doc: any, currentScope?: BloggerIdentityScope): Map<string, any> {
    const map = new Map<string, any>();
    if (!doc || typeof doc !== "object") return map;

    const items = doc["@graph"] ? SchemaExtractor.getArray(doc["@graph"]) : (Array.isArray(doc) ? doc : [doc]);

    for (const item of items) {
      if (item && typeof item === "object" && item["@id"]) {
        const ref = this.resolver.resolveEntityReference(item["@id"], currentScope);
        map.set(item["@id"], item);
        map.set(ref.canonicalIri, item);
        if (ref.fragment) {
          map.set(`#${ref.fragment}`, item);
        }
      }
    }

    return map;
  }

  private async hydrateValue(
    value: any,
    currentScope?: BloggerIdentityScope,
    localMap: Map<string, any> = new Map(),
    visitedIris = new Set<string>(),
    currentDepth = 0
  ): Promise<any> {
    if (!value || typeof value !== "object") {
      return value;
    }

    if (Array.isArray(value)) {
      return Promise.all(
        value.map(item => this.hydrateValue(item, currentScope, localMap, visitedIris, currentDepth))
      );
    }

    // Check if this object is a reference (only has @id or minimal reference)
    const keys = Object.keys(value).filter(k => k !== "@id");
    const isReference = value["@id"] && (keys.length === 0 || (keys.length === 1 && keys[0] === "@type"));

    if (isReference) {
      const ref: ResolvedEntityReference = this.resolver.resolveEntityReference(value["@id"], currentScope);

      if (visitedIris.has(ref.canonicalIri)) {
        return value; // Cycle detected, break infinite loop
      }

      // Check local map first
      let localMatch = localMap.get(value["@id"]) || localMap.get(ref.canonicalIri);
      if (!localMatch && ref.fragment) {
        localMatch = localMap.get(`#${ref.fragment}`);
      }

      if (localMatch && localMatch !== value) {
        const nextVisited = new Set(visitedIris).add(ref.canonicalIri);
        return await this.hydrateValue(localMatch, currentScope, localMap, nextVisited, currentDepth + 1);
      }

      // If reference requires cross-document resolution (has blogId or external URL)
      if (!ref.isLocal && (ref.blogId || ref.canonicalIri.startsWith("http")) && this.fetcher) {
        try {
          const targetBlogId = ref.blogId || ref.canonicalIri;
          const targetPostId = ref.postId;

          const externalDoc = await this.fetcher(targetBlogId, targetPostId);
          if (externalDoc) {
            const externalJsonLd = typeof externalDoc === "string"
              ? SchemaExtractor.extractJsonLd<any>(externalDoc)
              : externalDoc;

            if (externalJsonLd) {
              const targetScope: BloggerIdentityScope = {
                blogId: targetBlogId,
                postId: targetPostId
              };

              const externalMap = this.indexGraphEntities(externalJsonLd, targetScope);

              let fetchedEntity = externalMap.get(value["@id"]) || externalMap.get(ref.canonicalIri);
              if (!fetchedEntity && ref.fragment) {
                fetchedEntity = externalMap.get(`#${ref.fragment}`);
              }

              if (!fetchedEntity && externalJsonLd && !externalJsonLd["@graph"]) {
                fetchedEntity = externalJsonLd;
              }

              if (fetchedEntity) {
                const nextVisited = new Set(visitedIris).add(ref.canonicalIri);
                const hydrated = await this.hydrateValue(fetchedEntity, targetScope, externalMap, nextVisited, currentDepth + 1);
                return { ...value, ...hydrated };
              }
            }
          }
        } catch (e) {
          console.warn(`Failed to resolve cross-document reference ${value["@id"]}:`, e);
        }
      }
    }

    // Recursively hydrate properties of the object
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = await this.hydrateValue(v, currentScope, localMap, visitedIris, currentDepth);
    }

    return result;
  }
}
