import { describe, expect, it, vi } from "vitest";
import { HydrationEngine } from "./HydrationEngine";

describe("HydrationEngine", () => {
  it("should hydrate local references within @graph", async () => {
    const engine = new HydrationEngine();
    const doc = {
      "@context": ["https://schema.org", { "@base": "https://www.blogger.com/b/blog-123/p/post-456" }],
      "@graph": [
        {
          "@type": "BlogPosting",
          "@id": "#post",
          "headline": "My First Post",
          "author": { "@id": "#author" }
        },
        {
          "@type": "Person",
          "@id": "#author",
          "name": "Jane Doe"
        }
      ]
    };

    const hydrated = await engine.hydrateEntity(doc, { blogId: "blog-123", postId: "post-456" });
    const post = hydrated["@graph"][0];

    expect(post.author.name).toBe("Jane Doe");
    expect(post.author["@id"]).toBe("#author");
  });

  it("should recursively hydrate cross-blog references using fetcher", async () => {
    const mockFetcher = vi.fn(async (blogId: string, postId?: string) => {
      if (blogId === "other-blog" && postId === "other-post") {
        return {
          "@context": ["https://schema.org", { "@base": "https://www.blogger.com/b/other-blog/p/other-post" }],
          "@graph": [
            {
              "@type": "Organization",
              "@id": "#org",
              "name": "Global Corp",
              "founder": { "@id": "founder-blog#person" }
            }
          ]
        };
      }
      if (blogId === "founder-blog") {
        return {
          "@type": "Person",
          "@id": "#person",
          "name": "Alice Smith"
        };
      }
      return null;
    });

    const engine = new HydrationEngine({ fetcher: mockFetcher });

    const rootPost = {
      "@type": "Article",
      "@id": "#article",
      "publisher": { "@id": "other-blog/other-post#org" }
    };

    const hydrated = await engine.hydrateEntity(rootPost, { blogId: "my-blog", postId: "my-post" });

    expect(mockFetcher).toHaveBeenCalledTimes(2);
    expect(hydrated.publisher.name).toBe("Global Corp");
    expect(hydrated.publisher.founder.name).toBe("Alice Smith");
  });

  it("should handle cyclic references gracefully without infinite loop", async () => {
    const engine = new HydrationEngine();
    const doc = {
      "@graph": [
        {
          "@type": "Person",
          "@id": "#alice",
          "knows": { "@id": "#bob" }
        },
        {
          "@type": "Person",
          "@id": "#bob",
          "knows": { "@id": "#alice" }
        }
      ]
    };

    const hydrated = await engine.hydrateEntity(doc, { blogId: "b1", postId: "p1" });
    const alice = hydrated["@graph"][0];

    expect(alice.knows.name).toBeUndefined(); // Bob resolved
    expect(alice.knows["@id"]).toBe("#bob");
    expect(alice.knows.knows["@id"]).toBe("#alice"); // Cycle stopped
  });
});
