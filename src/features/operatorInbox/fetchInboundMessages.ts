import { supabase } from "@/integrations/supabase/client";
import { SAMPLE_INBOUND_MESSAGES } from "./fixtures/sampleMessages";
import { mapRowToInboundMessage, rowFromRpcPayload } from "./mapInboundMessage";
import { isWhatsAppTableUnavailable } from "./validateWhatsAppInbound";
import type { InboxFeedResult } from "./whatsappInboundTypes";

export async function fetchInboundMessages(): Promise<InboxFeedResult> {
  const { data, error } = await supabase
    .from("whatsapp_inbound_messages" as never)
    .select("*")
    .order("received_at", { ascending: false })
    .limit(50);

  if (error) {
    if (isWhatsAppTableUnavailable(error)) {
      return {
        mode: "sample_fallback",
        messages: SAMPLE_INBOUND_MESSAGES,
        banner: "Live ingestion unavailable — showing sample preview",
        table_available: false,
      };
    }
    return {
      mode: "sample_fallback",
      messages: SAMPLE_INBOUND_MESSAGES,
      banner: `Live ingestion unavailable — showing sample preview (${error.message})`,
      table_available: false,
    };
  }

  const rows = (data ?? []).map((row) => rowFromRpcPayload(row as Record<string, unknown>));
  if (rows.length === 0) {
    return {
      mode: "live",
      messages: [],
      banner: "Live messages enabled — no inbound messages yet",
      table_available: true,
    };
  }

  return {
    mode: "live",
    messages: rows.map(mapRowToInboundMessage),
    banner: "Live messages enabled",
    table_available: true,
  };
}

/** Test helper — choose feed source without Supabase. */
export function resolveInboxFeed(input: {
  table_available: boolean;
  rows: ReturnType<typeof mapRowToInboundMessage>[];
}): InboxFeedResult {
  if (!input.table_available) {
    return {
      mode: "sample_fallback",
      messages: SAMPLE_INBOUND_MESSAGES,
      banner: "Live ingestion unavailable — showing sample preview",
      table_available: false,
    };
  }
  if (input.rows.length === 0) {
    return {
      mode: "live",
      messages: [],
      banner: "Live messages enabled — no inbound messages yet",
      table_available: true,
    };
  }
  return {
    mode: "live",
    messages: input.rows,
    banner: "Live messages enabled",
    table_available: true,
  };
}
