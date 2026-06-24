import { describe, expect, it } from "vitest";
import { extractOrderQuantity } from "@/features/productIntelligence/runtime/parseOrderQuantity";
import { resolveProductUtterance } from "@/features/productIntelligence/runtime";
import { PRODUCTION_SNAPSHOT_CATALOG } from "@/features/productIntelligence/runtime/fixtures/productionSnapshotCatalog";
import {
  confirmSuggestion,
  initialOperatorState,
} from "./operatorSuggestionState";
import {
  createInMemoryDraftStore,
  createSalesOrderDraftFromOperator,
} from "./createSalesOrderDraft";
import { processWebhookPayload } from "./webhook/processWebhookPayload";
import { createInMemoryIngestStore } from "./ingestInboundMessage";

describe("Phase 2F — order quantity extraction", () => {
  it("6 pc midya → quantity 6", () => {
    expect(extractOrderQuantity("6 pc midya")).toBe(6);
  });

  it("bare leading count fallback", () => {
    expect(extractOrderQuantity("2 pista bulbul")).toBe(2);
  });

  it("defaults to 1 when no quantity phrase", () => {
    expect(extractOrderQuantity("pista bulbul")).toBe(1);
  });

  it("resolver stores order_quantity on resolution", () => {
    const res = resolveProductUtterance("6 pc midya", PRODUCTION_SNAPSHOT_CATALOG);
    expect(res.order_quantity).toBe(6);
    expect(res.resolved_sku).toBe("OAS-AS-BKL-PST-MAAPET-0003");
  });
});

describe("Phase 2F — draft quantity wiring", () => {
  it("confirm HIGH passes parsed quantity to draft RPC", async () => {
    const res = resolveProductUtterance("6 pc midya", PRODUCTION_SNAPSHOT_CATALOG);
    const operator = confirmSuggestion(initialOperatorState(res), res);
    const store = createInMemoryDraftStore();
    const result = await createSalesOrderDraftFromOperator(
      { source_message_id: "msg-qty-1", resolution: res, operator },
      store.deps,
    );
    expect(result?.draft.quantity).toBe(6);
  });
});

describe("Phase 2F — webhook ingest stores resolver JSON", () => {
  it("processWebhookPayload stores resolved status with order_quantity", async () => {
    const store = createInMemoryIngestStore();
    const result = await processWebhookPayload(
      {
        provider: "test",
        provider_message_id: "phase2f-qty-webhook",
        sender_phone: "+919999999999",
        message_body: "6 pc midya",
      },
      {
        resolve: async (text) => {
          const { resolveInboundMessage } = await import("./resolveInboundMessage");
          const { PRODUCTION_SNAPSHOT_CATALOG: catalog } = await import(
            "@/features/productIntelligence/runtime/fixtures/productionSnapshotCatalog"
          );
          const { resolveProductUtterance: resolve } = await import(
            "@/features/productIntelligence/runtime"
          );
          return resolve(text, catalog);
        },
        rpc: store.deps.rpc,
      },
    );

    expect(result.ok).toBe(true);
    if (result.ok && !("ignored" in result && result.ignored)) {
      expect(result.resolver_status).toBe("resolved");
      const row = [...store.rows.values()][0];
      expect(row.resolver_result_json?.order_quantity).toBe(6);
    }
  });
});
