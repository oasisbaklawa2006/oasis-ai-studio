import { ingestInboundMessage } from "../ingestInboundMessage";
import { normalizeWebhookPayload } from "./normalizeWebhookPayload";
import type { WebhookPayloadInput, WebhookProcessResult } from "./types";
import type { IngestDeps } from "../ingestInboundMessage";

export async function processWebhookPayload(
  input: WebhookPayloadInput,
  deps?: IngestDeps,
): Promise<WebhookProcessResult> {
  const normalized = normalizeWebhookPayload(input);
  if (!normalized.ok) {
    return { ok: false, error: normalized.error };
  }
  if ("ignored" in normalized && normalized.ignored) {
    return { ok: true, ignored: true, reason: normalized.reason };
  }

  try {
    const result = await ingestInboundMessage(
      {
        provider_message_id: normalized.value.provider_message_id,
        sender_phone: normalized.value.sender_phone,
        sender_name: normalized.value.sender_name,
        message_body: normalized.value.message_body,
        message_type: normalized.value.message_type,
        received_at: normalized.value.received_at,
        raw_payload: {
          ...normalized.value.raw_payload,
          webhook_provider: normalized.value.provider,
        },
      },
      deps,
    );

    return {
      ok: true,
      message_id: result.row.id,
      resolver_status: result.row.resolver_status,
      duplicate: result.duplicate,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "webhook ingest failed" };
  }
}
