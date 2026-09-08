import { describe, expect, it } from "vitest";
import {
  emptyFastCreateDraft,
  fastCreateFormPatchFromDraft,
} from "@/features/fastCreate/fastCreateDraft";
import { FAST_CREATE_SKU_BLOCK_MESSAGE } from "@/features/fastCreate/saveFastCreateProduct";
import { PILOT_COLLISION_HINTS } from "@/features/productAuthority/pilotCollisionHints";
import {
  CHANNEL_PRICING_BASIS_FORM_FIELD_KEYS,
  dbRowToProductForm,
  extractChannelPricingFromForm,
  findPricingLeaksInProductPayload,
  formatProductSaveError,
  formToDbProductPayload,
  productSaveValidationMessage,
  resolveCentralLegacyProductName,
  sanitizeLiveProductsPayload,
  stripUnknownProductFields,
  validateProductSavePayload,
} from "@/features/productAuthority/productSchemaAdapter";
import {
  assertStructuredSkuForSave,
  isDraftSku,
  PILOT_SKUS,
} from "@/features/productAuthority/skuGuard";
import {
  applyPrefeedSuggestions,
  buildCategoryPrefeed,
} from "@/features/productDefaults/categoryPrefeed";
import { heroUrlWritePayload } from "@/lib/productImage";

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

  it("does not map intake_barcode to barcode_sku without Core claim authority", () => {
    const payload = formToDbProductPayload({
      product_name: "Scanned Product",
      sku: "OAS-AS-BKL-0001-0001",
      intake_barcode: "5901234123457",
    });
    expect(payload.barcode_sku).toBeNull();
  });

  it("Full Editor handoff cannot bypass Core barcode claim from draft intake_barcode", () => {
    const draft = emptyFastCreateDraft();
    draft.intakeBarcode = "5901234123457";

    const editorForm = fastCreateFormPatchFromDraft(draft);
    expect(editorForm.intake_barcode).toBe("5901234123457");
    expect(editorForm.barcode_sku).toBeUndefined();

    const payload = formToDbProductPayload(editorForm);
    expect(payload.barcode_sku).toBeNull();
  });

  it("persists barcode_sku only when caller already set it after Core claim", () => {
    const payload = formToDbProductPayload({
      product_name: "Claimed Product",
      sku: "OAS-AS-BKL-0001-0001",
      barcode_sku: "5901234123457",
    });
    expect(payload.barcode_sku).toBe("5901234123457");
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

  it("persists approved composition fields on products row", () => {
    const payload = formToDbProductPayload({
      product_name: "Test",
      sku: "OAS-AS-BKL-0001-0001",
      ingredients: "cashew, sugar",
      allergen_warnings: "nuts",
      nutritional_info: "Per 100g draft",
    });
    expect(payload.ingredients).toBe("cashew, sugar");
    expect(payload.allergen_warnings).toBe("nuts");
    expect(payload.nutrition_facts).toBe("Per 100g draft");
  });

  it("strips unknown legacy fields but keeps composition columns", () => {
    const { payload, stripped } = stripUnknownProductFields({
      product_name: "Test",
      ingredients: "nuts",
      allergen_warnings: "nuts",
      visible_in_catalog: true,
      department: "x",
    });
    expect(payload.product_name).toBe("Test");
    expect(payload.ingredients).toBe("nuts");
    expect(stripped).toContain("visible_in_catalog");
    expect(stripped).toContain("department");
  });

  it("strips studio-only sku_generated_at for live Central writes", () => {
    const { payload, stripped } = stripUnknownProductFields({
      product_name: "Test",
      sku: "OAS-AS-BKL-0001",
      sku_generated_at: "2026-06-22T12:00:00.000Z",
    });
    expect(payload.sku).toBe("OAS-AS-BKL-0001");
    expect(payload).not.toHaveProperty("sku_generated_at");
    expect(stripped).toContain("sku_generated_at");
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

  it("maps product lead_time_days via live compat column (Core #209)", () => {
    const payload = formToDbProductPayload({
      product_name: "Export Baklawa",
      sku: "OAS-AS-BKL-0024",
      lead_time_days: "14",
    });
    expect(payload.lead_time_days).toBe(14);
  });

  it("round-trips product lead_time_days through dbRowToProductForm (Core #209)", () => {
    const form = dbRowToProductForm(
      { product_name: "Export", sku: "OAS-X", lead_time_days: 21 },
      {},
    );
    expect(form.lead_time_days).toBe("21");
    const payload = formToDbProductPayload(form);
    expect(payload.lead_time_days).toBe(21);
  });

  it("maps Point37 live legal label columns via compat columns (Core production recert)", () => {
    const payload = formToDbProductPayload({
      product_name: "Export Baklawa",
      sku: "OAS-AS-BKL-0024",
      fssai_licence_number: "10012345678901",
      country_of_origin: "India",
      label_manufacturer_details: "Oasis Foods Pvt Ltd, Mumbai",
    });
    expect(payload.fssai_licence_number).toBe("10012345678901");
    expect(payload.country_of_origin).toBe("India");
    expect(payload.label_manufacturer_details).toBe("Oasis Foods Pvt Ltd, Mumbai");
  });

  it("round-trips Point37 live legal label columns through dbRowToProductForm", () => {
    const form = dbRowToProductForm(
      {
        product_name: "Export",
        sku: "OAS-X",
        fssai_licence_number: "10012345678901",
        country_of_origin: "India",
        label_manufacturer_details: "Oasis Foods Pvt Ltd, Mumbai",
      },
      {},
    );
    expect(form.fssai_licence_number).toBe("10012345678901");
    expect(form.country_of_origin).toBe("India");
    expect(form.label_manufacturer_details).toBe("Oasis Foods Pvt Ltd, Mumbai");
    const payload = formToDbProductPayload(form);
    expect(payload.fssai_licence_number).toBe("10012345678901");
    expect(payload.country_of_origin).toBe("India");
    expect(payload.label_manufacturer_details).toBe("Oasis Foods Pvt Ltd, Mumbai");
  });

  it("maps structured dimensions and gram weights to live products columns", () => {
    const payload = formToDbProductPayload({
      product_name: "Gift Box",
      sku: "OAS-AS-BKL-0001-0001",
      dimension_l_cm: "22",
      dimension_w_cm: "18",
      dimension_h_cm: "6",
      net_weight_g: "500",
      gross_weight_g: "550",
    });
    expect(payload.dimension_l_cm).toBe(22);
    expect(payload.dimension_w_cm).toBe(18);
    expect(payload.dimension_h_cm).toBe(6);
    expect(payload.product_dimensions_cm).toBe("L 22 cm × W 18 cm × H 6 cm");
    expect(payload.net_weight_g).toBe(500);
    expect(payload.gross_weight_g).toBe(550);
  });

  it("persists derived CBM and carton dimensions on live save after Core #199", () => {
    const payload = formToDbProductPayload({
      product_name: "Gift Box",
      sku: "OAS-AS-BKL-0001-0001",
      dimension_l_cm: "100",
      dimension_w_cm: "100",
      dimension_h_cm: "100",
      fixed_carton_required: true,
    });
    expect(payload.cbm).toBe(1);
    expect(payload.carton_dimensions_cm).toBe("L 100 cm × W 100 cm × H 100 cm");
    expect(payload.dimension_l_cm).toBe(100);
  });

  it("persists explicit carton_dimensions_cm text on live save", () => {
    const payload = formToDbProductPayload({
      product_name: "Gift Box",
      sku: "OAS-AS-BKL-0001-0001",
      carton_dimensions_cm: "L 40 cm × W 30 cm × H 20 cm",
    });
    expect(payload.carton_dimensions_cm).toBe("L 40 cm × W 30 cm × H 20 cm");
    expect(payload.product_dimensions_cm).toBeNull();
  });

  it("recomputes derived fields when structured dimensions change on edit", () => {
    const payload = formToDbProductPayload({
      product_name: "Gift Box",
      sku: "OAS-AS-BKL-0001-0001",
      dimension_l_cm: "50",
      dimension_w_cm: "40",
      dimension_h_cm: "30",
      product_dimensions_cm: "L 10 cm × W 10 cm × H 10 cm",
      carton_dimensions_cm: "L 10 cm × W 10 cm × H 10 cm",
      cbm: 0.001,
      fixed_carton_required: true,
    });
    expect(payload.product_dimensions_cm).toBe("L 50 cm × W 40 cm × H 30 cm");
    expect(payload.carton_dimensions_cm).toBe("L 50 cm × W 40 cm × H 30 cm");
    expect(payload.cbm).toBe(0.06);
  });

  it("does not fabricate CBM when dimensions are incomplete", () => {
    const payload = formToDbProductPayload({
      product_name: "Gift Box",
      sku: "OAS-AS-BKL-0001-0001",
      dimension_l_cm: "100",
      dimension_w_cm: "100",
    });
    expect(payload.cbm).toBeNull();
  });

  it("clears stale hydrated CBM when one structured dimension is removed", () => {
    const payload = formToDbProductPayload({
      product_name: "Gift Box",
      sku: "OAS-AS-BKL-0001-0001",
      dimension_l_cm: "100",
      dimension_w_cm: "100",
      dimension_h_cm: "",
      cbm: 1,
    });
    expect(payload.cbm).toBeNull();
  });

  it("clears stale hydrated dims and CBM when all structured dimensions are cleared", () => {
    const payload = formToDbProductPayload({
      product_name: "Gift Box",
      sku: "OAS-AS-BKL-0001-0001",
      dimension_l_cm: "",
      dimension_w_cm: "",
      dimension_h_cm: "",
      product_dimensions_cm: "L 10 cm × W 10 cm × H 10 cm",
      cbm: 0.001,
    });
    expect(payload.product_dimensions_cm).toBeNull();
    expect(payload.cbm).toBeNull();
  });

  it("uses partial structured text instead of stale hydrated product_dimensions_cm", () => {
    const payload = formToDbProductPayload({
      product_name: "Gift Box",
      sku: "OAS-AS-BKL-0001-0001",
      dimension_l_cm: "22",
      dimension_w_cm: "",
      dimension_h_cm: "6",
      product_dimensions_cm: "L 10 cm × W 10 cm × H 10 cm",
    });
    expect(payload.product_dimensions_cm).toBe("L 22 cm × H 6 cm");
  });

  it("clears stale hydrated carton_dimensions_cm when fixed-carton dims are cleared", () => {
    const payload = formToDbProductPayload({
      product_name: "Gift Box",
      sku: "OAS-AS-BKL-0001-0001",
      dimension_l_cm: "",
      dimension_w_cm: "",
      dimension_h_cm: "",
      carton_dimensions_cm: "L 10 cm × W 10 cm × H 10 cm",
      fixed_carton_required: true,
    });
    expect(payload.carton_dimensions_cm).toBeNull();
  });

  it("uses partial structured text for fixed_carton over stale hydrated carton text", () => {
    const payload = formToDbProductPayload({
      product_name: "Gift Box",
      sku: "OAS-AS-BKL-0001-0001",
      dimension_l_cm: "22",
      dimension_w_cm: "",
      dimension_h_cm: "6",
      carton_dimensions_cm: "L 10 cm × W 10 cm × H 10 cm",
      fixed_carton_required: true,
    });
    expect(payload.carton_dimensions_cm).toBe("L 22 cm × H 6 cm");
  });

  it("strips gross_weight_kg via live allowlist sanitizer", () => {
    const { payload } = sanitizeLiveProductsPayload({
      product_name: "Gift Box",
      sku: "OAS-AS-BKL-0001-0001",
      gross_weight_kg: 2.5,
      net_weight_g: 500,
    });
    expect(payload.gross_weight_kg).toBeUndefined();
    expect(payload.net_weight_g).toBe(500);
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
