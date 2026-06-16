import { describe, expect, it } from "vitest";
import {
  CHANNEL_PRICING_BASIS_FORM_FIELD_KEYS,
  extractChannelPricingFromForm,
  formToDbProductPayload,
  formatProductSaveError,
  findPricingLeaksInProductPayload,
  productSaveValidationMessage,
  resolveCentralLegacyProductName,
  stripUnknownProductFields,
  validateProductSavePayload,
} from "@/features/productAuthority/productSchemaAdapter";
import { assertStructuredSkuForSave, isDraftSku } from "@/features/productAuthority/skuGuard";
import { FAST_CREATE_SKU_BLOCK_MESSAGE } from "@/features/fastCreate/saveFastCreateProduct";
import { heroUrlWritePayload } from "@/lib/productImage";
import { applyPrefeedSuggestions, buildCategoryPrefeed } from "@/features/productDefaults/categoryPrefeed";
import { PILOT_COLLISION_HINTS } from "@/features/productAuthority/pilotCollisionHints";
import { PILOT_SKUS } from "@/features/productAuthority/skuGuard";

describe("productSchemaAdapter", () => {
  it("maps form to Studio columns (not Central legacy names)", () => {
    const payload = formToDbProductPayload({
      product_name: "Cashew Kitta",
      subcategory: "Baklawa",
      b2b_price: "100",
      mrp: "250",
      gst_rate: "18",
      main_department: "ready_goods_store",
      production_department: "arabic_sweets",
      hero_image_url: "https://example.com/h.jpg",
      sku: "OAS-AS-BKL-0001-0001",
    });
    expect(payload.product_name).toBe("Cashew Kitta");
    expect(payload.name).toBe("Cashew Kitta");
    expect(payload.subcategory).toBe("Baklawa");
    expect(payload.b2b_price).toBeUndefined();
    expect(payload.mrp).toBeUndefined();
    expect(payload.price_b2b).toBeUndefined();
    expect(payload.sub_category).toBeUndefined();
    expect(payload.hero_image_url).toBe("https://example.com/h.jpg");
    expect(payload.image_url).toBe("https://example.com/h.jpg");
  });

  it("strips b2b_price_basis from products payload", () => {
    const payload = formToDbProductPayload({
      product_name: "Mor Pistachio Durum",
      sku: "OAS-AS-BKL-0024",
      b2b_price_basis: "per kg",
      retail_price_basis: "per pc",
      price_basis: "per kg",
    });
    expect(payload.b2b_price_basis).toBeUndefined();
    expect(payload.retail_price_basis).toBeUndefined();
    expect(payload.price_basis).toBeUndefined();
    expect(findPricingLeaksInProductPayload(payload)).toEqual([]);
  });

  it("strips all price_basis fields from products payload", () => {
    const form = Object.fromEntries(
      CHANNEL_PRICING_BASIS_FORM_FIELD_KEYS.map((k) => [k, "per kg"]),
    );
    const payload = formToDbProductPayload({
      product_name: "Mor Pistachio Durum",
      sku: "OAS-AS-BKL-0024",
      ...form,
    });
    for (const key of CHANNEL_PRICING_BASIS_FORM_FIELD_KEYS) {
      expect(payload[key]).toBeUndefined();
    }
  });

  it("strips b2b_price from products payload", () => {
    const payload = formToDbProductPayload({
      product_name: "Mor Pistachio Durum",
      sku: "OAS-AS-BKL-0024",
      b2b_price: "1200",
    });
    expect(payload.b2b_price).toBeUndefined();
    expect(findPricingLeaksInProductPayload(payload)).toEqual([]);
  });

  it("strips all channel pricing fields from products payload", () => {
    const form = {
      product_name: "Mor Pistachio Durum",
      sku: "OAS-AS-BKL-0024",
      b2b_price: "1200",
      mrp: "1500",
      mrp_price: "1500",
      retail_price: "1400",
      bulk_price: "1200",
      wholesale_price: "1050",
      horeca_price: "1000",
      export_price: "18",
      franchisee_price: "1100",
      own_outlet_price: "1150",
      special_price: "1080",
      costing_price: "800",
    };
    const payload = formToDbProductPayload(form);
    expect(findPricingLeaksInProductPayload(payload)).toEqual([]);
    for (const key of [
      "b2b_price",
      "mrp",
      "mrp_price",
      "retail_price",
      "bulk_price",
      "wholesale_price",
      "horeca_price",
      "export_price",
      "franchisee_price",
      "own_outlet_price",
      "special_price",
      "costing_price",
    ]) {
      expect(payload[key]).toBeUndefined();
    }
  });

  it("maps channel pricing form fields to product_pricing_rules separately", () => {
    const productId = "prod-uuid-0024";
    const rules = extractChannelPricingFromForm(
      {
        mrp: "1500",
        b2b_price: "1200",
        bulk_price: "1200",
        wholesale_price: "1050",
        export_price: "18",
        currency: "INR",
        primary_uom: "KG",
      },
      productId,
    );
    const channels = rules.map((r) => r.price_channel).sort();
    expect(channels).toEqual(["b2b", "bulk", "export", "mrp", "wholesale"]);
    const mrpRule = rules.find((r) => r.price_channel === "mrp");
    expect(mrpRule?.product_id).toBe(productId);
    expect(mrpRule?.base_price).toBe(1500);
    expect(mrpRule?.calculated_price).toBe(1500);
    expect(mrpRule?.price_type).toBe("fixed_price");
    expect(mrpRule?.uom).toBe("KG");
  });

  it("strips unknown fields", () => {
    const { payload, stripped } = stripUnknownProductFields({
      product_name: "Test",
      ingredients: "nuts",
      allergen_warnings: "nuts",
      visible_in_catalog: true,
      department: "x",
    });
    expect(payload.product_name).toBe("Test");
    expect(stripped).toContain("ingredients");
    expect(stripped).toContain("visible_in_catalog");
    expect(stripped).toContain("department");
  });

  it("always maps Central legacy name on create payload", () => {
    const payload = formToDbProductPayload({
      product_name: "Bourma Pistachio",
      sku: "OAS-AS-BKL-0099-0001",
    });
    expect(payload.name).toBe("Bourma Pistachio");
    expect(payload.product_name).toBe("Bourma Pistachio");
  });

  it("falls back Central legacy name from short_name then sku", () => {
    expect(
      resolveCentralLegacyProductName({ short_name: "Bourma", sku: "OAS-AS-BKL-0099-0001" }),
    ).toBe("Bourma");
    expect(resolveCentralLegacyProductName({ sku: "OAS-AS-BKL-0099-0001" })).toBe(
      "OAS-AS-BKL-0099-0001",
    );
    expect(resolveCentralLegacyProductName({})).toBe("Untitled Product");
  });

  it("validates required fields on create", () => {
    const bad = validateProductSavePayload({ product_name: "A" }, "create");
    expect(bad.ok).toBe(false);
    expect(bad.missing).toContain("sku");

    const missingName = validateProductSavePayload({ sku: "OAS-AS-BKL-0001-0001" }, "create");
    expect(missingName.ok).toBe(false);
    expect(missingName.missing).toContain("product_name");
    expect(productSaveValidationMessage(missingName)).toBe("Product name is required.");

    const good = validateProductSavePayload(
      {
        product_name: "A",
        sku: "OAS-AS-BKL-0001-0001",
        main_department: "packing_assembly",
      },
      "create",
    );
    expect(good.ok).toBe(true);
  });

  it("does not send Studio-only approximate_piece_weight_g to Supabase", () => {
    const payload = formToDbProductPayload({
      product_name: "Mor Pistachio Durum",
      sku: "OAS-AS-BKL-0024",
      approximate_piece_weight_g: "18",
      pieces_per_kg: "55.56",
      pack_size: "500g",
      moq_value: "1",
      moq_uom: "KG",
    });
    expect(payload.approximate_piece_weight_g).toBeUndefined();
    expect(payload.pieces_per_kg).toBeUndefined();
    expect(payload.grams_per_piece).toBe(18);
    expect(payload.pcs_per_kg).toBe(55.56);
  });

  it("derives pcs_per_kg from grams_per_piece when pieces_per_kg omitted", () => {
    const payload = formToDbProductPayload({
      product_name: "Mor Pistachio Durum",
      sku: "OAS-AS-BKL-0024",
      approximate_piece_weight_g: "20",
    });
    expect(payload.grams_per_piece).toBe(20);
    expect(payload.pcs_per_kg).toBe(50);
  });

  it("maps packaging MOQ fields only to live columns", () => {
    const payload = formToDbProductPayload({
      product_name: "Mor Pistachio Durum",
      sku: "OAS-AS-BKL-0024",
      moq_value: "2",
      moq_uom: "KG",
      increment_value: "0.5",
      increment_uom: "KG",
      pcs_per_pack: "12",
      pcs_per_carton: "50",
      carton_qty: "6",
    });
    expect(payload.moq_value).toBe(2);
    expect(payload.moq_uom).toBe("KG");
    expect(payload.pcs_per_pack).toBe(12);
    expect(payload.pcs_per_carton).toBe(50);
    expect(payload.carton_qty).toBe(6);
  });

  it("formats PGRST204 schema mismatch with actionable message", () => {
    const message = formatProductSaveError({
      message:
        "Could not find the 'approximate_piece_weight_g' column of 'products' in the schema cache",
      code: "PGRST204",
    });
    expect(message).toContain("approximate_piece_weight_g");
    expect(message).toContain("Live schema mismatch");
  });

  it("formats pricing basis PGRST204 with field and table", () => {
    const message = formatProductSaveError({
      message: "Could not find the 'b2b_price_basis' column of 'products' in the schema cache",
      code: "PGRST204",
    });
    expect(message).toContain("b2b_price_basis");
    expect(message).toContain("products");
  });
});

describe("skuGuard", () => {
  it("blocks DRAFT-* SKU", () => {
    expect(isDraftSku("DRAFT-ABCDEF12")).toBe(true);
    const r = assertStructuredSkuForSave("DRAFT-ABCDEF12");
    expect(r.ok).toBe(false);
  });

  it("allows structured OAS SKU", () => {
    const r = assertStructuredSkuForSave("OAS-AS-BKL-0001-0001");
    expect(r.ok).toBe(true);
  });

  it("blocks OAS-FC fallback pattern", () => {
    const r = assertStructuredSkuForSave("OAS-FC-ABC123");
    expect(r.ok).toBe(false);
  });
});

describe("fastCreateSkuGuard", () => {
  it("documents block message for missing RPC", () => {
    expect(FAST_CREATE_SKU_BLOCK_MESSAGE).toMatch(/generate_oasis_sku/);
    expect(FAST_CREATE_SKU_BLOCK_MESSAGE).toMatch(/DRAFT/);
  });
});

describe("heroUrlWritePayload", () => {
  it("syncs hero_image_url and image_url", () => {
    expect(heroUrlWritePayload("https://x/y.png")).toEqual({
      hero_image_url: "https://x/y.png",
      image_url: "https://x/y.png",
    });
  });
});

describe("pilotCollisionHints", () => {
  it("covers all 5 pilot SKUs", () => {
    for (const sku of PILOT_SKUS) {
      expect(PILOT_COLLISION_HINTS[sku]).toBeDefined();
      expect(PILOT_COLLISION_HINTS[sku].notes.length).toBeGreaterThan(0);
    }
  });
});

describe("categoryPrefeed", () => {
  it("suggests HSN/GST with review flag", () => {
    const bundle = buildCategoryPrefeed("baklawa", "Baklawa");
    const hsn = bundle.fields.find((f) => f.key === "hsn_code");
    expect(hsn?.value).toBe("19059090");
    expect(hsn?.needsReview).toBe(true);
    expect(bundle.disclaimer).toMatch(/Suggested defaults/i);
  });

  it("applies prefeed only to empty fields", () => {
    const out = applyPrefeedSuggestions({ product_name: "X", hsn_code: "9999" }, "baklawa");
    expect(out.hsn_code).toBe("9999");
    expect(out.gst_rate).toBe("18");
  });
});
