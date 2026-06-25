import type { ProductUtteranceResolution } from "@/features/productIntelligence/runtime";
import type { WhatsAppDraftRow, WhatsAppOperatorDecisionRow } from "./fetchDraftVisibility";
import { initialOperatorState } from "./operatorSuggestionState";
import type { OperatorSuggestionState } from "./types";

export type OperatorHydration = {
  operator: OperatorSuggestionState;
  draftId: string | null;
};

export function hydrateOperatorStateFromPersistence(
  resolution: ProductUtteranceResolution | null,
  draft: WhatsAppDraftRow | null | undefined,
  latestDecision: WhatsAppOperatorDecisionRow | null | undefined,
): OperatorHydration {
  if (draft) {
    const decision =
      draft.operator_decision === "alternative_selected" ? "alternative_selected" : "confirmed";
    return {
      operator: {
        decision,
        selected_sku: draft.resolved_sku,
        selected_product_name: draft.resolved_product_name,
        decided_at: draft.created_at,
      },
      draftId: draft.id,
    };
  }

  if (latestDecision?.action === "reject") {
    return {
      operator: {
        decision: "rejected",
        selected_sku: null,
        selected_product_name: null,
        decided_at: latestDecision.decided_at,
      },
      draftId: null,
    };
  }

  if (latestDecision?.action === "select_alternative") {
    return {
      operator: {
        decision: "alternative_selected",
        selected_sku: latestDecision.sku,
        selected_product_name: latestDecision.product_name,
        decided_at: latestDecision.decided_at,
      },
      draftId: latestDecision.whatsapp_sales_order_draft_id,
    };
  }

  if (latestDecision?.action === "confirm") {
    return {
      operator: {
        decision: "confirmed",
        selected_sku: latestDecision.sku ?? resolution?.resolved_sku ?? null,
        selected_product_name: latestDecision.product_name ?? resolution?.resolved_name ?? null,
        decided_at: latestDecision.decided_at,
      },
      draftId: latestDecision.whatsapp_sales_order_draft_id,
    };
  }

  return {
    operator: initialOperatorState(resolution),
    draftId: null,
  };
}

export function indexOperatorHydration(
  drafts: WhatsAppDraftRow[],
  decisions: WhatsAppOperatorDecisionRow[],
): Map<string, { draft: WhatsAppDraftRow | null; latestDecision: WhatsAppOperatorDecisionRow | null }> {
  const byMessage = new Map<
    string,
    { draft: WhatsAppDraftRow | null; latestDecision: WhatsAppOperatorDecisionRow | null }
  >();

  for (const draft of drafts) {
    const entry = byMessage.get(draft.source_message_id) ?? {
      draft: null,
      latestDecision: null,
    };
    if (!entry.draft) entry.draft = draft;
    byMessage.set(draft.source_message_id, entry);
  }

  for (const decision of decisions) {
    const entry = byMessage.get(decision.source_message_id) ?? {
      draft: null,
      latestDecision: null,
    };
    if (!entry.latestDecision) entry.latestDecision = decision;
    byMessage.set(decision.source_message_id, entry);
  }

  return byMessage;
}
