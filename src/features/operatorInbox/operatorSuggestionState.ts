import type { RuntimeAlternative } from "@/features/productIntelligence/runtime";
import type { OperatorSuggestionState } from "./types";
import { canPreselectTopMatch } from "./suggestionGovernance";
import type { ProductUtteranceResolution } from "@/features/productIntelligence/runtime";

export function initialOperatorState(
  resolution: ProductUtteranceResolution | null,
): OperatorSuggestionState {
  if (resolution && canPreselectTopMatch(resolution)) {
    return {
      decision: "pending",
      selected_sku: resolution.resolved_sku,
      selected_product_name: resolution.resolved_name,
      decided_at: null,
    };
  }
  return {
    decision: "pending",
    selected_sku: null,
    selected_product_name: null,
    decided_at: null,
  };
}

export function confirmSuggestion(
  state: OperatorSuggestionState,
  resolution: ProductUtteranceResolution | null,
): OperatorSuggestionState {
  const sku = state.selected_sku ?? resolution?.resolved_sku ?? null;
  const name = state.selected_product_name ?? resolution?.resolved_name ?? null;
  if (!sku) return state;
  return {
    decision: "confirmed",
    selected_sku: sku,
    selected_product_name: name,
    decided_at: new Date().toISOString(),
  };
}

export function rejectSuggestion(state: OperatorSuggestionState): OperatorSuggestionState {
  return {
    ...state,
    decision: "rejected",
    selected_sku: null,
    selected_product_name: null,
    decided_at: new Date().toISOString(),
  };
}

export function selectAlternative(
  state: OperatorSuggestionState,
  alt: RuntimeAlternative,
): OperatorSuggestionState {
  return {
    decision: "alternative_selected",
    selected_sku: alt.sku,
    selected_product_name: alt.product_name,
    decided_at: new Date().toISOString(),
  };
}
