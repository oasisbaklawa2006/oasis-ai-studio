import type { ProductUtteranceResolution } from "@/features/productIntelligence/runtime";
import { normalizeStoredResolution } from "./storedResolution";
import type { WhatsAppInboundMessageRow } from "./whatsappInboundTypes";
import type { InboundWhatsAppMessage } from "./types";

export function mapRowToInboundMessage(row: WhatsAppInboundMessageRow): InboundWhatsAppMessage {
  return {
    id: row.id,
    customer_label: row.sender_name?.trim() || row.sender_phone,
    body: row.message_body,
    received_at: row.received_at,
    source: "live",
    stored_resolution: row.resolver_result_json,
    resolver_status: row.resolver_status,
  };
}

export function parseStoredResolution(
  value: unknown,
  fallbackQuery = "",
): ProductUtteranceResolution | null {
  return normalizeStoredResolution(value, fallbackQuery);
}

export function rowFromRpcPayload(data: Record<string, unknown>): WhatsAppInboundMessageRow {
  const message_body = String(data.message_body);
  return {
    id: String(data.id),
    provider_message_id: (data.provider_message_id as string | null) ?? null,
    sender_phone: String(data.sender_phone),
    sender_name: (data.sender_name as string | null) ?? null,
    message_body,
    message_type: String(data.message_type ?? "text"),
    received_at: String(data.received_at),
    raw_payload: (data.raw_payload as Record<string, unknown> | null) ?? null,
    resolver_status: (data.resolver_status as WhatsAppInboundMessageRow["resolver_status"]) ?? "pending",
    resolver_result_json: parseStoredResolution(data.resolver_result_json, message_body),
    created_at: String(data.created_at),
  };
}
