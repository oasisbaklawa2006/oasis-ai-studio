import { describe, expect, it } from "vitest";
import {
  configuredChannels,
  mapMoqRules,
  mapPricingRules,
} from "./channelAuthorityMappers";
import { evaluateProductReadiness, productTruthInputFromForm } from "./productReadiness";
import { formToDbProductPayload } from "@/features/productAuthority/productSchemaAdapter";
import { mediaAssetsFromSources } from "@/features/mediaReadiness/mediaAssetsFromForm";
import { evaluateMediaReadiness } from "@/features/mediaReadiness/mediaReadinessEngine";
import { productMediaContextFromForm } from "@/features/mediaReadiness/mediaAssetsFromForm";

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

  it("save payload maps weight to live columns not Studio-only names", () => {
    const payload = formToDbProductPayload(savedForm);
    expect(payload.grams_per_piece).toBe(18);
    expect(payload.pcs_per_kg).toBe(55.56);
    expect(payload.approximate_piece_weight_g).toBeUndefined();
    expect(payload.b2b_price).toBeUndefined();
  });

  it("channel prices in truth input reflect product_pricing_rules mapper output", () => {
    const prices = mapPricingRules([
      { price_channel: "bulk", calculated_price: 2800, approval_status: "approved" },
    ]);
    const truth = productTruthInputFromForm(savedForm, { prices });
    expect(truth.prices?.[0]?.sellingPrice).toBe(2800);
  });

  it("Product Truth readiness consumes product_pricing_rules prices", () => {
    const prices = mapPricingRules([
      { price_channel: "b2b", calculated_price: 2800, approval_status: "approved" },
    ]);
    const truth = productTruthInputFromForm(savedForm, { prices });
    const readiness = evaluateProductReadiness(truth);
    const pricing = readiness.dimensions.find((d) => d.dimension === "pricing_status");
    expect(pricing?.complete).toBe(true);
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

  it("recognizes uploaded media types from product_media rows", () => {
    const assets = mediaAssetsFromSources({ form, productMediaRows: mediaRows });
    const types = new Set(assets.map((a) => a.type));
    expect(types.has("primary_image")).toBe(true);
    expect(types.has("catalogue_image")).toBe(true);
    expect(types.has("close_up_image")).toBe(true);
    expect(types.has("pairing_image")).toBe(true);
    expect(assets).toHaveLength(4);
  });

  it("Product Truth media readiness consumes product_media rows", () => {
    import.meta.env.VITE_MEDIA_GOVERNANCE_MODE = "production";
    const ctx = productMediaContextFromForm(form);
    const assets = mediaAssetsFromSources({ form, productMediaRows: mediaRows });
    const readiness = evaluateMediaReadiness(ctx, assets);
    expect(readiness.requiredAssets).toContain("catalogue_image");
    expect(readiness.canPublishMedia).toBe(false);
    expect(readiness.blockers.some((b) => b.includes("draft pending approval"))).toBe(true);
  });
});
