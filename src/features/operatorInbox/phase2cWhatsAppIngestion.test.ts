import { describe, expect, it, beforeEach, vi } from "vitest";
import { PRODUCTION_SNAPSHOT_CATALOG } from "@/features/productIntelligence/runtime/fixtures/productionSnapshotCatalog";
import { resolveProductUtterance, type RuntimeCatalog } from "@/features/productIntelligence/runtime";
import {
  confirmSuggestion,
  initialOperatorState,
  rejectSuggestion,
  selectAlternative,
} from "./operatorSuggestionState";
import {
  appendSuggestionAudit,
  clearSuggestionAuditLog,
  getSuggestionAuditLog,
} from "./suggestionAudit";
import { canPreselectTopMatch } from "./suggestionGovernance";
import { validateWhatsAppInboundInput } from "./validateWhatsAppInbound";
import {
  buildResolverPayload,
  createInMemoryIngestStore,
  ingestInboundMessage,
} from "./ingestInboundMessage";
import { resolveInboxFeed } from "./fetchInboundMessages";
import { mapRowToInboundMessage } from "./mapInboundMessage";
import { seedPhase2cTestMessagesInMemory } from "./seedPhase2cTestMessages";
import { SAMPLE_INBOUND_MESSAGES } from "./fixtures/sampleMessages";

const catalog: RuntimeCatalog = PRODUCTION_SNAPSHOT_CATALOG;
const loadCatalog = async () => catalog;

describe("Phase 2C — inbound validation", () => {
  it("rejects empty sender_phone", () => {
    const result = validateWhatsAppInboundInput({
      sender_phone: "  ",
      message_body: "pista bulbul",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects empty message_body", () => {
    const result = validateWhatsAppInboundInput({
      sender_phone: "+919999999999",
      message_body: " ",
    });
    expect(result.ok).toBe(false);
  });

  it("accepts valid inbound payload", () => {
    const result = validateWhatsAppInboundInput({
      provider_message_id: "wamid-123",
      sender_phone: "+919999999999",
      sender_name: "Aisha",
      message_body: "pista bulbul",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.message_body).toBe("pista bulbul");
    }
  });
});

describe("Phase 2C — ingest store (no orders)", () => {
  it("insert stores resolver_result_json", async () => {
    const store = createInMemoryIngestStore();
    const result = await ingestInboundMessage(
      {
        provider_message_id: "test-ingest-1",
        sender_phone: "+911111111111",
        message_body: "pista bulbul",
      },
      {
        resolve: async (text) => {
          const { resolveInboundMessage } = await import("./resolveInboundMessage");
          return resolveInboundMessage(text, loadCatalog);
        },
        rpc: store.deps.rpc,
      },
    );

    expect(result.row.resolver_status).toBe("resolved");
    expect(result.row.resolver_result_json?.confidence_band).toBe("HIGH");
    expect(result.row.resolver_result_json?.resolved_sku).toBe("OAS-AS-BKL-PST-BULK-0017");
    expect("order_id" in result.row).toBe(false);
  });

  it("duplicate provider_message_id is idempotent", async () => {
    const store = createInMemoryIngestStore();
    const deps = {
      resolve: async (text: string) => {
        const { resolveInboundMessage } = await import("./resolveInboundMessage");
        return resolveInboundMessage(text, loadCatalog);
      },
      rpc: store.deps.rpc,
    };

    const first = await ingestInboundMessage(
      {
        provider_message_id: "dup-wamid-1",
        sender_phone: "+911111111111",
        message_body: "midya",
      },
      deps,
    );
    const second = await ingestInboundMessage(
      {
        provider_message_id: "dup-wamid-1",
        sender_phone: "+911111111111",
        message_body: "midya",
      },
      deps,
    );

    expect(second.duplicate).toBe(true);
    expect(second.row.id).toBe(first.row.id);
    expect(store.rows.size).toBe(1);
  });

  it("buildResolverPayload marks failed when resolver returns null", () => {
    expect(buildResolverPayload(null)).toEqual({
      resolver_status: "failed",
      resolver_result_json: null,
    });
  });
});

describe("Phase 2C — inbox feed fallback", () => {
  it("falls back to sample messages when table unavailable", () => {
    const feed = resolveInboxFeed({ table_available: false, rows: [] });
    expect(feed.mode).toBe("sample_fallback");
    expect(feed.messages).toEqual(SAMPLE_INBOUND_MESSAGES);
    expect(feed.banner).toContain("sample preview");
  });

  it("loads live messages when table available", () => {
    const liveRow = mapRowToInboundMessage({
      id: "live-1",
      provider_message_id: "wamid-live",
      sender_phone: "+911111111111",
      sender_name: "Live User",
      message_body: "pista bulbul",
      message_type: "text",
      received_at: "2026-06-23T10:00:00Z",
      raw_payload: null,
      resolver_status: "resolved",
      resolver_result_json: resolveProductUtterance("pista bulbul", catalog),
      created_at: "2026-06-23T10:00:00Z",
    });

    const feed = resolveInboxFeed({ table_available: true, rows: [liveRow] });
    expect(feed.mode).toBe("live");
    expect(feed.messages).toHaveLength(1);
    expect(feed.messages[0].source).toBe("live");
    expect(feed.messages[0].stored_resolution?.confidence_band).toBe("HIGH");
  });
});

describe("Phase 2C — governance and operator actions", () => {
  beforeEach(() => {
    clearSuggestionAuditLog();
  });

  it("LOW confidence never auto-confirms", () => {
    const res = resolveProductUtterance("midya", catalog);
    expect(res.confidence_band).toBe("LOW");
    const state = initialOperatorState(res);
    expect(state.decision).toBe("pending");
    expect(canPreselectTopMatch(res)).toBe(false);
  });

  it("confirm/reject/select alternative do not create orders", () => {
    const res = resolveProductUtterance("pista bulbul", catalog);
    const confirmed = confirmSuggestion(initialOperatorState(res), res);
    appendSuggestionAudit({
      message_id: "live-1",
      utterance: "pista bulbul",
      action: "confirm",
      sku: confirmed.selected_sku,
      product_name: confirmed.selected_product_name,
      confidence_band: res.confidence_band,
    });
    expect(getSuggestionAuditLog()[0].action).toBe("confirm");
    expect("order_id" in getSuggestionAuditLog()[0]).toBe(false);

    const rejected = rejectSuggestion(initialOperatorState(res));
    expect(rejected.decision).toBe("rejected");

    const alt = res.alternatives[0];
    const picked = selectAlternative(initialOperatorState(res), alt);
    expect(picked.decision).toBe("pending");
    expect(picked.selected_sku).toBe(alt.sku);
  });
});

describe("Phase 2C — no outbound WhatsApp API", () => {
  it("ingest does not call outbound WhatsApp endpoints", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const store = createInMemoryIngestStore();

    await ingestInboundMessage(
      {
        provider_message_id: "no-outbound-1",
        sender_phone: "+911111111111",
        message_body: "pista bulbul",
      },
      {
        resolve: async (text) => {
          const { resolveInboundMessage } = await import("./resolveInboundMessage");
          return resolveInboundMessage(text, loadCatalog);
        },
        rpc: store.deps.rpc,
      },
    );

    const outboundCalls = fetchSpy.mock.calls.filter(([url]) => {
      const target = String(url);
      return target.includes("graph.facebook.com") || target.includes("whatsapp");
    });
    expect(outboundCalls).toHaveLength(0);
    fetchSpy.mockRestore();
  });
});

describe("Phase 2C — test seeder", () => {
  it("seeds five safe non-production messages in memory", async () => {
    const results = await seedPhase2cTestMessagesInMemory({ catalogLoader: loadCatalog });
    expect(results).toHaveLength(5);
    expect(results.every((r) => r.row.raw_payload?.non_production === true)).toBe(true);
    expect(results.map((r) => r.row.message_body)).toEqual([
      "pista bulbul",
      "midya",
      "6 pc midya",
      "kaju tart",
      "Assalamualaikum",
    ]);
  });
});
