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

  if (payload.hsn_code != null && String(payload.hsn_code).trim() !== "") {
    out.push({
      field: "hsn_code",
      value: String(payload.hsn_code),
      confidence,
      source: service,
      suggestion_only: true,
      approved: false,
    });
  }
  if (payload.gst_rate != null && String(payload.gst_rate).trim() !== "") {
    out.push({
      field: "gst_rate",
      value: String(payload.gst_rate),
      confidence,
      source: service,
      suggestion_only: true,
      approved: false,
    });
  }
  if (payload.shelf_life_days != null && String(payload.shelf_life_days).trim() !== "") {
    out.push({
      field: "shelf_life_days",
      value: String(payload.shelf_life_days),
      confidence,
      source: service,
      suggestion_only: true,
      approved: false,
    });
  }
  if (payload.ingredients != null && String(payload.ingredients).trim() !== "") {
    out.push({
      field: "ingredients",
      value: String(payload.ingredients),
      confidence,
      source: service,
      suggestion_only: true,
      approved: false,
    });
  }
  if (payload.allergen_warnings != null && String(payload.allergen_warnings).trim() !== "") {
    out.push({
      field: "allergen_warnings",
      value: String(payload.allergen_warnings),
      confidence,
      source: service,
      suggestion_only: true,
      approved: false,
    });
  }
  if (payload.nutritional_info != null && String(payload.nutritional_info).trim() !== "") {
    out.push({
      field: "nutritional_info",
      value: String(payload.nutritional_info),
      confidence,
      source: service,
      suggestion_only: true,
      approved: false,
    });
  }
  if (payload.storage_instructions != null && String(payload.storage_instructions).trim() !== "") {
    out.push({
      field: "storage_instructions",
      value: String(payload.storage_instructions),
      confidence,
      source: service,
      suggestion_only: true,
      approved: false,
    });
  }

  return out;
}

function governedSuggestionsToRecord(
  suggestions: GovernedAiFieldSuggestion[],
): Partial<Record<ComplianceSensitiveField, string>> {
  const record: Partial<Record<ComplianceSensitiveField, string>> = {};
  for (const suggestion of suggestions) {
    switch (suggestion.field) {
      case "hsn_code":
        record.hsn_code = suggestion.value;
        break;
      case "gst_rate":
        record.gst_rate = suggestion.value;
        break;
      case "shelf_life_days":
        record.shelf_life_days = suggestion.value;
        break;
      case "ingredients":
        record.ingredients = suggestion.value;
        break;
      case "allergen_warnings":
        record.allergen_warnings = suggestion.value;
        break;
      case "nutritional_info":
        record.nutritional_info = suggestion.value;
        break;
      case "nutrition_facts":
        record.nutrition_facts = suggestion.value;
        break;
      case "storage_instructions":
        record.storage_instructions = suggestion.value;
        break;
      case "country_of_origin":
        record.country_of_origin = suggestion.value;
        break;
      case "legal_claims":
        record.legal_claims = suggestion.value;
        break;
      case "export_compliance_notes":
        record.export_compliance_notes = suggestion.value;
        break;
      case "health_claims":
        record.health_claims = suggestion.value;
        break;
    }
  }
  return record;
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

  const suggestionRecord = governedSuggestionsToRecord(suggestions);

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
  const suggestionRecord = governedSuggestionsToRecord(extraction.suggestions);

  const { merged, appliedFields, preservedFields, complianceFieldMeta } =
    mergeGovernedComplianceSuggestions({
      currentForm,
      suggestions: suggestionRecord,
      metaMap: metaMap as GovernedComplianceExtraction["complianceFieldMeta"],
    });

  return { form: merged, appliedFields, preservedFields, complianceFieldMeta };
}
