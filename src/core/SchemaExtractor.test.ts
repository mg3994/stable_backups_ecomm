import { describe, expect, it } from 'vitest';
import { SchemaExtractor } from '../core/SchemaExtractor';

describe('SchemaExtractor', () => {
  it('should extract JSON-LD from script tag', () => {
    const html = '<script type="application/ld+json">{"@type": "Product", "name": "Test"}</script>';
    const result = SchemaExtractor.extractJsonLd<any>(html);
    expect(result?.name).toBe('Test');
  });

  it('should extract raw JSON-LD', () => {
    const raw = '{"@type": "Service", "name": "Clean"}';
    const result = SchemaExtractor.extractJsonLd<any>(raw);
    expect(result?.name).toBe('Clean');
  });

  it('should decode HTML entities', () => {
    const raw = '{"name": "Price &amp; Quality"}';
    const result = SchemaExtractor.extractJsonLd<any>(raw);
    expect(result?.name).toBe('Price & Quality');
  });

  describe('Value Metadata & Language Maps', () => {
    it('should extract JSON-LD Value Object metadata with schema: type prefix', () => {
      const valObj = { "@value": "Apple", "@language": "en", "@direction": "ltr", "@type": "schema:Text" };
      const extracted = SchemaExtractor.extractValueObject(valObj);

      expect(extracted).toEqual({
        "@value": "Apple",
        "@language": "en",
        "@direction": "ltr",
        "@type": "schema:Text",
        "@index": undefined
      });
    });

    it('should resolve localized values based on preferred language', () => {
      const langMap = { "en": "Product", "fr": "Produit", "hi": "उत्पाद" };
      expect(SchemaExtractor.getLocalizedValue(langMap, "fr")).toBe("Produit");
      expect(SchemaExtractor.getLocalizedValue(langMap, "hi")).toBe("उत्पाद");
      expect(SchemaExtractor.getLocalizedValue(langMap, "es", "en")).toBe("Product");

      const valObjects = [
        { "@value": "Hello", "@language": "en" },
        { "@value": "Bonjour", "@language": "fr" }
      ];
      expect(SchemaExtractor.getLocalizedValue(valObjects, "fr")).toBe("Bonjour");
      expect(SchemaExtractor.getLocalizedValue(valObjects, "en")).toBe("Hello");
    });

    it('should extract LanguageMap from value array', () => {
      const valObjects = [
        { "@value": "Book", "@language": "en" },
        { "@value": "Livre", "@language": "fr" }
      ];
      const langMap = SchemaExtractor.extractLanguageMap(valObjects);
      expect(langMap).toEqual({
        "en": "Book",
        "fr": "Livre"
      });
    });
  });

  describe('Entity Lookup and Hydration', () => {
    it('should extract entity by ID from @graph', () => {
      const doc = {
        "@graph": [
          { "@type": "Product", "@id": "#prod1", "name": "Laptop" },
          { "@type": "Person", "@id": "#seller", "name": "Bob" }
        ]
      };

      const entity = SchemaExtractor.extractEntityById<any>(doc, "#seller", { blogId: "b1", postId: "p1" });
      expect(entity?.name).toBe("Bob");
    });

    it('should hydrate document graph using SchemaExtractor.hydrate', async () => {
      const doc = {
        "@context": { "@vocab": "http://schema.org/", "schema": "http://schema.org/", "@base": "https://www.blogger.com/b/b1/p/p1" },
        "@graph": [
          { "@type": "Offer", "@id": "#offer1", "itemOffered": { "@id": "#item1" } },
          { "@type": "IndividualProduct", "@id": "#item1", "name": "Handmade Craft" }
        ]
      };

      const hydrated = await SchemaExtractor.hydrate<any>(doc, { scope: { blogId: "b1", postId: "p1" } });
      const offer = hydrated["@graph"][0];

      expect(offer.itemOffered.name).toBe("Handmade Craft");
    });
  });

  describe('priceSpecification', () => {
    const offerWithSpecs = {
      "@type": "Offer",
      "priceSpecification": [
        {
          "@type": "UnitPriceSpecification",
          "price": "20.00",
          "priceCurrency": "INR",
          "eligibleQuantity": {
            "@type": "QuantitativeValue",
            "minValue": 1,
            "maxValue": 4,
            "unitCode": "C62"
          }
        },
        {
          "@type": "UnitPriceSpecification",
          "price": "15.00",
          "priceCurrency": "INR",
          "eligibleQuantity": {
            "@type": "QuantitativeValue",
            "minValue": 5,
            "unitCode": "C62"
          }
        }
      ]
    };

    it('should select correct price tier for small quantity', () => {
      const res = SchemaExtractor.extractPriceForQuantity(offerWithSpecs, 3);
      expect(res.price).toBe("20.00");
    });

    it('should select correct price tier for larger quantity', () => {
      const res = SchemaExtractor.extractPriceForQuantity(offerWithSpecs, 5);
      expect(res.price).toBe("15.00");
    });

    it('should fallback to standard price if no specs match', () => {
      const defaultOffer = {
        "@type": "Offer",
        "price": "25.00",
        "priceCurrency": "USD"
      };
      const res = SchemaExtractor.extractPriceForQuantity(defaultOffer, 10);
      expect(res.price).toBe("25.00");
      expect(res.currency).toBe("USD");
    });
  });
});
