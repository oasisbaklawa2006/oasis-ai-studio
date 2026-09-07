import { describe, expect, it } from "vitest";
import { formToDbProductPayload } from "@/features/productAuthority/productSchemaAdapter";
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
