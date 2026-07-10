import { describe, expect, it } from "vitest";
import { catalogueReadyBlockedMessage, evaluateCatalogueReadyGate } from "./catalogueReadyGate";
import { resolvePricing } from "./pricingAuthority";

const READY_INPUT = {
  sku: "OAS-AS-BKL-ASS-PAPERBOX-0002",
  saleType: "retail_ready_pack" as const,
  pricing: resolvePricing({ mrp: 450, price_b2b: 380 }),
  packagingPresent: true,
  heroImageUrl: "https://example.com/hero.jpg",
  truthScore: 7,
  truthMaxScore: 8,
};

describe("evaluateCatalogueReadyGate", () => {
  it("allows a fully-ready retail pack", () => {
    const result = evaluateCatalogueReadyGate(READY_INPUT);
    expect(result.allowed).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it("blocks invalid SKU with an explicit reason", () => {
    const result = evaluateCatalogueReadyGate({ ...READY_INPUT, sku: "DRAFT-123" });
    expect(result.allowed).toBe(false);
    expect(result.blockers.join(" ")).toContain("SKU invalid");
  });

  it("blocks missing MRP for a sale product", () => {
    const result = evaluateCatalogueReadyGate({ ...READY_INPUT, pricing: resolvePricing({}) });
    expect(result.allowed).toBe(false);
    expect(result.blockers).toContain("MRP missing");
  });

  it("blocks missing packaging and missing hero image", () => {
    const result = evaluateCatalogueReadyGate({
      ...READY_INPUT,
      packagingPresent: false,
      heroImageUrl: null,
    });
    expect(result.blockers).toContain("Packaging missing");
    expect(result.blockers).toContain("Hero image missing");
  });

  it("blocks Product Truth below the 70% threshold", () => {
    const result = evaluateCatalogueReadyGate({ ...READY_INPUT, truthScore: 5, truthMaxScore: 8 });
    expect(result.allowed).toBe(false);
    expect(result.blockers.join(" ")).toContain("below 70% threshold");
  });

  it("passes through Central preview blockers", () => {
    const result = evaluateCatalogueReadyGate({ ...READY_INPUT, centralBlockers: ["SKU not mapped"] });
    expect(result.blockers).toContain("Central preview: SKU not mapped");
  });

  it("internal products can never be catalogue-ready", () => {
    const result = evaluateCatalogueReadyGate({ ...READY_INPUT, saleType: "internal_bom" });
    expect(result.allowed).toBe(false);
  });

  it("formats the exact blocked message", () => {
    const result = evaluateCatalogueReadyGate({
      ...READY_INPUT,
      pricing: resolvePricing({}),
      heroImageUrl: null,
    });
    const msg = catalogueReadyBlockedMessage(result);
    expect(msg).toMatch(/^Cannot mark catalogue-ready\. Missing: /);
    expect(msg).toContain("MRP missing");
    expect(msg).toContain("Hero image missing");
  });
});
