import { describe, expect, it } from "vitest";
import { validateProductAggregate } from "./productAggregateValidation";

const valid = {
  product_name: "Pistachio Midya",
  product_class: "ready_pack",
  product_type: "prepacked_ready_packs",
  sku: "OAS-AS-BKL-PST-MAAPET-0001",
  main_department: "packing_assembly",
};

describe("product aggregate validation", () => {
  it("accepts a structurally valid minimal direct product", () => {
    expect(validateProductAggregate(valid)).toEqual([]);
  });

  it("allows contributor identity without a final SKU or department", () => {
    const issues = validateProductAggregate(
      { product_name: "Draft", product_class: "ready_pack", category: "Baklawa" },
      { contributorMode: true },
    );
    expect(issues).toEqual([]);
  });

  it("rejects malicious numeric-shaped and negative values", () => {
    const issues = validateProductAggregate({ ...valid, mrp: "<script>", net_weight_g: -1 });
    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["number.mrp", "non_negative.net_weight_g"]),
    );
  });

  it("rejects gross weight below net weight", () => {
    expect(validateProductAggregate({ ...valid, net_weight_g: 500, gross_weight_g: 450 }))
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: "weight.gross_below_net" })]));
  });

  it("rejects inconsistent piece conversion", () => {
    expect(validateProductAggregate({ ...valid, approximate_piece_weight_g: 20, pieces_per_kg: 10 }))
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: "uom.piece_math_mismatch" })]));
  });

  it("requires dependent packaging, MOQ and carton fields", () => {
    const issues = validateProductAggregate({
      ...valid,
      primary_pack_type: "box",
      qty_per_pack: 6,
      moq_rule_type: "fixed_min",
      increment_value: 1,
      moq_uom: "box",
      increment_uom: "carton",
      fixed_carton_required: true,
    });
    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "pack.uom_required",
      "pack.content_uom_required",
      "required.moq_value",
      "moq.increment_uom_mismatch",
      "required.carton_qty",
      "required.carton_uom",
    ]));
  });
});
