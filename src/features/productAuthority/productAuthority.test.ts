import { describe, expect, it } from "vitest";
import {
  formToDbProductPayload,
  stripUnknownProductFields,
  validateProductSavePayload,
} from "@/features/productAuthority/productSchemaAdapter";
import { assertStructuredSkuForSave, isDraftSku } from "@/features/productAuthority/skuGuard";
import { FAST_CREATE_SKU_BLOCK_MESSAGE } from "@/features/fastCreate/saveFastCreateProduct";
import { heroUrlWritePayload } from "@/lib/productImage";
import { applyPrefeedSuggestions, buildCategoryPrefeed } from "@/features/productDefaults/categoryPrefeed";

describe("productSchemaAdapter", () => {
  it("maps form to Studio columns (not Central legacy names)", () => {
    const payload = formToDbProductPayload({
      product_name: "Cashew Kitta",
      subcategory: "Baklawa",
      b2b_price: "100",
      gst_rate: "18",
      main_department: "ready_goods_store",
      production_department: "arabic_sweets",
      hero_image_url: "https://example.com/h.jpg",
      sku: "OAS-AS-BKL-0001-0001",
    });
    expect(payload.product_name).toBe("Cashew Kitta");
    expect(payload.subcategory).toBe("Baklawa");
    expect(payload.b2b_price).toBe(100);
    expect(payload.name).toBeUndefined();
    expect(payload.price_b2b).toBeUndefined();
    expect(payload.sub_category).toBeUndefined();
    expect(payload.hero_image_url).toBe("https://example.com/h.jpg");
    expect(payload.image_url).toBe("https://example.com/h.jpg");
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

  it("validates required fields on create", () => {
    const bad = validateProductSavePayload({ product_name: "A" }, "create");
    expect(bad.ok).toBe(false);
    expect(bad.missing).toContain("sku");

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
