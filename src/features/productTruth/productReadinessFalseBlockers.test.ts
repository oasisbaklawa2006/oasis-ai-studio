import { describe, expect, it } from "vitest";
import { evaluateProductReadiness, productTruthInputFromForm } from "./productReadiness";

/**
 * Regression tests for the two Product Truth false blockers:
 * 1. pricing dimension ignored product-row MRP/B2B values,
 * 2. packaging dimension demanded pieces-per-kg for pack-based (ready pack) products.
 */

const MISR15_FORM = {
  id: "test-id",
  product_name: "Misr 15",
  sku: "OAS-AS-BKL-ASS-PAPERBOX-0002",
  category: "Ready Packs",
  product_class: "ready_pack",
  primary_uom: "box",
  retail_uom: "box",
  b2b_uom: "carton",
  pcs_per_pack: 6,
  mrp: 450,
  price_b2b: 380,
  pack_size: "6 pcs box",
  hero_image_url: "https://x/hero.jpg",
};

describe("pricing dimension — product-row price recognition", () => {
  it("MRP + B2B on the product row completes pricing without channel rules", () => {
    const input = productTruthInputFromForm(MISR15_FORM);
    const result = evaluateProductReadiness(input);
    const pricing = result.dimensions.find((d) => d.dimension === "pricing_status");
    expect(pricing?.complete).toBe(true);
    expect(result.blockers).not.toContain("Pricing missing or pending approval");
  });

  it("no prices anywhere still blocks pricing", () => {
    const input = productTruthInputFromForm({ ...MISR15_FORM, mrp: "", price_b2b: "" });
    const result = evaluateProductReadiness(input);
    const pricing = result.dimensions.find((d) => d.dimension === "pricing_status");
    expect(pricing?.complete).toBe(false);
  });
});

describe("packaging dimension — pack-based selling", () => {
  it("ready pack with qty-per-pack completes packaging without pieces/kg", () => {
    const input = productTruthInputFromForm(MISR15_FORM);
    const result = evaluateProductReadiness(input);
    const packaging = result.dimensions.find((d) => d.dimension === "packaging_status");
    expect(packaging?.complete).toBe(true);
  });

  it("ready pack without qty-per-pack asks for qty per pack, not pieces/kg", () => {
    const input = productTruthInputFromForm({ ...MISR15_FORM, pcs_per_pack: "" });
    const result = evaluateProductReadiness(input);
    const packaging = result.dimensions.find((d) => d.dimension === "packaging_status");
    expect(packaging?.complete).toBe(false);
    expect(packaging?.note).toBe("Qty per pack missing");
  });

  it("weight-based products still require pieces/kg or grams/piece", () => {
    const input = productTruthInputFromForm({
      ...MISR15_FORM,
      primary_uom: "kg",
      retail_uom: "kg",
      b2b_uom: "kg",
      pcs_per_pack: "",
    });
    const result = evaluateProductReadiness(input);
    const packaging = result.dimensions.find((d) => d.dimension === "packaging_status");
    expect(packaging?.complete).toBe(false);
  });
});
