import { BloggerIdentityScope, JsonLdContext, ResolvedEntityReference } from "../types/schema";

export interface JsonLdResolverOptions {
  /**
   * Custom base IRI builder. Default uses Blogger standard canonical pattern:
   * Homepage: https://www.blogger.com/b/{blogId}
   * Post:     https://www.blogger.com/b/{blogId}/p/{postId}
   */
  baseIriBuilder?: (scope: BloggerIdentityScope) => string;
}

export class JsonLdResolver {
  private baseIriBuilder: (scope: BloggerIdentityScope) => string;

  constructor(options?: JsonLdResolverOptions) {
    this.baseIriBuilder = options?.baseIriBuilder || JsonLdResolver.defaultBaseIriBuilder;
  }

  public static defaultBaseIriBuilder(scope: BloggerIdentityScope): string {
    if (scope.canonicalBase) {
      return scope.canonicalBase.endsWith('/') ? scope.canonicalBase.slice(0, -1) : scope.canonicalBase;
    }
    const cleanBlog = (scope.blogId || '').replace(/^https?:\/\/[^/]+\//, '').replace(/^\/+/, '');
    if (scope.postId) {
      const cleanPost = String(scope.postId).replace(/^\/+/, '');
      return `https://www.blogger.com/b/${cleanBlog}/p/${cleanPost}`;
    }
    return `https://www.blogger.com/b/${cleanBlog}`;
  }

  /**
   * Extracts @base IRI directly from a JSON-LD @context map object
   */
  public extractBaseFromContext(context: JsonLdContext): string | null {
    if (!context) return null;

    if (typeof context === 'object' && context !== null && !Array.isArray(context)) {
      if ('@base' in context && typeof (context as any)['@base'] === 'string') {
        return (context as any)['@base'];
      }
    }

    if (Array.isArray(context)) {
      for (const item of context) {
        if (typeof item === 'object' && item !== null && '@base' in item && typeof item['@base'] === 'string') {
          return item['@base'];
        }
      }
    }

    return null;
  }

  /**
   * Builds context map object registering @vocab, schema prefix, and @base directly
   */
  public createDocumentContext(scope: BloggerIdentityScope): Record<string, string> {
    const baseIri = this.baseIriBuilder(scope);
    return {
      "@vocab": "http://schema.org/",
      "schema": "http://schema.org/",
      "@base": baseIri
    };
  }

  /**
   * Parses logical or relative entity ID and returns structured reference details
   */
  public resolveEntityReference(rawId: string, currentScope?: BloggerIdentityScope, documentBase?: string): ResolvedEntityReference {
    if (!rawId) {
      return {
        rawId: "",
        canonicalIri: "",
        isLocal: true
      };
    }

    const effectiveBase = documentBase || (currentScope ? this.baseIriBuilder(currentScope) : "");

    // Case 1: Pure local fragment (e.g. "#organization" or "#post")
    if (rawId.startsWith("#")) {
      const canonicalIri = effectiveBase ? `${effectiveBase}${rawId}` : rawId;
      return {
        rawId,
        canonicalIri,
        isLocal: true,
        blogId: currentScope?.blogId,
        postId: currentScope?.postId,
        fragment: rawId.substring(1)
      };
    }

    // Case 2: Cross-document logical expression: "blogId/postId#fragment" or "blogId#fragment" or "blogId/postId"
    const hashIndex = rawId.indexOf("#");
    const pathPart = hashIndex !== -1 ? rawId.substring(0, hashIndex) : rawId;
    const fragmentPart = hashIndex !== -1 ? rawId.substring(hashIndex + 1) : "";

    // Check if pathPart matches BlogId/PostId or BlogId pattern or full URL
    if (pathPart.includes("http://") || pathPart.includes("https://")) {
      const canonicalIri = rawId;
      const parsedUrl = new URL(pathPart);
      const isSameAsCurrentBase = effectiveBase && canonicalIri.startsWith(effectiveBase);
      return {
        rawId,
        canonicalIri,
        isLocal: Boolean(isSameAsCurrentBase),
        fragment: fragmentPart || undefined
      };
    }

    // Logical expression matching Blogger BlogId or BlogId/PostId
    const parts = pathPart.split("/").filter(Boolean);
    if (parts.length === 1 || parts.length === 2) {
      const blogId = parts[0];
      const postId = parts.length === 2 ? parts[1] : undefined;

      const targetScope: BloggerIdentityScope = { blogId, postId };
      const targetBase = this.baseIriBuilder(targetScope);
      const canonicalIri = fragmentPart ? `${targetBase}#${fragmentPart}` : targetBase;

      const isSameAsCurrent = currentScope && currentScope.blogId === blogId && currentScope.postId === postId;

      return {
        rawId,
        canonicalIri,
        isLocal: Boolean(isSameAsCurrent),
        blogId,
        postId,
        fragment: fragmentPart || undefined
      };
    }

    // Default fallback resolution using relative URL resolution rules
    let canonicalIri = rawId;
    try {
      if (effectiveBase) {
        canonicalIri = new URL(rawId, effectiveBase).toString();
      }
    } catch (e) {
      canonicalIri = rawId;
    }

    return {
      rawId,
      canonicalIri,
      isLocal: false,
      fragment: fragmentPart || undefined
    };
  }
}
