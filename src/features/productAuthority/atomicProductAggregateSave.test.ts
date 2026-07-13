import { describe, expect, it, vi } from "vitest";
import {
  buildAtomicMoqRules,
  buildAtomicPricingRules,
  mapAtomicProductSaveError,
  saveProductAggregateAtomic,
} from "./atomicProductAggregateSave";

describe("atomic Full Editor aggregate save", () => {
  it("sends governed pricing without browser-owned approval or product identity", () => {
    const rules = buildAtomicPricingRules({
      b2b_price: "1250",
      export_price: "18.5",
      currency: "INR",
      b2b_uom: "carton",
      primary_uom: "kg",
    });

    expect(rules).toEqual([
      expect.objectContaining({
        price_channel: "b2b",
        base_price: 1250,
        calculated_price: 1250,
        uom: "carton",
      }),
      expect.objectContaining({
        price_channel: "export",
        base_price: 18.5,
        calculated_price: 18.5,
      }),
    ]);
    for (const rule of rules) {
      expect(rule).not.toHaveProperty("product_id");
      expect(rule).not.toHaveProperty("approval_status");
      expect(rule).not.toHaveProperty("approved_by");
    }
  });

  it("maps primary MOQ compatibility fields to one governed B2B child", () => {
    expect(
      buildAtomicMoqRules({
        moq_value: "6",
        primary_uom: "box",
        increment_value: "2",
        carton_qty: "48",
        carton_logic: "closed carton",
      }),
    ).toEqual([
      expect.objectContaining({
        channel: "b2b",
        moq_value: 6,
        moq_uom: "box",
        increment_value: 2,
        min_carton_qty: 48,
      }),
    ]);
    expect(buildAtomicMoqRules({})).toEqual([]);
  });

  it("uses only the versioned RPC and returns its atomic receipt", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        schema_version: "oasis.product-aggregate-save.v1",
        status: "saved",
        operation: "create",
        product_id: "6e9da94c-095f-4cab-b1eb-5ec5b7c13423",
        product: {
          id: "6e9da94c-095f-4cab-b1eb-5ec5b7c13423",
          product_name: "Pistachio Map Tray",
        },
        pricing_rules_written: 1,
        moq_rules_written: 1,
        updated_at: "2026-07-14T01:00:00.000Z",
        aggregate_revision: 3,
      },
      error: null,
    });

    const result = await saveProductAggregateAtomic(
      {
        idempotencyKey: "6f5dc2d8-3b87-498d-9944-a24c92337647",
        operation: "create",
        productId: null,
        expectedUpdatedAt: null,
        expectedAggregateRevision: null,
        product: { product_name: "Pistachio Map Tray", sku: "OAS-CHO-PST-0001" },
        sourceForm: { b2b_price: 1000, moq_value: 6, moq_uom: "box" },
      },
      { rpc },
    );

    expect(result.ok).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith(
      "save_product_aggregate_v1",
      expect.objectContaining({
        _operation: "create",
        _product_id: null,
        _expected_updated_at: null,
        _expected_aggregate_revision: null,
        _pricing_rules: [expect.objectContaining({ price_channel: "b2b" })],
        _moq_rules: [expect.objectContaining({ channel: "b2b" })],
      }),
    );
  });

  it("fails closed on an invalid receipt and does not retry with table writes", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { status: "saved" }, error: null });
    const result = await saveProductAggregateAtomic(
      {
        idempotencyKey: "6f5dc2d8-3b87-498d-9944-a24c92337647",
        operation: "update",
        productId: "6e9da94c-095f-4cab-b1eb-5ec5b7c13423",
        expectedUpdatedAt: "2026-07-14T01:00:00.000Z",
        expectedAggregateRevision: 7,
        product: { product_name: "Pistachio Map Tray", sku: "OAS-CHO-PST-0001" },
        sourceForm: {},
      },
      { rpc },
    );

    expect(result).toEqual(
      expect.objectContaining({ ok: false, kind: "server" }),
    );
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("maps replay mismatch and optimistic concurrency to a preserved-draft conflict", () => {
    expect(mapAtomicProductSaveError({ code: "P0001", message: "OASIS_IDEMPOTENCY_CONFLICT" }))
      .toEqual(expect.objectContaining({ kind: "conflict" }));
    expect(mapAtomicProductSaveError({ code: "40001", message: "OASIS_PRODUCT_VERSION_CONFLICT" }))
      .toEqual(expect.objectContaining({ kind: "conflict" }));
    expect(mapAtomicProductSaveError({ code: "40001", message: "OASIS_PRODUCT_AGGREGATE_REVISION_CONFLICT" }))
      .toEqual(expect.objectContaining({ kind: "conflict" }));
    expect(mapAtomicProductSaveError({ code: "23505", message: "duplicate key" }))
      .toEqual(expect.objectContaining({ kind: "validation" }));
  });
});
