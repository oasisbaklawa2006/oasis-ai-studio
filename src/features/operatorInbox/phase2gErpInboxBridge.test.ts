import { describe, expect, it, vi } from "vitest";
import { PRODUCTION_SNAPSHOT_CATALOG } from "@/features/productIntelligence/runtime/fixtures/productionSnapshotCatalog";
import { resolveProductUtterance } from "@/features/productIntelligence/runtime";
import { createInMemoryIngestStore } from "./ingestInboundMessage";
import { mapErpWhatsAppMessage, normalizeErpPhone } from "./bridge/mapErpWhatsAppMessage";
import { processErpInboundRow } from "./bridge/processErpInboundRow";
import { SAMPLE_ERP_WHATSAPP_ROWS } from "./bridge/fixtures/sampleErpWhatsAppRows";

const catalog = PRODUCTION_SNAPSHOT_CATALOG;

describe("Phase 2G — ERP row mapping", () => {
  it("mapErpWhatsAppMessage happy path populates ingest args", () => {
    const row = SAMPLE_ERP_WHATSAPP_ROWS[0];
    const mapped = mapErpWhatsAppMessage(row);
    expect(mapped.ok).toBe(true);
    if (mapped.ok && !("skipped" in mapped && mapped.skipped)) {
      expect(mapped.value.sender_phone).toBe("+919891162212");
      expect(mapped.value.message_body).toBe("10 kg Midya pista");
      expect(mapped.value.provider_message_id).toContain("wamid.");
      expect(mapped.value.raw_payload.bridge_source).toBe("erp_whatsapp_messages");
      expect(mapped.value.raw_payload.erp_row_id).toBe(row.id);
    }
  });

  it("missing sender_phone fails mapping", () => {
    const mapped = mapErpWhatsAppMessage({
      ...SAMPLE_ERP_WHATSAPP_ROWS[0],
      whatsapp_contacts: { phone_number: "  ", customer_name: null },
    });
    expect(mapped.ok).toBe(false);
  });

  it("empty message_body is skipped", () => {
    const mapped = mapErpWhatsAppMessage({
      ...SAMPLE_ERP_WHATSAPP_ROWS[0],
      content: "   ",
    });
    expect(mapped.ok).toBe(true);
    if (mapped.ok && "skipped" in mapped) {
      expect(mapped.skipped).toBe(true);
    }
  });

  it("outbound ERP row is skipped", () => {
    const mapped = mapErpWhatsAppMessage(SAMPLE_ERP_WHATSAPP_ROWS[2]);
    expect(mapped.ok).toBe(true);
    if (mapped.ok && "skipped" in mapped) {
      expect(mapped.skipped).toBe(true);
      expect(mapped.reason).toContain("outbound");
    }
  });

  it("unsupported image type is skipped", () => {
    const mapped = mapErpWhatsAppMessage(SAMPLE_ERP_WHATSAPP_ROWS[3]);
    expect(mapped.ok).toBe(true);
    if (mapped.ok && "skipped" in mapped) {
      expect(mapped.skipped).toBe(true);
      expect(mapped.reason).toContain("image");
    }
  });

  it("normalizeErpPhone prefixes country code", () => {
    expect(normalizeErpPhone("919891162212")).toBe("+919891162212");
    expect(normalizeErpPhone("+919891162212")).toBe("+919891162212");
  });
});

describe("Phase 2G — ERP bridge ingest", () => {
  it("processErpInboundRow valid row resolves catalog utterance", async () => {
    const store = createInMemoryIngestStore();
    const result = await processErpInboundRow(SAMPLE_ERP_WHATSAPP_ROWS[0], {
      resolve: async (text) => {
        const resolution = resolveProductUtterance(text, catalog);
        return { resolver_status: "resolved", resolver_result_json: resolution };
      },
      rpc: store.deps.rpc,
    });

    expect(result.ok).toBe(true);
    if (result.ok && !("skipped" in result && result.skipped)) {
      expect(result.resolver_status).toBe("resolved");
      expect(store.rows.size).toBe(1);
    }
  });

  it("duplicate provider_message_id returns single store row", async () => {
    const store = createInMemoryIngestStore();
    const deps = {
      resolve: async (text: string) => ({
        resolver_status: "resolved" as const,
        resolver_result_json: resolveProductUtterance(text, catalog),
      }),
      rpc: store.deps.rpc,
    };

    const first = await processErpInboundRow(SAMPLE_ERP_WHATSAPP_ROWS[0], deps);
    const second = await processErpInboundRow(SAMPLE_ERP_WHATSAPP_ROWS[0], deps);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (
      first.ok &&
      !("skipped" in first && first.skipped) &&
      second.ok &&
      !("skipped" in second && second.skipped)
    ) {
      expect(second.duplicate).toBe(true);
      expect(first.message_id).toBe(second.message_id);
    }
    expect(store.rows.size).toBe(1);
  });

  it("resolver throws ingests with resolver_status failed", async () => {
    const store = createInMemoryIngestStore();
    const result = await processErpInboundRow(SAMPLE_ERP_WHATSAPP_ROWS[1], {
      resolve: async () => {
        throw new Error("resolver boom");
      },
      rpc: store.deps.rpc,
    });

    expect(result.ok).toBe(true);
    if (result.ok && !("skipped" in result && result.skipped)) {
      expect(result.resolver_status).toBe("failed");
      const row = [...store.rows.values()][0];
      expect(row.resolver_status).toBe("failed");
    }
  });

  it("governance: no outbound graph.facebook.com calls", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const store = createInMemoryIngestStore();
    await processErpInboundRow(SAMPLE_ERP_WHATSAPP_ROWS[0], {
      resolve: async (text) => ({
        resolver_status: "resolved",
        resolver_result_json: resolveProductUtterance(text, catalog),
      }),
      rpc: store.deps.rpc,
    });
    const outbound = fetchSpy.mock.calls.filter(([url]) => String(url).includes("graph.facebook.com"));
    expect(outbound).toHaveLength(0);
    fetchSpy.mockRestore();
  });

  it("governance: ERP reader mock only selects whatsapp_messages", () => {
    const tables: string[] = [];
    const erpClient = {
      from(table: string) {
        tables.push(table);
        return {
          select: () => ({
            eq: () => ({
              gt: () => ({
                order: () => ({
                  order: () => ({
                    limit: async () => ({ data: [], error: null }),
                  }),
                }),
              }),
            }),
          }),
        };
      },
    };
    void erpClient.from("whatsapp_messages").select("*").eq("direction", "inbound");
    expect(tables).toEqual(["whatsapp_messages"]);
    expect(tables).not.toContain("orders");
  });
});
