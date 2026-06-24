import { supabase } from "@/integrations/supabase/client";
import type { ProductUtteranceResolution } from "@/features/productIntelligence/runtime";
import {
  canCreateSalesOrderDraft,
  operatorDecisionForDraft,
} from "./draftGovernance";
import type { OperatorSuggestionState } from "./types";

export type SalesOrderDraftRow = {
  id: string;
  source: "whatsapp_inbound";
  source_message_id: string;
  sender_phone: string;
  customer_name: string | null;
  message_body: string;
  resolved_product_id: string | null;
  resolved_sku: string;
  resolved_product_name: string | null;
  confidence_band: "HIGH" | "MEDIUM" | "LOW";
  operator_decision: "confirmed" | "alternative_selected";
  status: "AI_DRAFT" | "UNDER_REVIEW" | "CANCELLED";
  quantity: number;
  created_by: string;
  created_at: string;
};

export type CreateDraftResult = {
  draft: SalesOrderDraftRow;
  duplicate: boolean;
};

export type CreateDraftDeps = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
};

const defaultDeps: CreateDraftDeps = {
  rpc: async (fn, args) => {
    const { data, error } = await supabase.rpc(fn as "create_whatsapp_sales_order_draft_from_operator", args as never);
    return { data: data as Record<string, unknown> | null, error };
  },
};

export function rowFromDraftPayload(data: Record<string, unknown>): SalesOrderDraftRow {
  return {
    id: String(data.id),
    source: "whatsapp_inbound",
    source_message_id: String(data.source_message_id),
    sender_phone: String(data.sender_phone),
    customer_name: (data.customer_name as string | null) ?? null,
    message_body: String(data.message_body),
    resolved_product_id: (data.resolved_product_id as string | null) ?? null,
    resolved_sku: String(data.resolved_sku),
    resolved_product_name: (data.resolved_product_name as string | null) ?? null,
    confidence_band: data.confidence_band as SalesOrderDraftRow["confidence_band"],
    operator_decision: data.operator_decision as SalesOrderDraftRow["operator_decision"],
    status: data.status as SalesOrderDraftRow["status"],
    quantity: Number(data.quantity ?? 1),
    created_by: String(data.created_by),
    created_at: String(data.created_at),
  };
}

export async function createSalesOrderDraftFromOperator(
  input: {
    source_message_id: string;
    resolution: ProductUtteranceResolution;
    operator: OperatorSuggestionState;
  },
  deps: CreateDraftDeps = defaultDeps,
): Promise<CreateDraftResult | null> {
  if (!canCreateSalesOrderDraft(input.resolution, input.operator)) {
    return null;
  }

  const operatorDecision = operatorDecisionForDraft(input.operator);
  if (!operatorDecision || !input.operator.selected_sku) {
    return null;
  }

  const productId =
    input.resolution.resolved_product_id ??
    input.resolution.alternatives.find((a) => a.sku === input.operator.selected_sku)?.product_id ??
    null;

  const { data, error } = await deps.rpc("create_whatsapp_sales_order_draft_from_operator", {
    _source_message_id: input.source_message_id,
    _resolved_sku: input.operator.selected_sku,
    _resolved_product_name: input.operator.selected_product_name,
    _resolved_product_id: productId,
    _confidence_band: input.resolution.confidence_band,
    _operator_decision: operatorDecision,
  });

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error("draft RPC returned no row");
  }

  const draft = rowFromDraftPayload(data);
  return { draft, duplicate: false };
}

export async function recordOperatorDecision(
  input: {
    source_message_id: string;
    action: "reject" | "select_alternative";
    sku: string | null;
    product_name: string | null;
    confidence_band: string | null;
  },
  deps: CreateDraftDeps = defaultDeps,
): Promise<void> {
  const { error } = await deps.rpc("record_whatsapp_operator_decision", {
    _source_message_id: input.source_message_id,
    _action: input.action,
    _sku: input.sku,
    _product_name: input.product_name,
    _confidence_band: input.confidence_band,
  });
  if (error) {
    throw new Error(error.message);
  }
}

export function createInMemoryDraftStore() {
  const drafts = new Map<string, SalesOrderDraftRow>();
  const decisions: Array<Record<string, unknown>> = [];

  const deps: CreateDraftDeps = {
    rpc: async (fn, args) => {
      if (fn === "create_whatsapp_sales_order_draft_from_operator") {
        const messageId = String(args._source_message_id);
        const existing = drafts.get(messageId);
        if (existing) {
          return { data: existing as unknown as Record<string, unknown>, error: null };
        }
        const band = String(args._confidence_band) as SalesOrderDraftRow["confidence_band"];
        const draft: SalesOrderDraftRow = {
          id: crypto.randomUUID(),
          source: "whatsapp_inbound",
          source_message_id: messageId,
          sender_phone: "+911111111111",
          customer_name: "Test",
          message_body: "test",
          resolved_product_id: (args._resolved_product_id as string | null) ?? null,
          resolved_sku: String(args._resolved_sku),
          resolved_product_name: (args._resolved_product_name as string | null) ?? null,
          confidence_band: band,
          operator_decision: args._operator_decision as SalesOrderDraftRow["operator_decision"],
          status: band === "HIGH" ? "AI_DRAFT" : "UNDER_REVIEW",
          quantity: 1,
          created_by: "test-user",
          created_at: new Date().toISOString(),
        };
        drafts.set(messageId, draft);
        decisions.push({ action: "confirm", draft_id: draft.id });
        return { data: draft as unknown as Record<string, unknown>, error: null };
      }
      decisions.push({ action: args._action, message_id: args._source_message_id });
      return { data: { id: crypto.randomUUID() }, error: null };
    },
  };

  return { deps, drafts, decisions };
}
