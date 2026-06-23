import type { WhatsAppInboundInput } from "./whatsappInboundTypes";

export type InboundValidationResult =
  | { ok: true; value: WhatsAppInboundInput }
  | { ok: false; error: string };

export function validateWhatsAppInboundInput(
  input: WhatsAppInboundInput,
): InboundValidationResult {
  const phone = input.sender_phone?.trim() ?? "";
  if (!phone) {
    return { ok: false, error: "sender_phone is required" };
  }

  const body = input.message_body?.trim() ?? "";
  if (!body) {
    return { ok: false, error: "message_body is required" };
  }

  return {
    ok: true,
    value: {
      ...input,
      sender_phone: phone,
      sender_name: input.sender_name?.trim() || null,
      message_body: body,
      provider_message_id: input.provider_message_id?.trim() || null,
      message_type: input.message_type?.trim() || "text",
      received_at: input.received_at ?? new Date().toISOString(),
    },
  };
}

/** Returns true when Supabase reports the inbound table/RPC is unavailable. */
export function isWhatsAppTableUnavailable(error: { code?: string; message?: string }): boolean {
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();
  return (
    code === "42P01" ||
    code === "PGRST204" ||
    code === "PGRST205" ||
    message.includes("whatsapp_inbound_messages") ||
    message.includes("ingest_whatsapp_inbound_message")
  );
}
