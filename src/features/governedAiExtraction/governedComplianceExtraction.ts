import type { ComplianceSensitiveField } from "@/shared/ai/complianceConstants";
import { AI_COMPLIANCE_LEGAL_DISCLAIMER } from "@/shared/ai/complianceConstants";
import {
  type AiComplianceResponse,
  type AiComplianceSuggestionPayload,
  buildHeuristicComplianceSuggestions,
  parseAiComplianceResponse,
} from "@/shared/ai/complianceSuggestions";
import { mergeGovernedComplianceSuggestions } from "./governedFieldMerge";
import type {
  GovernedAiConfidence,
  GovernedAiFieldSuggestion,
  GovernedAiProvenance,
  GovernedAiProviderStatus,
  GovernedAiService,
  GovernedComplianceExtraction,
} from "./types";

function confidenceForStatus(status: GovernedAiProviderStatus): GovernedAiConfidence {
  if (status === "ok") return "medium";
  if (status === "degraded") return "low";
  return "unresolved";
}

function suggestionsFromPayload(
  payload: AiComplianceSuggestionPayload,
  service: GovernedAiService,
  confidence: GovernedAiConfidence,
): GovernedAiFieldSuggestion[] {
  const out: GovernedAiFieldSuggestion[] = [];
  const push = (field: ComplianceSensitiveField, value: string | number | null | undefined) => {
    if (value == null || String(value).trim() === "") return;
    out.push({
      field,
      value: String(value),
      confidence,
      source: service,
      suggestion_only: true,
      approved: false,
    });
  };

  push("hsn_code", payload.hsn_code);
  push("gst_rate", payload.gst_rate);
  push("shelf_life_days", payload.shelf_life_days);
  push("ingredients", payload.ingredients);
  push("allergen_warnings", payload.allergen_warnings);
  push("nutritional_info", payload.nutritional_info);
  push("storage_instructions", payload.storage_instructions);

  return out;
}

function buildProvenance(input: {
  service: GovernedAiService;
  provider_status: GovernedAiProviderStatus;
  used_heuristic_fallback: boolean;
  uncertainty_reason?: string;
}): GovernedAiProvenance {
  const fail_closed = input.provider_status !== "ok";
  return {
    service: input.service,
    provider_status: input.provider_status,
    used_heuristic_fallback: input.used_heuristic_fallback,
    fail_closed,
    uncertainty_reason: input.uncertainty_reason,
    invoked_at: new Date().toISOString(),
  };
}

export type GovernedComplianceExtractionInput = {
  product_name?: string;
  category?: string;
  edgeData: unknown;
  edgeError: { message?: string } | null;
};

/**
 * Resolve governed compliance extraction from the generate-product-attributes edge function.
 * Provider/runtime uncertainty is fail-closed: suggestions remain review-only and are never
 * treated as approved catalogue truth.
 */
export function extractGovernedCompliance(
  input: GovernedComplianceExtractionInput,
): GovernedComplianceExtraction {
  const parsed = parseAiComplianceResponse(input.edgeData);
  const hasEdgeError = !!input.edgeError;

  if (parsed && !hasEdgeError) {
    return buildGovernedExtractionFromResponse(parsed, {
      service: "generate-product-attributes",
      provider_status: "ok",
      used_heuristic_fallback: false,
    });
  }

  const uncertaintyReason = hasEdgeError
    ? (input.edgeError?.message ?? "Edge function unavailable")
    : "Invalid or non-governed AI response shape";

  const heuristic = buildHeuristicComplianceSuggestions({
    product_name: input.product_name,
    category: input.category,
  });

  return buildGovernedExtractionFromResponse(heuristic, {
    service: "heuristic",
    provider_status: hasEdgeError ? "degraded" : "failed",
    used_heuristic_fallback: true,
    uncertainty_reason: uncertaintyReason,
  });
}

function buildGovernedExtractionFromResponse(
  response: AiComplianceResponse,
  status: {
    service: GovernedAiService;
    provider_status: GovernedAiProviderStatus;
    used_heuristic_fallback: boolean;
    uncertainty_reason?: string;
  },
): GovernedComplianceExtraction {
  const confidence = confidenceForStatus(status.provider_status);
  const suggestions = suggestionsFromPayload(response.suggestions, status.service, confidence);
  const provenance = buildProvenance(status);

  const suggestionRecord = Object.fromEntries(
    suggestions.map((s) => [s.field, s.value]),
  ) as Partial<Record<ComplianceSensitiveField, string>>;

  const { complianceFieldMeta } = mergeGovernedComplianceSuggestions({
    currentForm: {},
    suggestions: suggestionRecord,
    metaMap: {},
  });

  return {
    suggestion_only: true,
    approved: false,
    disclaimer: response.disclaimer || AI_COMPLIANCE_LEGAL_DISCLAIMER,
    suggestions,
    provenance,
    complianceFieldMeta,
  };
}

export function applyGovernedComplianceToForm(
  currentForm: Record<string, unknown>,
  extraction: GovernedComplianceExtraction,
  metaMap?: Record<string, unknown>,
): {
  form: Record<string, unknown>;
  appliedFields: ComplianceSensitiveField[];
  preservedFields: ComplianceSensitiveField[];
  complianceFieldMeta: GovernedComplianceExtraction["complianceFieldMeta"];
} {
  const suggestionRecord = Object.fromEntries(
    extraction.suggestions.map((s) => [s.field, s.value]),
  ) as Partial<Record<ComplianceSensitiveField, string>>;

  const { merged, appliedFields, preservedFields, complianceFieldMeta } =
    mergeGovernedComplianceSuggestions({
      currentForm,
      suggestions: suggestionRecord,
      metaMap: metaMap as GovernedComplianceExtraction["complianceFieldMeta"],
    });

  return { form: merged, appliedFields, preservedFields, complianceFieldMeta };
}
