import { describe, expect, it } from "vitest";
import {
  dbRowToProductForm,
  formToDbProductPayload,
} from "@/features/productAuthority/productSchemaAdapter";
import {
  assertFactualCompositionValidForProductsWrite,
  PRODUCT_EDIT_SHELF_LIFE_NUMERIC_FIELDS,
  productEditDirectProductsRow,
} from "./productEditFactualCompositionPersistence";

describe("productEditFactualCompositionPersistence", () => {
  it("rejects zero shelf-life before adapter payload construction", () => {
    expect(() => assertFactualCompositionValidForProductsWrite({ shelf_life_days: "0" })).toThrow(
      /shelf_life_days/,
    );
    expect(() => productEditDirectProductsRow({ shelf_life_days: 0 })).toThrow(/shelf_life_days/);
  });

  it("rejects negative and fractional shelf-life values", () => {
    expect(() =>
      productEditDirectProductsRow({
        shelf_life_days: -5,
        frozen_shelf_life_days: 2.5,
        post_processing_shelf_life_days: "0",
      }),
    ).toThrow(/shelf_life_days/);
  });

  it("does not coerce invalid shelf-life to null via formToDbProductPayload bypass", () => {
    expect(() => productEditDirectProductsRow({ shelf_life_days: -1 })).toThrow();
    const bypassPayload = formToDbProductPayload({ shelf_life_days: -1 });
    expect(bypassPayload.shelf_life_days).toBe(-1);
  });

  it("allows valid coerced shelf-life through the direct products-row gate", () => {
    const row = productEditDirectProductsRow({
      shelf_life_days: 90,
      frozen_shelf_life_days: 180,
      post_processing_shelf_life_days: 30,
    });
    expect(row.shelf_life_days).toBe(90);
    expect(row.frozen_shelf_life_days).toBe(180);
    expect(row.post_processing_shelf_life_days).toBe(30);
  });

  it("documents ProductEdit shelf-life numeric coercion fields", () => {
    expect(PRODUCT_EDIT_SHELF_LIFE_NUMERIC_FIELDS).toEqual([
      "shelf_life_days",
      "frozen_shelf_life_days",
      "post_processing_shelf_life_days",
    ]);
  });
});

describe("typed Full Editor direct content persistence", () => {
  it.each([
    ["500", "grams"],
    ["0.5", "kg"],
    [".5", "kg"],
  ])("writes %s %s as canonical grams without asserting a piece count", (quantity, unit) => {
    const row = productEditDirectProductsRow({
      qty_per_pack: quantity,
      qty_content_uom: unit,
      pcs_per_pack: quantity,
      net_weight_g: "300",
      description: "Preserve this description",
    });
    expect(row.net_weight_grams).toBe(500);
    expect(row.net_weight_g).toBe(500);
    expect(row).not.toHaveProperty("pcs_per_pack");
    expect(row.description).toBe("Preserve this description");
  });
  it("writes the current explicit whole-piece quantity over a stale form mirror", () => {
    expect(
      productEditDirectProductsRow({ qty_per_pack: "8", qty_content_uom: "pcs", pcs_per_pack: "6" })
        .pcs_per_pack,
    ).toBe(8);
  });
  it.each([
    ["1.5", "pcs"],
    ["6", "ml"],
    ["0", "kg"],
  ])("blocks invalid or unsupported direct content %s %s", (quantity, unit) => {
    expect(() =>
      productEditDirectProductsRow({ qty_per_pack: quantity, qty_content_uom: unit }),
    ).toThrow(/Cannot save pack content/);
  });
  it("reloads Core-approved canonical grams ahead of a stale legacy alias", () => {
    expect(dbRowToProductForm({ net_weight_grams: 500, net_weight_g: 300 }, {}).net_weight_g).toBe(
      "500",
    );
  });
});

it.each([
  ["600", 600],
  ["", null],
])(
  "keeps a manually edited legacy gram field synchronized with Core authority: %s",
  (input, expected) => {
    const row = productEditDirectProductsRow({ net_weight_g: input, pcs_per_pack: 6 });
    expect(row.net_weight_g).toBe(expected);
    expect(row.net_weight_grams).toBe(expected);
    expect(row.pcs_per_pack).toBe(6);
  },
);
