import type { ProductUtteranceResolution } from "@/features/productIntelligence/runtime";

export type WhatsAppInboundMessageRow = {
  id: string;
  provider_message_id: string | null;
  sender_phone: string;
  sender_name: string | null;
  message_body: string;
  message_type: string;
  received_at: string;
  raw_payload: Record<string, unknown> | null;
  resolver_status: "pending" | "resolved" | "failed";
  resolver_result_json: ProductUtteranceResolution | null;
  created_at: string;
};

export type WhatsAppInboundInput = {
  provider_message_id?: string | null;
  sender_phone: string;
  sender_name?: string | null;
  message_body: string;
  received_at?: string;
  raw_payload?: Record<string, unknown> | null;
  message_type?: string;
};

export type IngestInboundResult = {
  row: WhatsAppInboundMessageRow;
  duplicate: boolean;
  resolution: ProductUtteranceResolution | null;
};

export type InboxFeedMode = "live" | "sample_fallback";

export type InboxFeedResult = {
  mode: InboxFeedMode;
  messages: import("./types").InboundWhatsAppMessage[];
  banner: string;
  table_available: boolean;
};
