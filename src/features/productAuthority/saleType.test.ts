import { describe, expect, it } from "vitest";
import { getSaleTypeRequirements, productClassForSaleType, saleTypeFromForm } from "./saleType";

describe("getSaleTypeRequirements", () => {
  it("ready pack requires MRP, packaging, qty per pack, hero — but never pieces per kg", () => {
    const req = getSaleTypeRequirements("retail_ready_pack");
    expect(req.requiresMrp).toBe(true);
    expect(req.requiresPackaging).toBe(true);
    expect(req.requiresQtyPerPack).toBe(true);
    expect(req.requiresHeroImage).toBe(true);
    expect(req.requiresPiecesPerKg).toBe(false);
  });

  it("ready pack requires B2B price only when B2B is enabled", () => {
    expect(getSaleTypeRequirements("retail_ready_pack").requiresB2bPrice).toBe(false);
    expect(getSaleTypeRequirements("retail_ready_pack", { b2bEnabled: true }).requiresB2bPrice).toBe(true);
  });

  it("B2B/HoReCa requires B2B price and MOQ/carton logic, image optional", () => {
    const req = getSaleTypeRequirements("b2b_horeca");
    expect(req.requiresB2bPrice).toBe(true);
    expect(req.requiresMoqCartonLogic).toBe(true);
    expect(req.requiresHeroImage).toBe(false);
  });

  it("internal/BOM requires no customer-facing price, image, or packaging", () => {
    const req = getSaleTypeRequirements("internal_bom");
    expect(req.customerFacing).toBe(false);
    expect(req.requiresMrp).toBe(false);
    expect(req.requiresB2bPrice).toBe(false);
    expect(req.requiresHeroImage).toBe(false);
    expect(req.requiresPackaging).toBe(false);
  });

  it("export requires export price and export fields, not MRP", () => {
    const req = getSaleTypeRequirements("export");
    expect(req.requiresExportPrice).toBe(true);
    expect(req.requiresExportFields).toBe(true);
    expect(req.requiresMrp).toBe(false);
  });
});

describe("productClassForSaleType / saleTypeFromForm", () => {
  it("round-trips the classes that exist in schema", () => {
    expect(productClassForSaleType("retail_ready_pack")).toBe("ready_pack");
    expect(saleTypeFromForm({ product_class: "ready_pack" })).toBe("retail_ready_pack");
    expect(saleTypeFromForm({ product_class: "gift_hamper" })).toBe("gift_hamper");
    expect(saleTypeFromForm({ product_class: "bulk_loose_product" })).toBe("b2b_horeca");
  });

  it("returns null class for sale types without a persisted product_class", () => {
    expect(productClassForSaleType("export")).toBeNull();
    expect(productClassForSaleType("internal_bom")).toBeNull();
  });
});
