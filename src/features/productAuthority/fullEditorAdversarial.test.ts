import { describe, expect, it, vi } from "vitest";
import {
  canAutosaveProductDraft,
  createProductDraftEnvelope,
  parseProductDraft,
  writeProductDraft,
} from "./productDraftPersistence";
import { validateProductAggregate } from "./productAggregateValidation";
import { isCurrentAsyncRequest } from "./requestRace";
import { createSaveAttemptGate } from "./saveAttemptGate";
import { sanitizeLiveProductsPayload } from "./productSchemaAdapter";

const validIdentity = {
  product_name: "Pistachio Midya",
  product_class: "ready_pack",
  product_type: "prepacked_ready_packs",
  sku: "OAS-AS-BKL-PST-MAAPET-0001",
  main_department: "packing_assembly",
};

describe("Full Editor hostile input boundaries", () => {
  it.each([
    ["array", [1]],
    ["object", { value: 1 }],
    ["boolean", true],
    ["nested JSON", { amount: { value: 1 } }],
  ])("rejects a %s masquerading as a numeric value", (_label, value) => {
    const codes = validateProductAggregate({ ...validIdentity, mrp: value })
      .map((issue) => issue.code);
    expect(codes).toContain("number.mrp");
  });

  it("rejects non-scalar required identity fields instead of stringifying them", () => {
    const issues = validateProductAggregate({
      ...validIdentity,
      product_name: { html: "<img src=x onerror=alert(1)>" },
      product_class: ["ready_pack"],
    });
    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "required.product_name",
      "required.product_class",
    ]));
  });

  it.each(["NaN", "Infinity", "1e309", "0xnot-a-number", "<script>alert(1)</script>"])(
    "rejects disruptive numeric text %s",
    (value) => {
      expect(validateProductAggregate({ ...validIdentity, net_weight_g: value }))
        .toEqual(expect.arrayContaining([expect.objectContaining({ code: "number.net_weight_g" })]));
    },
  );

  it("rejects zero-valued physical and commercial quantities while allowing zero GST", () => {
    const issues = validateProductAggregate({
      ...validIdentity,
      gst_rate: 0,
      net_weight_g: 0,
      shelf_life_days: 0,
      mrp: 0,
      pieces_per_kg: 0,
      moq_value: 0,
      moq_rule_type: "fixed_minimum",
      moq_uom: "box",
      dimension_l_cm: 0,
    });
    const codes = issues.map((issue) => issue.code);
    expect(codes).toEqual(expect.arrayContaining([
      "positive.net_weight_g",
      "positive.shelf_life_days",
      "positive.mrp",
      "positive.pieces_per_kg",
      "positive.moq_value",
      "positive.dimension_l_cm",
    ]));
    expect(codes).not.toContain("positive.gst_rate");
  });

  it("reports all independent cross-field contradictions in one aggregate pass", () => {
    const issues = validateProductAggregate({
      ...validIdentity,
      net_weight_g: 1000,
      gross_weight_g: 900,
      gst_rate: 101,
      approximate_piece_weight_g: 20,
      pieces_per_kg: 10,
      primary_pack_type: "box",
      qty_per_pack: 6,
      moq_rule_type: "fixed_minimum",
      moq_value: 6,
      moq_uom: "box",
      increment_value: 1,
      increment_uom: "carton",
      fixed_carton_required: true,
      carton_qty: 2.5,
    });
    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "weight.gross_below_net",
      "gst.out_of_range",
      "uom.piece_math_mismatch",
      "pack.uom_required",
      "pack.content_uom_required",
      "moq.increment_uom_mismatch",
      "integer.carton_qty",
      "required.carton_uom",
    ]));
  });

  it("strips structural injection keys without mutating global prototypes", () => {
    const hostile = JSON.parse(
      '{"product_name":"مزيج פיסטוק <b>Gold</b> 🍫","__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"nested":{"$where":"while(true){}"}}',
    ) as Record<string, unknown>;
    const result = sanitizeLiveProductsPayload(hostile);
    expect(result.payload).toEqual({ product_name: "مزيج פיסטוק <b>Gold</b> 🍫" });
    expect(result.stripped).toEqual(expect.arrayContaining(["__proto__", "constructor", "nested"]));
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });
});

describe("Full Editor refresh and draft recovery boundaries", () => {
  it.each(["null", "[]", "42", "true", '"text"'])("rejects corrupt top-level draft shape %s", (raw) => {
    expect(parseProductDraft(raw, "product:new", "replacement"))
      .toMatchObject({ ok: false, reason: "corrupt" });
  });

  it("rejects envelopes with invalid data or missing submission identity", () => {
    expect(parseProductDraft(JSON.stringify({
      schemaVersion: 1,
      routeKey: "product:new",
      idempotencyKey: "idem",
      data: [],
    }), "product:new", "replacement")).toMatchObject({ ok: false, reason: "schema_mismatch" });
    expect(parseProductDraft(JSON.stringify({
      schemaVersion: 1,
      routeKey: "product:new",
      idempotencyKey: "   ",
      data: {},
    }), "product:new", "replacement")).toMatchObject({ ok: false, reason: "corrupt" });
  });

  it("round-trips a large multilingual draft without changing its stable submission identity", () => {
    const hostileText = `${"अمוצר🍫<tag>{\"k\":1}\u0000".repeat(12_000)} RTL \u202E end`;
    const envelope = createProductDraftEnvelope(
      "product:unicode",
      { product_name: hostileText, operational_notes: hostileText },
      "idem-unicode",
      () => new Date("2026-07-13T00:00:00.000Z"),
    );
    const parsed = parseProductDraft(JSON.stringify(envelope), "product:unicode", "replacement");
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.envelope.idempotencyKey).toBe("idem-unicode");
      expect(parsed.envelope.data.product_name).toBe(hostileText);
    }
  });

  it.each([
    new DOMException("Quota exceeded", "QuotaExceededError"),
    new DOMException("Storage denied", "SecurityError"),
    new Error("Storage unavailable"),
  ])("returns a recoverable failure when browser persistence throws", (failure) => {
    const storage = { setItem: vi.fn(() => { throw failure; }) };
    const result = writeProductDraft(
      storage,
      "product:new",
      createProductDraftEnvelope("product:new", { product_name: "Unsaved" }, "idem"),
    );
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.error).toBe(failure);
  });

  it("never autosaves a stale tab's dirty form into another route", () => {
    expect(canAutosaveProductDraft("product:a", "product:b", true)).toBe(false);
    expect(canAutosaveProductDraft("product:b", "product:b", false)).toBe(false);
    expect(canAutosaveProductDraft("product:b", "product:b", true)).toBe(true);
  });
});

describe("Full Editor double-submit and latest-request-wins boundaries", () => {
  it("admits exactly one of 1,000 same-tick save attempts", () => {
    const gate = createSaveAttemptGate();
    const admitted = Array.from({ length: 1_000 }, () => gate.tryEnter()).filter(Boolean);
    expect(admitted).toHaveLength(1);
    expect(gate.isActive()).toBe(true);
    gate.release();
    expect(gate.tryEnter()).toBe(true);
  });

  it("accepts only the newest request across adversarial completion order", () => {
    const requestIds = Array.from({ length: 250 }, (_, index) => `product-${index}`);
    const latestId = requestIds.at(-1) ?? null;
    const accepted = [...requestIds].reverse().filter((requestId) =>
      isCurrentAsyncRequest(requestId, false, latestId));
    expect(accepted).toEqual(["product-249"]);
    expect(isCurrentAsyncRequest("product-249", true, latestId)).toBe(false);
  });
});
