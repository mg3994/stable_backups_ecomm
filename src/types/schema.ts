export * from "@antinna/schema-ld-types";

/**
 * JSON-LD 1.1 Value Object supporting @value, @language, @direction, and @type
 */
export interface JsonLdValueObject<T = string> {
  "@value": T;
  "@language"?: string;
  "@direction"?: "ltr" | "rtl";
  "@type"?: string;
  "@index"?: string;
}

/**
 * JSON-LD 1.1 Language Map
 * Map of language tags (BCP47, e.g., 'en', 'fr', 'hi-Deva') to strings or string arrays.
 */
export type JsonLdLanguageMap = Record<string, string | string[]>;

/**
 * Flexible property value accepting raw primitive, JSON-LD Value Object, or Language Map
 */
export type JsonLdValue<T = string> = T | JsonLdValueObject<T> | JsonLdLanguageMap;

/**
 * JSON-LD 1.1 Context definition structure
 */
export type JsonLdContextDefinition = string | Record<string, any>;
export type JsonLdContext = JsonLdContextDefinition | JsonLdContextDefinition[];

/**
 * Identity scope for Blogger entities
 */
export interface BloggerIdentityScope {
  blogId: string;
  postId?: string;
  canonicalBase?: string;
}

/**
 * Parsed entity reference with canonical IRI, scope, and locality indicator
 */
export interface ResolvedEntityReference {
  rawId: string;
  canonicalIri: string;
  isLocal: boolean;
  blogId?: string;
  postId?: string;
  fragment?: string;
}

// Maintain backward compatibility for ItemAvailability
export type ItemAvailabilityString =
  | "https://schema.org/InStock"
  | "https://schema.org/OutOfStock"
  | "https://schema.org/OnlineOnly"
  | "https://schema.org/InStoreOnly"
  | "https://schema.org/PreOrder"
  | "https://schema.org/PreSale"
  | "https://schema.org/LimitedAvailability"
  | "https://schema.org/SoldOut"
  | "https://schema.org/Discontinued";
