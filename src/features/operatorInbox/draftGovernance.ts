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

/**
 * Maps UI confirmed state to draft RPC `operator_decision`.
 * LOW / unresolved rows must send `alternative_selected` per DB constraint.
 */
export function operatorDecisionForDraft(
  resolution: ProductUtteranceResolution | null,
  operator: OperatorSuggestionState,
): "confirmed" | "alternative_selected" | null {
  if (operator.decision !== "confirmed" || !operator.selected_sku) return null;
  if (resolution?.confidence_band === "LOW") return "alternative_selected";
  if (resolution && !resolution.resolved_sku) return "alternative_selected";
  return "confirmed";
}
