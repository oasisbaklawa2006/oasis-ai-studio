import type { ProductLanguageTermType } from "@/features/productLanguage/terms";

export type LanguageTermRecord = {
  id: string;
  alias_text: string;
  term_type: ProductLanguageTermType;
  term_type_source: "ui_metadata" | "inferred";
  product_id: string | null;
  canonical_name: string | null;
};

export type LanguageTermCounts = Record<ProductLanguageTermType, number> & {
  total_aliases: number;
};

export type ProductLanguageReadinessResult = {
  score: number;
  maxScore: number;
  percent: number;
  readyForDiscoverability: boolean;
  dimensions: {
    key: string;
    label: string;
    complete: boolean;
    count: number;
    note?: string;
  }[];
  gaps: string[];
  nextAction: string;
};

export type SnapshotLanguageIntelligence = {
  /** True when product_language_terms table is deployed and populated. */
  schema_available: false;
  official_name: string;
  language_readiness: ProductLanguageReadinessResult;
  term_counts: LanguageTermCounts;
  terms_preview: Array<{
    alias_text: string;
    term_type: ProductLanguageTermType;
    term_type_source: "ui_metadata" | "inferred";
  }>;
  discoverability_gaps: string[];
  search_consumption: {
    matches_name: true;
    matches_sku: true;
    matches_alias_text: true;
    matches_canonical_name: true;
    matches_typed_terms: false;
  };
  note: string;
};

export type Batch001SkuAssessment = {
  sku: string;
  official_name: string;
  authority_aliases_expected: number;
  authority_whatsapp_expected: number;
  central_status: "not_assessed" | "sku_missing" | "no_language_terms" | "partial" | "authority_ready";
  language_gaps: string[];
  search_gaps: string[];
  discoverability_gaps: string[];
};
