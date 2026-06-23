import type { ConfidenceBand, ProductUtteranceResolution } from "@/features/productIntelligence/runtime";

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

export function operatorMustConfirm(_resolution: ProductUtteranceResolution): boolean {
  return true;
}
