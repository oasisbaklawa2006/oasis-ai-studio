import type { ProductUtteranceResolution } from "@/features/productIntelligence/runtime";
import type { OperatorSuggestionState } from "./types";

export {
  isCompleteResolution,
  isPartialStoredResolution,
  isRenderableStoredResolution,
  normalizeStoredResolution,
} from "./storedResolution";

export function canCreateSalesOrderDraft(
  resolution: ProductUtteranceResolution | null,
  operator: OperatorSuggestionState,
): boolean {
  if (!resolution) return false;
  if (!operator.selected_sku) return false;
  if (operator.decision !== "confirmed") return false;
  return true;
}

export function draftStatusForBand(band: ProductUtteranceResolution["confidence_band"]): "AI_DRAFT" | "UNDER_REVIEW" {
  return band === "HIGH" ? "AI_DRAFT" : "UNDER_REVIEW";
}

export function operatorDecisionForDraft(
  operator: OperatorSuggestionState,
): "confirmed" | "alternative_selected" | null {
  if (operator.decision === "confirmed") return "confirmed";
  if (operator.decision === "alternative_selected") return "alternative_selected";
  return null;
}
