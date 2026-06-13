import { describe, expect, it } from "vitest";
import {
  configuredChannels,
  mapMoqRules,
  mapPricingRules,
} from "./channelAuthorityMappers";
import { packagingHierarchyFromForm, productMoqFromForm, NOT_CONFIGURED } from "./packagingTruth";
import { productTruthInputFromForm } from "./productReadiness";
import { formToDbProductPayload } from "@/features/productAuthority/productSchemaAdapter";
import { mediaAssetsFromSources } from "@/features/mediaReadiness/mediaAssetsFromForm";
import { evaluateMediaReadiness } from "@/features/mediaReadiness/mediaReadinessEngine";
import { productMediaContextFromForm } from "@/features/mediaReadiness/mediaAssetsFromForm";

describe("packagingTruth authority", () => {
  it("does not infer trays per master carton when unset", () => {
    const form = {
      moq_value: 9,
      moq_uom: "tray",
      master_carton_qty: "",
    };
    const hierarchy = packagingHierarchyFromForm(form);
    expect(hierarchy.traysPerMasterCarton).toBeNull();
    expect(productMoqFromForm(form).moqValue).toBe(9);
    expect(productMoqFromForm(form).moqUom).toBe("tray");
  });

  it("reads master carton qty only from persisted field", () => {
    const hierarchy = packagingHierarchyFromForm({ master_carton_qty: 12 });
    expect(hierarchy.traysPerMasterCarton).toBe(12);
  });

  it("does not default piecesPerKg to 40", () => {
    const hierarchy = packagingHierarchyFromForm({});
    expect(hierarchy.piecesPerKg).toBeNull();
  });
});

describe("channel authority mappers", () => {
  it("maps pricing rows to Product Truth channel records", () => {
    const prices = mapPricingRules([
      {
        price_channel: "bulk",
        calculated_price: 2800,
        currency: "INR",
        approval_status: "approved",
      },
      {
        price_channel: "mrp",
        base_price: 3600,
        approval_status: "draft",
      },
      {
        price_channel: "wholesale",
        calculated_price: 2450,
        approval_status: "approved",
      },
    ]);
    expect(prices).toHaveLength(3);
    const bulk = prices.find((p) => p.channel === "bulk");
    expect(bulk?.sellingPrice).toBe(2800);
    expect(configuredChannels(prices, [])).toEqual(["bulk", "mrp", "wholesale"]);
  });

  it("maps moq rows with snake_case to camelCase truth model", () => {
    const rules = mapMoqRules([
      {
        channel: "b2b",
        moq_applicable: true,
        moq_value: 9,
        moq_uom: "tray",
        increment_value: 1,
        increment_uom: "tray",
      },
    ]);
    expect(rules[0]?.moqApplicable).toBe(true);
    expect(rules[0]?.moqValue).toBe(9);
    expect(rules[0]?.moqUom).toBe("tray");
  });
});

describe("product truth vs product edit source parity", () => {
  const savedForm = {
    id: "prod-1",
    product_name: "Mor Pistachio Durum",
    sku: "OAS-AS-BKL-0024",
    category: "Baklawa",
    subcategory: "Durum",
    primary_uom: "kg",
    moq_value: 9,
    moq_uom: "tray",
    approximate_piece_weight_g: 18,
    pieces_per_kg: 55.56,
    master_carton_qty: "",
    hsn_code: "19059090",
    gst_rate: "18",
    hero_image_url: "https://cdn/hero.jpg",
  };

  it("packaging truth matches form fields without hidden defaults", () => {
    const truth = productTruthInputFromForm(savedForm);
    expect(truth.packaging?.traysPerMasterCarton).toBeNull();
    expect(truth.packaging?.piecesPerKg).toBe(55.56);
    expect(truth.packaging?.gramsPerPiece).toBe(18);
  });

  it("save payload maps weight to live columns not Studio-only names", () => {
    const payload = formToDbProductPayload(savedForm);
    expect(payload.grams_per_piece).toBe(18);
    expect(payload.pcs_per_kg).toBe(55.56);
    expect(payload.approximate_piece_weight_g).toBeUndefined();
  });

  it("channel prices in truth input reflect DB mapper output", () => {
    const prices = mapPricingRules([
      { price_channel: "bulk", calculated_price: 2800, approval_status: "approved" },
    ]);
    const truth = productTruthInputFromForm(savedForm, { prices });
    expect(truth.prices?.[0]?.sellingPrice).toBe(2800);
  });
});

describe("media authority parity", () => {
  const form = {
    category: "Baklawa",
    subcategory: "Durum",
    sku: "OAS-AS-BKL-0024",
  };

  const mediaRows = [
    { type: "hero_image", file_url: "https://cdn/a.jpg", status: "raw" },
    { type: "white_background", file_url: "https://cdn/b.jpg", status: "raw" },
    { type: "closeup", file_url: "https://cdn/c.jpg", status: "raw" },
    { type: "lifestyle", file_url: "https://cdn/d.jpg", status: "raw" },
  ];

  it("recognizes all four uploaded media types from product_media", () => {
    const assets = mediaAssetsFromSources({ form, productMediaRows: mediaRows });
    const types = new Set(assets.map((a) => a.type));
    expect(types.has("primary_image")).toBe(true);
    expect(types.has("catalogue_image")).toBe(true);
    expect(types.has("close_up_image")).toBe(true);
    expect(types.has("lifestyle_image")).toBe(true);
    expect(assets).toHaveLength(4);
  });

  it("baklawa profile requires hero, white background, closeup — not lifestyle", () => {
    const ctx = productMediaContextFromForm(form);
    const readiness = evaluateMediaReadiness(ctx, mediaAssetsFromSources({ form, productMediaRows: mediaRows }));
    expect(readiness.requiredAssets).toContain("catalogue_image");
    expect(readiness.requiredAssets).not.toContain("lifestyle_image");
    expect(readiness.canPublishMedia).toBe(false);
    expect(readiness.blockers.some((b) => b.includes("draft pending approval"))).toBe(true);
  });
});

describe("display formatting", () => {
  it("uses Not configured for missing packaging values", () => {
    expect(NOT_CONFIGURED).toBe("Not configured");
    const hierarchy = packagingHierarchyFromForm({});
    expect(hierarchy.kgPerTray).toBeNull();
  });
});
