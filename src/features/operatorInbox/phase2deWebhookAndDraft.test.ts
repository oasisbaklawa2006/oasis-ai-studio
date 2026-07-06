import { describe, expect, it, vi } from "vitest";
import { PRODUCTION_SNAPSHOT_CATALOG } from "@/features/productIntelligence/runtime/fixtures/productionSnapshotCatalog";
import {
  resolveProductUtterance,
  type RuntimeCatalog,
} from "@/features/productIntelligence/runtime";
import {
  confirmSuggestion,
  initialOperatorState,
  rejectSuggestion,
  selectAlternative,
} from "./operatorSuggestionState";
import {
  createInMemoryDraftStore,
  createSalesOrderDraftFromOperator,
} from "./createSalesOrderDraft";
import { canCreateSalesOrderDraft } from "./draftGovernance";
import { createInMemoryIngestStore, ingestInboundMessage } from "./ingestInboundMessage";
import { normalizeWebhookPayload } from "./webhook/normalizeWebhookPayload";
import { processWebhookPayload } from "./webhook/processWebhookPayload";

const catalog: RuntimeCatalog = PRODUCTION_SNAPSHOT_CATALOG;
const loadCatalog = async () => catalog;

describe("Phase 2D — webhook adapter", () => {
  it("valid inbound creates whatsapp_inbound_messages row", async () => {
    const store = createInMemoryIngestStore();
    const result = await processWebhookPayload(
      {
        provider: "test",
        provider_message_id: "webhook-valid-1",
        sender_phone: "+919999999999",
        sender_name: "Webhook User",
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

    expect(result.ok).toBe(true);
    if (result.ok && !("ignored" in result && result.ignored)) {
      expect(result.message_id).toBeTruthy();
      expect(result.resolver_status).toBe("resolved");
      expect(store.rows.size).toBe(1);
    }
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

    const first = await processWebhookPayload(
      {
        provider: "test",
        provider_message_id: "webhook-dup-1",
        sender_phone: "+919999999999",
        message_body: "midya",
      },
      deps,
    );
    const second = await processWebhookPayload(
      {
        provider: "test",
        provider_message_id: "webhook-dup-1",
        sender_phone: "+919999999999",
        message_body: "midya",
      },
      deps,
    );

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && !("ignored" in first && first.ignored) && second.ok && !("ignored" in second && second.ignored)) {
      expect(second.duplicate).toBe(true);
      expect(first.message_id).toBe(second.message_id);
    }
    expect(store.rows.size).toBe(1);
  });

  it("invalid sender_phone rejected", async () => {
    const result = await processWebhookPayload({
      provider: "test",
      sender_phone: "  ",
      message_body: "pista bulbul",
    });
    expect(result.ok).toBe(false);
  });

  it("empty message rejected", async () => {
    const result = await processWebhookPayload({
      provider: "test",
      sender_phone: "+919999999999",
      message_body: " ",
    });
    expect(result.ok).toBe(false);
  });

  it("unsupported type ignored safely", () => {
    const result = normalizeWebhookPayload({
      provider: "test",
      sender_phone: "+919999999999",
      message_body: "ignored",
      message_type: "image",
    });
    expect(result.ok).toBe(true);
    if (result.ok && "ignored" in result) {
      expect(result.ignored).toBe(true);
    }
  });

  it("no outbound reply call", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const store = createInMemoryIngestStore();
    await processWebhookPayload(
      {
        provider: "test",
        provider_message_id: "no-outbound-webhook",
        sender_phone: "+919999999999",
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
    const outbound = fetchSpy.mock.calls.filter(([url]) => String(url).includes("graph.facebook.com"));
    expect(outbound).toHaveLength(0);
    fetchSpy.mockRestore();
  });
});

describe("Phase 2D — resolver via webhook ingest", () => {
  it("pista bulbul → suggested product", async () => {
    const res = resolveProductUtterance("pista bulbul", catalog);
    expect(res.confidence_band).toBe("HIGH");
    expect(res.resolved_sku).toBe("OAS-AS-BKL-PST-BULK-0017");
  });

  it("midya → clarification", async () => {
    const res = resolveProductUtterance("midya", catalog);
    expect(res.confidence_band).toBe("LOW");
    expect(res.action).toBe("ask_clarification");
  });

  it("6 pc midya → gift pack", async () => {
    const res = resolveProductUtterance("6 pc midya", catalog);
    expect(res.confidence_band).toBe("HIGH");
    expect(res.resolved_sku).toBe("OAS-AS-BKL-PST-MAAPET-0003");
  });
});

describe("Phase 2E — operator sales order draft", () => {
  it("Confirm HIGH creates draft only", async () => {
    const res = resolveProductUtterance("pista bulbul", catalog);
    const operator = confirmSuggestion(initialOperatorState(res), res);
    const store = createInMemoryDraftStore();
    const result = await createSalesOrderDraftFromOperator(
      { source_message_id: "msg-high-1", resolution: res, operator },
      store.deps,
    );
    expect(result?.draft.status).toBe("AI_DRAFT");
    expect(result?.draft.resolved_sku).toBe("OAS-AS-BKL-PST-BULK-0017");
    expect(result?.draft.source_message_id).toBe("msg-high-1");
    expect("sales_order_id" in (result?.draft ?? {})).toBe(false);
  });

  it("Reject creates no draft", async () => {
    const res = resolveProductUtterance("pista bulbul", catalog);
    const operator = rejectSuggestion(initialOperatorState(res));
    expect(canCreateSalesOrderDraft(res, operator)).toBe(false);
    const store = createInMemoryDraftStore();
    const result = await createSalesOrderDraftFromOperator(
      { source_message_id: "msg-reject-1", resolution: res, operator },
      store.deps,
    );
    expect(result).toBeNull();
    expect(store.drafts.size).toBe(0);
  });

  it("LOW without alternative creates no draft", async () => {
    const res = resolveProductUtterance("midya", catalog);
    const operator = confirmSuggestion(initialOperatorState(res), res);
    expect(canCreateSalesOrderDraft(res, operator)).toBe(false);
  });

  it("LOW with selected alternative creates draft only after confirm", async () => {
    const res = resolveProductUtterance("midya", catalog);
    const alt = res.alternatives.find((a) => a.sku === "OAS-AS-BKL-PST-MAAPET-0003")!;
    const picked = selectAlternative(initialOperatorState(res), alt);
    expect(canCreateSalesOrderDraft(res, picked)).toBe(false);
    const operator = confirmSuggestion(picked, res);
    const store = createInMemoryDraftStore();
    const result = await createSalesOrderDraftFromOperator(
      { source_message_id: "msg-low-alt", resolution: res, operator },
      store.deps,
    );
    expect(result?.draft.status).toBe("UNDER_REVIEW");
    expect(result?.draft.operator_decision).toBe("confirmed");
    expect(result?.draft.resolved_sku).toBe("OAS-AS-BKL-PST-MAAPET-0003");
  });

  it("Draft links to source message", async () => {
    const res = resolveProductUtterance("6 pc midya", catalog);
    const operator = confirmSuggestion(initialOperatorState(res), res);
    const store = createInMemoryDraftStore();
    const result = await createSalesOrderDraftFromOperator(
      { source_message_id: "msg-link-1", resolution: res, operator },
      store.deps,
    );
    expect(result?.draft.source_message_id).toBe("msg-link-1");
    expect(result?.draft.message_body).toBeTruthy();
  });

  it("No inventory/order/finance write occurs", async () => {
    const res = resolveProductUtterance("pista bulbul", catalog);
    const operator = confirmSuggestion(initialOperatorState(res), res);
    const store = createInMemoryDraftStore();
    const result = await createSalesOrderDraftFromOperator(
      { source_message_id: "msg-safe-1", resolution: res, operator },
      store.deps,
    );
    const draft = result?.draft as Record<string, unknown>;
    expect(draft).toBeDefined();
    expect("order_id" in draft!).toBe(false);
    expect("invoice_id" in draft!).toBe(false);
    expect("stock_reserved" in draft!).toBe(false);
  });
});
