import { supabase } from "@/integrations/supabase/client";
import type { ProductUtteranceResolution } from "@/features/productIntelligence/runtime";
import { resolveInboundMessage } from "./resolveInboundMessage";
import { rowFromRpcPayload } from "./mapInboundMessage";
import { validateWhatsAppInboundInput } from "./validateWhatsAppInbound";
import type {
  IngestInboundResult,
  WhatsAppInboundInput,
  WhatsAppInboundMessageRow,
} from "./whatsappInboundTypes";

export type IngestDeps = {
  resolve: typeof resolveInboundMessage;
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{
    data: (Record<string, unknown> & { __ingest_duplicate?: boolean }) | null;
    error: { message: string; code?: string } | null;
  }>;
};

const defaultDeps: IngestDeps = {
  resolve: resolveInboundMessage,
  rpc: async (fn, args) => {
    const { data, error } = await supabase.rpc(fn as "ingest_whatsapp_inbound_message", args as never);
    return { data: data as Record<string, unknown> | null, error };
  },
};

export function buildResolverPayload(
  resolution: ProductUtteranceResolution | null,
): { resolver_status: "resolved" | "failed"; resolver_result_json: ProductUtteranceResolution | null } {
  if (!resolution) {
    return { resolver_status: "failed", resolver_result_json: null };
  }
  return { resolver_status: "resolved", resolver_result_json: resolution };
}

export async function ingestInboundMessage(
  input: WhatsAppInboundInput,
  deps: IngestDeps = defaultDeps,
): Promise<IngestInboundResult> {
  const validated = validateWhatsAppInboundInput(input);
  if (!validated.ok) {
    throw new Error(validated.error);
  }

  const value = validated.value;
  const resolution = await deps.resolve(value.message_body);
  const resolverPayload = buildResolverPayload(resolution);

  const { data, error } = await deps.rpc("ingest_whatsapp_inbound_message", {
    _provider_message_id: value.provider_message_id,
    _sender_phone: value.sender_phone,
    _sender_name: value.sender_name,
    _message_body: value.message_body,
    _message_type: value.message_type ?? "text",
    _received_at: value.received_at,
    _raw_payload: value.raw_payload ?? null,
    _resolver_status: resolverPayload.resolver_status,
    _resolver_result_json: resolverPayload.resolver_result_json,
  });

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error("ingest returned no row");
  }

  const duplicate = Boolean(data.__ingest_duplicate);
  const { __ingest_duplicate: _dup, ...rowData } = data;
  const row = rowFromRpcPayload(rowData);

  return { row, duplicate, resolution };
}

/** In-memory ingest for tests — no Supabase, no outbound APIs. */
export function createInMemoryIngestStore() {
  const rows = new Map<string, WhatsAppInboundMessageRow>();

  const deps: IngestDeps = {
    resolve: resolveInboundMessage,
    rpc: async (_fn, args) => {
      const providerId = (args._provider_message_id as string | null) ?? null;
      if (providerId) {
        const existing = [...rows.values()].find((r) => r.provider_message_id === providerId);
      if (existing) {
        return {
          data: { ...(existing as unknown as Record<string, unknown>), __ingest_duplicate: true },
          error: null,
        };
      }
      }

      const id = crypto.randomUUID();
      const row: WhatsAppInboundMessageRow = {
        id,
        provider_message_id: providerId,
        sender_phone: String(args._sender_phone),
        sender_name: (args._sender_name as string | null) ?? null,
        message_body: String(args._message_body),
        message_type: String(args._message_type ?? "text"),
        received_at: String(args._received_at ?? new Date().toISOString()),
        raw_payload: (args._raw_payload as Record<string, unknown> | null) ?? null,
        resolver_status: (args._resolver_status as WhatsAppInboundMessageRow["resolver_status"]) ?? "pending",
        resolver_result_json: (args._resolver_result_json as ProductUtteranceResolution | null) ?? null,
        created_at: new Date().toISOString(),
      };
      rows.set(id, row);
      return { data: row as unknown as Record<string, unknown>, error: null };
    },
  };

  return {
    deps,
    rows,
    ingest: (input: WhatsAppInboundInput) => ingestInboundMessage(input, deps),
  };
}
