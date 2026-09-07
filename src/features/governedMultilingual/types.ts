import type { AuthoritativeProductFacts } from "@/features/governedProductNaming";

/** Locales with explicit governed support — all others fail closed. */
export const SUPPORTED_MULTILINGUAL_LOCALES = ["en", "hi", "ar", "tr"] as const;
export type MultilingualLocaleCode = (typeof SUPPORTED_MULTILINGUAL_LOCALES)[number];

export const MULTILINGUAL_LOCALE_SCRIPTS: Record<MultilingualLocaleCode, string> = {
  en: "latin",
  hi: "devanagari",
  ar: "arabic",
  tr: "latin",
};

export type MultilingualSuggestionKind =
  | "product_name_alias"
  | "selling_point"
  | "hindi_description"
  | "regional_term"
  | "search_keyword";

export type MultilingualAvailability = "available" | "pending" | "unsupported";

export type MultilingualReviewStatus = "pending_review" | "approved" | "rejected";

export type GovernedMultilingualService =
  | "heuristic"
  | "alias-seed"
  | "catalogue-ai-copy"
  | "multilingual-provider";

export type GovernedMultilingualProviderStatus = "ok" | "degraded" | "failed";

/**
 * Point48-approved source copy + identity — sole grounding for multilingual suggestions.
 * `source_version` pins the upstream naming/description contract revision.
 */
export type AuthoritativeMultilingualSource = AuthoritativeProductFacts & {
  source_version: string;
  approved_catalogue_title?: string | null;
  approved_short_description?: string | null;
  approved_description?: string | null;
  approved_hindi_description?: string | null;
  approved_arabic_name?: string | null;
  approved_turkish_name?: string | null;
};

export type GovernedMultilingualFieldSuggestion = {
  kind: MultilingualSuggestionKind;
  locale: MultilingualLocaleCode;
  script: string;
  value: string;
  availability: MultilingualAvailability;
  suggestion_only: true;
  approved: false;
  review_status: "pending_review";
  source_version: string;
  term_type?: string;
};

export type GovernedMultilingualProvenance = {
  service: GovernedMultilingualService;
  provider_status: GovernedMultilingualProviderStatus;
  prompt_version: string;
  source_version: string;
  source_identity: string;
  used_heuristic_fallback: boolean;
  fail_closed: boolean;
  uncertainty_reason?: string;
  invoked_at: string;
};

export type GovernedMultilingualSuggestionResult =
  | {
      ok: true;
      suggestion_only: true;
      approved: false;
      human_review_required: true;
      disclaimer: string;
      suggestions: GovernedMultilingualFieldSuggestion[];
      provenance: GovernedMultilingualProvenance;
    }
  | {
      ok: false;
      suggestion_only: true;
      approved: false;
      human_review_required: true;
      disclaimer: string;
      reason: string;
      provenance: GovernedMultilingualProvenance;
    };

export type GovernedMultilingualValidationResult =
  | { ok: true; suggestion: GovernedMultilingualFieldSuggestion }
  | { ok: false; reason: string };

export type LocaleResolutionResult = {
  locale: MultilingualLocaleCode | "unsupported";
  availability: MultilingualAvailability;
  reason?: string;
};
