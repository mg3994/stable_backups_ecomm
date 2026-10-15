import { describe, expect, it } from "vitest";
import { JsonLdResolver } from "./JsonLdResolver";

describe("JsonLdResolver", () => {
  const resolver = new JsonLdResolver();

  it("should extract @base from context array or object", () => {
    const contextArray = [
      "https://schema.org",
      { "@base": "https://www.blogger.com/b/blog-123/p/post-456" }
    ];
    expect(resolver.extractBaseFromContext(contextArray)).toBe("https://www.blogger.com/b/blog-123/p/post-456");

    const contextObject = { "@base": "https://www.blogger.com/b/blog-123" };
    expect(resolver.extractBaseFromContext(contextObject)).toBe("https://www.blogger.com/b/blog-123");
  });

  it("should resolve local fragment IDs correctly against document scope", () => {
    const scope = { blogId: "blog-123", postId: "post-456" };
    const ref = resolver.resolveEntityReference("#author", scope);

    expect(ref.isLocal).toBe(true);
    expect(ref.fragment).toBe("author");
    expect(ref.canonicalIri).toBe("https://www.blogger.com/b/blog-123/p/post-456#author");
  });

  it("should resolve cross-post reference within same blog", () => {
    const scope = { blogId: "blog-123", postId: "post-456" };
    const ref = resolver.resolveEntityReference("blog-123/post-789#product", scope);

    expect(ref.isLocal).toBe(false);
    expect(ref.blogId).toBe("blog-123");
    expect(ref.postId).toBe("post-789");
    expect(ref.fragment).toBe("product");
    expect(ref.canonicalIri).toBe("https://www.blogger.com/b/blog-123/p/post-789#product");
  });

  it("should resolve cross-blog reference", () => {
    const scope = { blogId: "blog-123", postId: "post-456" };
    const ref = resolver.resolveEntityReference("other-blog-999#organization", scope);

    expect(ref.isLocal).toBe(false);
    expect(ref.blogId).toBe("other-blog-999");
    expect(ref.postId).toBeUndefined();
    expect(ref.fragment).toBe("organization");
    expect(ref.canonicalIri).toBe("https://www.blogger.com/b/other-blog-999#organization");
  });

  it("should generate dual JSON-LD 1.1 context array with dynamic @base", () => {
    const context = resolver.createDocumentContext({ blogId: "blog-123", postId: "post-456" });
    expect(context).toEqual([
      "https://schema.org",
      { "@base": "https://www.blogger.com/b/blog-123/p/post-456" }
    ]);
  });
});
