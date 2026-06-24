import type { WebhookPayloadInput } from "./types";

const SUPPORTED_TEXT_TYPES = new Set(["text", "interactive", "button"]);

export type NormalizedWebhookPayload = {
  provider: WebhookPayloadInput["provider"];
  provider_message_id: string | null;
  sender_phone: string;
  sender_name: string | null;
  message_body: string;
  message_type: string;
  received_at: string;
  raw_payload: Record<string, unknown>;
};

export type NormalizeResult =
  | { ok: true; value: NormalizedWebhookPayload }
  | { ok: true; ignored: true; reason: string }
  | { ok: false; error: string };

function extractMetaMessageBody(raw: Record<string, unknown>): {
  body: string | null;
  message_type: string;
  provider_message_id: string | null;
  sender_phone: string | null;
  sender_name: string | null;
  received_at: string | null;
} {
  const entry = (raw.entry as unknown[])?.[0] as Record<string, unknown> | undefined;
  const change = (entry?.changes as unknown[])?.[0] as Record<string, unknown> | undefined;
  const value = change?.value as Record<string, unknown> | undefined;
  const message = (value?.messages as unknown[])?.[0] as Record<string, unknown> | undefined;
  const contact = (value?.contacts as unknown[])?.[0] as Record<string, unknown> | undefined;

  const message_type = String(message?.type ?? "unknown");
  const text =
    (message?.text as { body?: string } | undefined)?.body ??
    (message?.button as { text?: string } | undefined)?.text ??
    (message?.interactive as { button_reply?: { title?: string } } | undefined)?.button_reply?.title ??
    null;

  return {
    body: text,
    message_type,
    provider_message_id: message?.id ? String(message.id) : null,
    sender_phone: message?.from ? String(message.from) : null,
    sender_name: (contact?.profile as { name?: string } | undefined)?.name ?? null,
    received_at: message?.timestamp
      ? new Date(Number(message.timestamp) * 1000).toISOString()
      : null,
  };
}

export function normalizeWebhookPayload(input: WebhookPayloadInput): NormalizeResult {
  if (input.provider === "meta_whatsapp" && input.raw_payload) {
    const meta = extractMetaMessageBody(input.raw_payload);
    const message_type = meta.message_type || input.message_type || "unknown";

    if (!SUPPORTED_TEXT_TYPES.has(message_type)) {
      return { ok: true, ignored: true, reason: `unsupported message type: ${message_type}` };
    }

    const phone = (meta.sender_phone ?? input.sender_phone)?.trim() ?? "";
    const body = (meta.body ?? input.message_body)?.trim() ?? "";

    if (!phone) return { ok: false, error: "sender_phone is required" };
    if (!body) return { ok: false, error: "message_body is required for text messages" };

    return {
      ok: true,
      value: {
        provider: input.provider,
        provider_message_id: meta.provider_message_id ?? input.provider_message_id?.trim() ?? null,
        sender_phone: phone,
        sender_name: meta.sender_name ?? input.sender_name?.trim() ?? null,
        message_body: body,
        message_type,
        received_at: meta.received_at ?? input.received_at ?? new Date().toISOString(),
        raw_payload: input.raw_payload,
      },
    };
  }

  const message_type = input.message_type?.trim() || "text";
  if (!SUPPORTED_TEXT_TYPES.has(message_type)) {
    return { ok: true, ignored: true, reason: `unsupported message type: ${message_type}` };
  }

  const phone = input.sender_phone?.trim() ?? "";
  const body = input.message_body?.trim() ?? "";
  if (!phone) return { ok: false, error: "sender_phone is required" };
  if (!body) return { ok: false, error: "message_body is required for text messages" };

  return {
    ok: true,
    value: {
      provider: input.provider,
      provider_message_id: input.provider_message_id?.trim() ?? null,
      sender_phone: phone,
      sender_name: input.sender_name?.trim() ?? null,
      message_body: body,
      message_type,
      received_at: input.received_at ?? new Date().toISOString(),
      raw_payload: input.raw_payload ?? { provider: input.provider },
    },
  };
}
