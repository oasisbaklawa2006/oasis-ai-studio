import { describe, expect, it } from "vitest";
import { evaluateProductReadiness } from "./productReadiness";
import type { ProductTruthInput } from "./types";

const completeInput: ProductTruthInput = {
  productName: "Test Product",
  heroImageUrl: "https://example.com/img.jpg",
  mediaStatus: "approved",
  mediaAssets: [
    {
      type: "primary_image",
      url: "https://example.com/img.jpg",
      status: "approved",
      source: "manual",
    },
    {
      type: "catalogue_image",
      url: "https://example.com/w.jpg",
      status: "approved",
      source: "manual",
    },
    {
      type: "close_up_image",
      url: "https://example.com/c.jpg",
      status: "approved",
      source: "manual",
    },
  ],
  mediaContext: {
    productName: "Test Product",
    category: "baklawa",
    isLegacy: false,
  },
  hsnCode: "18069090",
  gstRate: "5",
  complianceApproved: true,
  complianceMetaPending: false,
  primaryUom: "kg",
  mainDepartment: "ready_goods_store",
  productionDepartment: "dragees",
  packaging: { piecesPerKg: 40, kgPerTray: 1, traysPerMasterCarton: 8 },
  prices: [
    { channel: "mrp", priceStatus: "approved", mrp: 3600, currency: "INR" },
    { channel: "b2b", priceStatus: "approved", sellingPrice: 2800, currency: "INR" },
  ],
};

describe("productReadiness", () => {
  it("incomplete legacy product shows legacy_incomplete without throwing", () => {
    const r = evaluateProductReadiness({
      productName: "Old SKU",
      isLegacy: true,
    });
    expect(r.isLegacy).toBe(true);
    expect(r.readyForCentralSync).toBe(false);
    expect(r.badges).toContain("legacy_incomplete");
    expect(r.score).toBeLessThan(r.maxScore);
  });

  it("complete product passes central sync gate", () => {
    const r = evaluateProductReadiness(completeInput);
    expect(r.readyForCentralSync).toBe(true);
    expect(r.blockers).toHaveLength(0);
    expect(r.score).toBe(r.maxScore);
  });

  it("compliance missing blocks central sync", () => {
    const r = evaluateProductReadiness({
      ...completeInput,
      complianceApproved: false,
      complianceMetaPending: true,
    });
    expect(r.readyForCentralSync).toBe(false);
    expect(r.blockers.some((b) => b.toLowerCase().includes("compliance"))).toBe(true);
  });

  it("treats kg/grams-only selling as intrinsically convertible without pcs/kg", () => {
    const r = evaluateProductReadiness({
      ...completeInput,
      primaryUom: "kg",
      retailUom: "grams",
      b2bUom: "kg",
      packaging: {},
      weightOnlySelling: true,
    });
    const packaging = r.dimensions.find((d) => d.dimension === "packaging_status");
    expect(packaging?.complete).toBe(true);
    expect(r.blockers).not.toContain("Packaging conversion rules missing");
  });

  it("blocks central sync when variant hierarchy validation is invalid", () => {
    const r = evaluateProductReadiness({
      ...completeInput,
      variantHierarchyValidation: {
        valid: false,
        errors: ["A product cannot be its own basis product."],
        warnings: [],
      },
    });
    expect(r.readyForCentralSync).toBe(false);
    expect(r.blockers).toContain("A product cannot be its own basis product.");
  });

  it("does not block central sync when variant hierarchy validation is valid", () => {
    const r = evaluateProductReadiness({
      ...completeInput,
      variantHierarchyValidation: { valid: true, errors: [], warnings: [] },
    });
    expect(r.readyForCentralSync).toBe(true);
  });

  it("keeps mixed kg-to-piece selling blocked without piece conversion truth", () => {
    const r = evaluateProductReadiness({
      ...completeInput,
      primaryUom: "kg",
      retailUom: "pcs",
      b2bUom: "kg",
      packaging: {},
      weightOnlySelling: false,
    });
    const packaging = r.dimensions.find((d) => d.dimension === "packaging_status");
    expect(packaging?.complete).toBe(false);
    expect(r.blockers).toContain("Packaging conversion rules missing");
  });

  it("treats pc/pcs-only selling as intrinsic without pcs-per-pack", () => {
    const r = evaluateProductReadiness({
      ...completeInput,
      primaryUom: "pcs",
      retailUom: "pc",
      b2bUom: "pcs",
      packaging: {},
      pieceOnlySelling: true,
    });
    const packaging = r.dimensions.find((d) => d.dimension === "packaging_status");
    expect(packaging?.complete).toBe(true);
    expect(r.blockers).not.toContain("Packaging conversion rules missing");
  });

  it("accepts a container pack defined by governed pack weight", () => {
    const r = evaluateProductReadiness({
      ...completeInput,
      primaryUom: "pack",
      packaging: {},
      packBasedSelling: true,
      weightDefinedPack: true,
    });
    const packaging = r.dimensions.find((d) => d.dimension === "packaging_status");
    expect(packaging?.complete).toBe(true);
  });

  it("does not use pack weight to satisfy a piece-count selling unit", () => {
    const r = evaluateProductReadiness({
      ...completeInput,
      primaryUom: "pcs",
      packaging: {},
      packBasedSelling: true,
      weightDefinedPack: false,
    });
    const packaging = r.dimensions.find((d) => d.dimension === "packaging_status");
    expect(packaging?.complete).toBe(false);
  });
});
