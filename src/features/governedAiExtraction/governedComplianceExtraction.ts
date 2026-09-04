import type { ComplianceSensitiveField } from "@/shared/ai/complianceConstants";
import { AI_COMPLIANCE_LEGAL_DISCLAIMER } from "@/shared/ai/complianceConstants";
import {
  type AiComplianceResponse,
  type AiComplianceSuggestionPayload,
  buildHeuristicComplianceSuggestions,
  parseAiComplianceResponse,
} from "@/shared/ai/complianceSuggestions";
import { readAiSuggestionPayloadValue } from "./complianceFieldAccess";
import { mergeGovernedComplianceSuggestions } from "./governedFieldMerge";
import type {
  GovernedAiConfidence,
  GovernedAiFieldSuggestion,
  GovernedAiProvenance,
  GovernedAiProviderStatus,
  GovernedAiService,
  GovernedComplianceExtraction,
} from "./types";

const COMPLIANCE_FIELD_KEYS: ComplianceSensitiveField[] = [
  "hsn_code",
  "gst_rate",
  "shelf_life_days",
  "ingredients",
  "allergen_warnings",
  "nutritional_info",
  "storage_instructions",
];

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
  for (const field of COMPLIANCE_FIELD_KEYS) {
    const value = readAiSuggestionPayloadValue(payload, field);
    if (value == null || String(value).trim() === "") continue;
    out.push({
      field,
      value: String(value),
      confidence,
      source: service,
      suggestion_only: true,
      approved: false,
    });
  }
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
