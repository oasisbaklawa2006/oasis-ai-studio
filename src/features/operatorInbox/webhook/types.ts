export type WebhookProvider = "meta_whatsapp" | "test";

export type WebhookPayloadInput = {
  provider: WebhookProvider;
  provider_message_id?: string | null;
  sender_phone: string;
  sender_name?: string | null;
  message_body?: string | null;
  message_type?: string | null;
  received_at?: string | null;
  raw_payload?: Record<string, unknown> | null;
};

export type WebhookProcessResult =
  | {
      ok: true;
      ignored?: false;
      message_id: string;
      resolver_status: string;
      duplicate?: boolean;
    }
  | {
      ok: true;
      ignored: true;
      reason: string;
    }
  | {
      ok: false;
      error: string;
    };
