import { describe, expect, it } from "vitest";
import {
  isCompleteResolution,
  isRenderableStoredResolution,
  normalizeStoredResolution,
} from "./storedResolution";
import { parseStoredResolution, rowFromRpcPayload } from "./mapInboundMessage";
import { initialOperatorState, confirmSuggestion } from "./operatorSuggestionState";
import { resolveInboundMessage } from "./resolveInboundMessage";
import { showPrimarySuggestion } from "./suggestionGovernance";

/** Production DB rows observed 2026-06-24 — minimal edge-stored JSON shapes. */
const DB_MINIMAL_RESOLVER_JSON = {
  resolved_sku: "OAS-AS-BKL-PST-BULK-0017",
  confidence_band: "HIGH",
} as const;

const DB_PARTIAL_RESOLVER_JSON = {
  action: "auto_suggest",
  resolved_sku: "OAS-AS-BKL-PST-MAAPET-0003",
  resolved_name: "Classic Pistachio Midya Gift Pack 6 pcs",
  confidence_band: "HIGH",
} as const;

const DB_FULL_RESOLVER_JSON = {
  query: "6 pc midya",
  action: "auto_suggest",
  resolved_sku: "OAS-AS-BKL-PST-MAAPET-0003",
  resolved_name: "Classic Pistachio Midya Gift Pack 6 pcs",
  order_quantity: 6,
  confidence_band: "HIGH",
  confidence: 0.92,
  reason: "Pack count + product family match.",
  alternatives: [],
} as const;

describe("Phase 2F hotfix — stored resolution normalization", () => {
  it("minimal resolver_result_json normalizes and is renderable (no infinite loading path)", () => {
    const normalized = normalizeStoredResolution(DB_MINIMAL_RESOLVER_JSON, "pista bulbul");
    expect(normalized).not.toBeNull();
    expect(normalized!.resolved_sku).toBe("OAS-AS-BKL-PST-BULK-0017");
    expect(normalized!.query).toBe("pista bulbul");
    expect(normalized!.alternatives).toEqual([]);
    expect(normalized!.confidence).toBeGreaterThan(0);
    expect(isRenderableStoredResolution(normalized)).toBe(true);
  });

  it("partial resolver_result_json without query uses message body fallback", () => {
    const normalized = normalizeStoredResolution(DB_PARTIAL_RESOLVER_JSON, "6 pc midya");
    expect(normalized).not.toBeNull();
    expect(normalized!.query).toBe("6 pc midya");
    expect(normalized!.resolved_name).toContain("Midya");
    expect(isRenderableStoredResolution(normalized)).toBe(true);
  });

  it("full resolver_result_json is complete and renderable", () => {
    const normalized = normalizeStoredResolution(DB_FULL_RESOLVER_JSON, "6 pc midya");
    expect(normalized).not.toBeNull();
    expect(isCompleteResolution(normalized)).toBe(true);
    expect(isRenderableStoredResolution(normalized)).toBe(true);
    expect(normalized!.order_quantity).toBe(6);
  });

  it("rowFromRpcPayload hydrates stored JSON from whatsapp_inbound_messages shape", () => {
    const row = rowFromRpcPayload({
      id: "row-1",
      sender_phone: "+919999999999",
      message_body: "pista bulbul",
      received_at: new Date().toISOString(),
      resolver_status: "resolved",
      resolver_result_json: DB_MINIMAL_RESOLVER_JSON,
      created_at: new Date().toISOString(),
    });
    expect(row.resolver_result_json?.resolved_sku).toBe("OAS-AS-BKL-PST-BULK-0017");
    expect(isRenderableStoredResolution(row.resolver_result_json)).toBe(true);
  });

  it("parseStoredResolution returns null for empty ingest JSON", () => {
    expect(parseStoredResolution(null, "hello")).toBeNull();
    expect(parseStoredResolution({}, "hello")).toBeNull();
  });
});

describe("Phase 2F hotfix — suggestion card readiness from stored JSON", () => {
  it("minimal stored resolution supports confirm operator action (buttons not blocked)", () => {
    const resolution = normalizeStoredResolution(DB_MINIMAL_RESOLVER_JSON, "pista bulbul")!;
    const operator = initialOperatorState(resolution);
    expect(showPrimarySuggestion(resolution)).toBe(true);
    expect(operator.selected_sku).toBe("OAS-AS-BKL-PST-BULK-0017");
    expect(operator.decision).toBe("pending");
    const confirmed = confirmSuggestion(operator, resolution);
    expect(confirmed.decision).toBe("confirmed");
    expect(confirmed.selected_sku).toBe("OAS-AS-BKL-PST-BULK-0017");
  });

  it("full stored resolution exposes product name and SKU for card display", () => {
    const resolution = normalizeStoredResolution(DB_FULL_RESOLVER_JSON, "6 pc midya")!;
    expect(resolution.resolved_name).toContain("Classic Pistachio Midya Gift Pack");
    expect(resolution.resolved_sku).toBe("OAS-AS-BKL-PST-MAAPET-0003");
    expect(resolution.reason).toBeTruthy();
    expect(resolution.confidence).toBeGreaterThan(0);
  });
});

describe("Phase 2F hotfix — resolver failure safe state", () => {
  it("client resolver timeout exits loading path (returns null)", async () => {
    const never = new Promise<never>(() => undefined);
    const res = await resolveInboundMessage("pista bulbul", async () => never, 50);
    expect(res).toBeNull();
  });

  it("failed ingest status maps to non-renderable stored resolution", () => {
    const row = rowFromRpcPayload({
      id: "row-fail",
      sender_phone: "+919999999999",
      message_body: "unknown sku xyz",
      received_at: new Date().toISOString(),
      resolver_status: "failed",
      resolver_result_json: null,
      created_at: new Date().toISOString(),
    });
    expect(row.resolver_status).toBe("failed");
    expect(isRenderableStoredResolution(row.resolver_result_json)).toBe(false);
  });
});

/**
 * Meta production callback routing (verified via Supabase edge logs 2026-06-24):
 * - Live WhatsApp POSTs hit legacy `whatsapp-webhook` (ERP pipeline) — 200 responses.
 * - Studio safe ingest is `whatsapp-studio-inbox-webhook` — only test POST (403).
 * - Studio inbox reads `whatsapp_inbound_messages`; legacy webhook does not write there.
 * - To surface live WhatsApp in Studio inbox, Meta callback URL must include
 *   `/functions/v1/whatsapp-studio-inbox-webhook` (legacy slug must remain for ERP).
 */
describe("Phase 2F hotfix — webhook route documentation", () => {
  it("documents Studio vs legacy webhook slugs", () => {
    const studioSlug = "whatsapp-studio-inbox-webhook";
    const legacySlug = "whatsapp-webhook";
    expect(studioSlug).not.toBe(legacySlug);
    expect(`https://tcxvcatsqqertcnycuop.supabase.co/functions/v1/${studioSlug}`).toContain(
      studioSlug,
    );
  });
});
