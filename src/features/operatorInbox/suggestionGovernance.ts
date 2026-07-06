import type { ConfidenceBand, ProductUtteranceResolution } from "@/features/productIntelligence/runtime";
import type { OperatorSuggestionState } from "./types";

export type SuggestionDisplayAction = "Suggested" | "Review" | "Ask clarification";

export function displayActionForBand(band: ConfidenceBand): SuggestionDisplayAction {
  switch (band) {
    case "HIGH":
      return "Suggested";
    case "MEDIUM":
      return "Review";
    default:
      return "Ask clarification";
  }
}

/** HIGH may be preselected in the UI but never auto-confirmed without operator action. */
export function canPreselectTopMatch(resolution: ProductUtteranceResolution): boolean {
  return resolution.confidence_band === "HIGH" && !!resolution.resolved_sku;
}

/** LOW must not present a confirmed product suggestion. */
export function showPrimarySuggestion(resolution: ProductUtteranceResolution): boolean {
  return resolution.confidence_band !== "LOW" && !!resolution.resolved_sku;
}

/** LOW / ambiguous rows need an explicit product pick before confirm. */
export function requiresExplicitProductSelection(resolution: ProductUtteranceResolution): boolean {
  return (
    resolution.confidence_band === "LOW" ||
    resolution.clarification_required === true ||
    !resolution.resolved_sku
  );
}

export function canConfirmSuggestion(
  resolution: ProductUtteranceResolution,
  operator: OperatorSuggestionState,
): boolean {
  if (operator.decision !== "pending") return false;
  if (requiresExplicitProductSelection(resolution)) {
    return !!operator.selected_sku;
  }
  return !!(operator.selected_sku ?? resolution.resolved_sku);
}

export function confirmButtonLabel(resolution: ProductUtteranceResolution): string {
  if (requiresExplicitProductSelection(resolution)) {
    return "Confirm selection";
  }
  return "Confirm";
}

export function confirmButtonLabelForCard(
  resolution: ProductUtteranceResolution,
  operator: OperatorSuggestionState,
): string {
  if (operator.decision === "confirmed") return "Confirmed";
  if (operator.decision === "rejected") return "Rejected";
  if (canConfirmSuggestion(resolution, operator)) return confirmButtonLabel(resolution);
  if (requiresExplicitProductSelection(resolution)) return "Select product first";
  return confirmButtonLabel(resolution);
}

export function formatDetectedQuantity(resolution: ProductUtteranceResolution): string | null {
  const qty = resolution.order_quantity;
  if (qty == null || qty < 1) return null;

  const query = resolution.query.toLowerCase();
  if (/\b\d+\s*(kg|kilo|kilos|kilogram|kilograms)\b/.test(query)) return `${qty} kg`;
  if (/\b\d+\s*(g|gm|gms|gram|grams)\b/.test(query)) return `${qty} g`;
  if (resolution.pack_count != null && resolution.pack_count > 0) return `${qty} pc`;
  if (/\b\d+\s*(pc|pcs|piece|pieces)\b/.test(query)) return `${qty} pc`;
  return String(qty);
}

export function operatorMustConfirm(_resolution: ProductUtteranceResolution): boolean {
  return true;
}
