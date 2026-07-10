import { describe, expect, it } from "vitest";
import { pricingBlockers, resolvePricing } from "./pricingAuthority";

describe("resolvePricing", () => {
  it("recognizes product-row MRP and B2B price when no channel rules exist", () => {
    const pricing = resolvePricing({ mrp: "450", price_b2b: 380 });
    expect(pricing.mrp).toBe(450);
    expect(pricing.b2bPrice).toBe(380);
    expect(pricing.source).toBe("product_fields");
    expect(pricing.hasAnyPrice).toBe(true);
  });

  it("prefers approved channel rules over product fields", () => {
    const pricing = resolvePricing(
      { mrp: "450" },
      [{ channel: "retail", mrp: 499, sellingPrice: 499, priceStatus: "approved" }],
    );
    expect(pricing.mrp).toBe(499);
    expect(pricing.source).toBe("mixed");
  });

  it("ignores unapproved channel rules", () => {
    const pricing = resolvePricing({}, [{ channel: "b2b", sellingPrice: 300, priceStatus: "pending_approval" }]);
    expect(pricing.b2bPrice).toBeNull();
    expect(pricing.source).toBe("none");
  });

  it("treats blank/zero/invalid values as missing", () => {
    const pricing = resolvePricing({ mrp: "", price_b2b: 0, export_price: "abc" });
    expect(pricing.hasAnyPrice).toBe(false);
  });

  it("reads b2b_price form key as well as price_b2b db key", () => {
    expect(resolvePricing({ b2b_price: "275" }).b2bPrice).toBe(275);
  });
});

describe("pricingBlockers", () => {
  it("ready pack with MRP present has no pricing blockers", () => {
    const pricing = resolvePricing({ mrp: 450 });
    expect(pricingBlockers(pricing, "retail_ready_pack")).toEqual([]);
  });

  it("ready pack without MRP is blocked", () => {
    const pricing = resolvePricing({});
    expect(pricingBlockers(pricing, "retail_ready_pack")).toContain("MRP missing");
  });

  it("B2B enabled ready pack additionally requires B2B price", () => {
    const pricing = resolvePricing({ mrp: 450 });
    expect(pricingBlockers(pricing, "retail_ready_pack", { b2bEnabled: true })).toContain("B2B price missing");
  });

  it("internal products never demand customer-facing prices", () => {
    expect(pricingBlockers(resolvePricing({}), "internal_bom")).toEqual([]);
  });

  it("export price blocks only export sale type", () => {
    const pricing = resolvePricing({ mrp: 450, price_b2b: 380 });
    expect(pricingBlockers(pricing, "export")).toContain("Export price missing");
    expect(pricingBlockers(pricing, "retail_ready_pack")).toEqual([]);
  });
});
