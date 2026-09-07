import type {
  CatalogueDraftContent,
  CatalogueDraftContentKey,
} from "@/features/catalogueAiStudio/catalogueDraftTypes";

/** Fast-create and catalogue-studio naming/description fields governed by Point 48. */
export type GovernedNamingDescriptionField =
  | "product_name"
  | "short_name"
  | "short_description"
  | "description"
  | "catalogue_title";

export type GovernedNamingService = "catalogue-ai-copy" | "heuristic" | "template";

export type GovernedNamingProviderStatus = "ok" | "degraded" | "failed";

/** Authoritative product facts that may ground naming/description copy — never invented. */
export type AuthoritativeProductFacts = {
  product_name: string;
  category?: string | null;
  subcategory?: string | null;
  product_type?: string | null;
  pack_size?: string | null;
  description?: string | null;
  short_description?: string | null;
};

export type GovernedNamingFieldSuggestion = {
  field: GovernedNamingDescriptionField;
  value: string;
  suggestion_only: true;
  approved: false;
};

export type GovernedNamingProvenance = {
  service: GovernedNamingService;
  provider_status: GovernedNamingProviderStatus;
  prompt_version: string;
  used_heuristic_fallback: boolean;
  fail_closed: boolean;
  uncertainty_reason?: string;
  invoked_at: string;
};

export type GovernedNamingDescriptionSuggestions = Partial<
  Record<GovernedNamingDescriptionField, string>
>;

export type GovernedNamingDescriptionResult =
  | {
      ok: true;
      suggestion_only: true;
      approved: false;
      human_review_required: true;
      disclaimer: string;
      suggestions: GovernedNamingDescriptionSuggestions;
      provenance: GovernedNamingProvenance;
    }
  | {
      ok: false;
      suggestion_only: true;
      approved: false;
      human_review_required: true;
      disclaimer: string;
      reason: string;
      provenance: GovernedNamingProvenance;
    };

export type GovernedCatalogueCopyValidationResult =
  | { ok: true; content: CatalogueDraftContent }
  | { ok: false; reason: string; unsafe_fields?: CatalogueDraftContentKey[] };
