import { describe, expect, it } from "vitest";
import { resolveFastCreateSkuCodes } from "./fastCreateSkuCodes";
import { formToDbProductPayload } from "@/features/productAuthority/productSchemaAdapter";

describe("fastCreateSkuCodes", () => {
  it("maps baklawa preset to AS/BKL taxonomy codes", () => {
    const codes = resolveFastCreateSkuCodes("baklawa");
    expect(codes).toEqual({
      division_code: "AS",
      category_code: "BKL",
      subcategory_code: "ASS",
      packaging_code: "LOOSE",
    });
  });

  it("persists all four SKU code fields on product payload", () => {
    const codes = resolveFastCreateSkuCodes("baklawa");
    const payload = formToDbProductPayload({
      product_name: "Classic Pistachio Midya",
      sku: "OAS-AS-BKL-ASS-LOOSE-0001",
      ...codes,
      sku_generated_at: "2026-06-22T12:00:00.000Z",
    });
    expect(payload.division_code).toBe("AS");
    expect(payload.category_code).toBe("BKL");
    expect(payload.subcategory_code).toBe("ASS");
    expect(payload.packaging_code).toBe("LOOSE");
    expect(payload.sku_generated_at).toBe("2026-06-22T12:00:00.000Z");
  });
});
