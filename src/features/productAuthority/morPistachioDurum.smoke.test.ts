/**
 * Mor Pistachio Durum (OAS-AS-BKL-0024) smoke contract — unit-level QA gates.
 * Manual production retest: save, reload, pricing rules, media upload after merge.
 */
import { inferBomRequiredFromProduct } from "@/features/productAuthority/bomAuthority";
import {
  CHANNEL_PRICING_BASIS_FORM_FIELD_KEYS,
  CHANNEL_PRICING_FORM_FIELD_KEYS,
  extractChannelPricingFromForm,
  formToDbProductPayload,
  findPricingLeaksInProductPayload,
} from "@/features/productAuthority/productSchemaAdapter";
import { mapPricingRules } from "@/features/productTruth/channelAuthorityMappers";
import { mediaAssetsFromSources } from "@/features/mediaReadiness/mediaAssetsFromForm";
import { evaluateMediaReadiness } from "@/features/mediaReadiness/mediaReadinessEngine";
import { productMediaContextFromForm } from "@/features/mediaReadiness/mediaAssetsFromForm";
import { formatSupabaseDiagnostic } from "@/lib/supabase/diagnostics";

const MOR_SKU = "OAS-AS-BKL-0024";
const PRODUCT_ID = "prod-mor-pistachio-0024";

const morForm: Record<string, unknown> = {
  id: PRODUCT_ID,
  product_name: "Mor Pistachio Durum",
  sku: MOR_SKU,
  category: "Baklawa",
  subcategory: "Durum",
  primary_uom: "kg",
  moq_value: 9,
  moq_uom: "tray",
  approximate_piece_weight_g: 18,
  pieces_per_kg: 55.56,
  hsn_code: "19059090",
  gst_rate: "18",
  hero_image_url: "https://cdn/hero.jpg",
  b2b_price: "2800",
  b2b_price_basis: "per kg",
  mrp: "3600",
  mrp_price_basis: "per kg",
  export_price: "18",
  export_price_basis: "USD",
};

describe("Mor Pistachio Durum smoke contract", () => {
  it("save payload excludes all price and price_basis fields", () => {
    const payload = formToDbProductPayload(morForm);
    expect(findPricingLeaksInProductPayload(payload)).toEqual([]);

    for (const key of [...CHANNEL_PRICING_FORM_FIELD_KEYS, ...CHANNEL_PRICING_BASIS_FORM_FIELD_KEYS]) {
      expect(payload[key]).toBeUndefined();
    }
    for (const key of Object.keys(payload)) {
      expect(key.endsWith("_price")).toBe(false);
      expect(key.endsWith("_price_basis")).toBe(false);
    }
  });

  it("maps live packaging fields for reload contract", () => {
    const payload = formToDbProductPayload(morForm);
    expect(payload.grams_per_piece).toBe(18);
    expect(payload.pcs_per_kg).toBe(55.56);
    expect(payload.moq_value).toBe(9);
    expect(payload.moq_uom).toBe("tray");
  });

  it("pricing values route to product_pricing_rules only", () => {
    const rules = extractChannelPricingFromForm(morForm, PRODUCT_ID);
    const channels = rules.map((r) => r.price_channel).sort();
    expect(channels).toEqual(["b2b", "export", "mrp"]);
    const mapped = mapPricingRules(rules);
    expect(mapped.find((p) => p.channel === "b2b")?.sellingPrice).toBe(2800);
  });

  it("hero upload shows draft pending approval in media readiness", () => {
    const form = { category: "Baklawa", subcategory: "Durum", sku: MOR_SKU };
    const mediaRows = [
      { type: "hero_image", file_url: "https://cdn/hero.jpg", status: "raw" },
    ];
    const assets = mediaAssetsFromSources({ form, productMediaRows: mediaRows });
    const readiness = evaluateMediaReadiness(productMediaContextFromForm(form), assets);
    expect(readiness.canPublishMedia).toBe(false);
    expect(readiness.blockers.some((b) => b.includes("draft pending approval"))).toBe(true);
  });

  it("central sync catalogue_versions failure uses accurate diagnostic", () => {
    const msg = formatSupabaseDiagnostic(
      { code: "42P01", message: 'relation "catalogue_versions" does not exist' },
      "Catalogue versions query failed",
    );
    expect(msg).toContain("missing");
    expect(msg).not.toContain("connectivity is restored");
  });

  it("bom_required schema mismatch points to live central migration", () => {
    const msg = formatSupabaseDiagnostic(
      {
        code: "PGRST204",
        message: "Could not find the 'bom_required' column of 'products' in the schema cache",
      },
      "Product save",
    );
    expect(msg).toContain("bom_required");
    expect(msg).toContain("products");
    expect(msg).toContain("20260613130000_live_central_product_media_bucket_and_bom_required");
  });

  it("infers BOM requirement from product class when column unreadable", () => {
    expect(
      inferBomRequiredFromProduct({
        main_department: "ready_goods_store",
        product_class: "gift_hamper",
        bom_required: null,
      }),
    ).toBe(true);
  });
});
