import { describe, expect, it } from "vitest";
import {
  CHANNEL_PRICING_BASIS_FORM_FIELD_KEYS,
  CHANNEL_PRICING_FORM_FIELD_KEYS,
  extractChannelPricingFromForm,
  formToDbProductPayload,
  LIVE_PRODUCTS_WRITE_ALLOWLIST,
  sanitizeLiveProductsPayload,
} from "@/features/productAuthority/productSchemaAdapter";

const FUZZ_FORM: Record<string, unknown> = {
  product_name: "Mor Pistachio Durum",
  sku: "OAS-AS-BKL-0024",
  category: "Baklawa",
  approximate_piece_weight_g: "18",
  pieces_per_kg: "55.56",
  hero_image_url: "https://cdn/hero.jpg",
  ingredients: "pistachio",
  allergen_warnings: "nuts",
  nutritional_info: "{}",
  compliance_meta_pending: true,
  alias_seed: ["durum"],
  media_assets: [{ type: "hero_image" }],
  random_unknown_field: "strip-me",
  department: "legacy",
  visible_in_catalog: true,
  ...Object.fromEntries(CHANNEL_PRICING_FORM_FIELD_KEYS.map((k) => [k, "100"])),
  ...Object.fromEntries(CHANNEL_PRICING_BASIS_FORM_FIELD_KEYS.map((k) => [k, "per kg"])),
};

describe("live products schema fuzz", () => {
  it("products payload contains only live allowed columns", () => {
    const payload = formToDbProductPayload(FUZZ_FORM);

    for (const key of Object.keys(payload)) {
      expect(LIVE_PRODUCTS_WRITE_ALLOWLIST.has(key)).toBe(true);
    }

    expect(payload.product_name).toBe("Mor Pistachio Durum");
    expect(payload.sku).toBe("OAS-AS-BKL-0024");
    expect(payload.grams_per_piece).toBe(18);
    expect(payload.pcs_per_kg).toBe(55.56);
  });

  it("strips all *_price and *_price_basis fields", () => {
    const payload = formToDbProductPayload(FUZZ_FORM);

    for (const key of Object.keys(payload)) {
      expect(key.endsWith("_price")).toBe(false);
      expect(key.endsWith("_price_basis")).toBe(false);
      expect(key).not.toBe("price_basis");
    }

    for (const key of CHANNEL_PRICING_FORM_FIELD_KEYS) {
      expect(payload[key]).toBeUndefined();
    }
    for (const key of CHANNEL_PRICING_BASIS_FORM_FIELD_KEYS) {
      expect(payload[key]).toBeUndefined();
    }
  });

  it("strips unknown, media, alias, and compliance metadata keys", () => {
    const payload = formToDbProductPayload(FUZZ_FORM);
    expect(payload.ingredients).toBeUndefined();
    expect(payload.alias_seed).toBeUndefined();
    expect(payload.media_assets).toBeUndefined();
    expect(payload.random_unknown_field).toBeUndefined();
    expect(payload.approximate_piece_weight_g).toBeUndefined();
    expect(payload.pieces_per_kg).toBeUndefined();
  });

  it("pricing mapper extracts channel pricing separately", () => {
    const rules = extractChannelPricingFromForm(FUZZ_FORM, "prod-0024");
    expect(rules.length).toBeGreaterThan(0);
    expect(rules.every((r) => r.product_id === "prod-0024")).toBe(true);
    expect(rules.every((r) => r.price_channel && r.base_price != null)).toBe(true);
    expect(new Set(rules.map((r) => r.price_channel)).size).toBe(rules.length);
  });

  it("sanitizeLiveProductsPayload is strict allowlist-only", () => {
    const { payload, stripped } = sanitizeLiveProductsPayload({
      product_name: "X",
      b2b_price_basis: "per kg",
      mystery: "nope",
    });
    expect(payload.product_name).toBe("X");
    expect(payload.b2b_price_basis).toBeUndefined();
    expect(stripped).toContain("b2b_price_basis");
    expect(stripped).toContain("mystery");
  });
});
