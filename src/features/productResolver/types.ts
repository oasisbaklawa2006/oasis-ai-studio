export type ResolverCatalogProduct = {
  id: string;
  sku: string;
  name: string;
};

export type ResolverCatalogAlias = {
  alias_text: string;
  canonical_name: string;
  product_id: string;
};

export type ResolverCatalog = {
  products: ResolverCatalogProduct[];
  aliases: ResolverCatalogAlias[];
};

export type ResolverCandidate = {
  product_id: string;
  sku: string;
  product_name: string;
  matched_term: string;
  match_source: "sku" | "name" | "alias" | "canonical_name";
  confidence: number;
};

export type ProductResolverResult = {
  input: string;
  normalized_text: string;
  matched_sku: string | null;
  matched_product: string | null;
  matched_product_id: string | null;
  confidence: number;
  clarification_required: boolean;
  candidates: ResolverCandidate[];
};

export type ResolverConfig = {
  min_threshold: number;
  ambiguity_delta: number;
  max_candidates: number;
};

export const DEFAULT_RESOLVER_CONFIG: ResolverConfig = {
  min_threshold: 0.72,
  ambiguity_delta: 0.08,
  max_candidates: 3,
};
