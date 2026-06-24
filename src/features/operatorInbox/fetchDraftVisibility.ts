import { supabase } from "@/integrations/supabase/client";

export type WhatsAppDraftRow = {
  id: string;
  source_message_id: string;
  sender_phone: string;
  customer_name: string | null;
  message_body: string;
  resolved_sku: string;
  resolved_product_name: string | null;
  confidence_band: string;
  operator_decision: string;
  status: string;
  quantity: number;
  created_at: string;
};

export type WhatsAppOperatorDecisionRow = {
  id: string;
  source_message_id: string;
  action: string;
  sku: string | null;
  product_name: string | null;
  confidence_band: string | null;
  whatsapp_sales_order_draft_id: string | null;
  decided_at: string;
};

export type DraftVisibilityResult = {
  drafts: WhatsAppDraftRow[];
  decisions: WhatsAppOperatorDecisionRow[];
  error: string | null;
};

export async function fetchDraftVisibility(): Promise<DraftVisibilityResult> {
  const [draftsRes, decisionsRes] = await Promise.all([
    supabase
      .from("whatsapp_sales_order_drafts" as never)
      .select(
        "id, source_message_id, sender_phone, customer_name, message_body, resolved_sku, resolved_product_name, confidence_band, operator_decision, status, quantity, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("whatsapp_operator_decisions" as never)
      .select(
        "id, source_message_id, action, sku, product_name, confidence_band, whatsapp_sales_order_draft_id, decided_at",
      )
      .order("decided_at", { ascending: false })
      .limit(50),
  ]);

  if (draftsRes.error || decisionsRes.error) {
    return {
      drafts: [],
      decisions: [],
      error: draftsRes.error?.message ?? decisionsRes.error?.message ?? "Failed to load draft visibility",
    };
  }

  return {
    drafts: (draftsRes.data ?? []) as WhatsAppDraftRow[],
    decisions: (decisionsRes.data ?? []) as WhatsAppOperatorDecisionRow[],
    error: null,
  };
}
