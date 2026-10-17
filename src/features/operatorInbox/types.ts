import type { ProductUtteranceResolution } from "@/features/productIntelligence/runtime";

export type InboundWhatsAppMessage = {
  id: string;
  customer_label: string;
  body: string;
  received_at: string;
  /** `live` when loaded from whatsapp_inbound_messages; `sample` for Phase 2B fixtures. */
  source?: "live" | "sample";
  /** Resolver output stored at ingest time (Phase 2C). */
  stored_resolution?: ProductUtteranceResolution | null;
  resolver_status?: "pending" | "resolved" | "failed";
};

export type OperatorDecision = "pending" | "confirmed" | "rejected" | "alternative_selected";

export type OperatorSuggestionState = {
  decision: OperatorDecision;
  selected_sku: string | null;
  selected_product_name: string | null;
  decided_at: string | null;
};

export type InboundMessageView = {
  message: InboundWhatsAppMessage;
  resolution: ProductUtteranceResolution | null;
  resolver_error: string | null;
  operator: OperatorSuggestionState;
};

export type SuggestionAuditAction = "confirm" | "reject" | "select_alternative";

export type SuggestionAuditEvent = {
  id: string;
  message_id: string;
  utterance: string;
  action: SuggestionAuditAction;
  sku: string | null;
  product_name: string | null;
  confidence_band: string | null;
  timestamp: string;
};
