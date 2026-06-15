import { describe, expect, it } from "vitest";
import { buildProductReadinessSnapshot } from "@/features/readiness/productReadinessSnapshot";

describe("productListReadiness", () => {
  it("matches detail readiness for saved product with media and pricing", () => {
    const product = {
      id: "p1",
      product_name: "Test Baklawa",
      sku: "OAS-TEST-001",
      primary_uom: "kg",
      retail_uom: "pcs",
      b2b_uom: "kg",
      main_department: "ready_goods_store",
      production_department: "arabic_sweets",
      hsn_code: "19059090",
      gst_rate: 18,
      hero_image_url: "https://cdn/hero.jpg",
      media_status: "approved",
      approximate_piece_weight_g: 25,
      master_carton_qty: 8,
    };

    const { readiness } = buildProductReadinessSnapshot(product, {
      productMediaRows: [
        { type: "hero_image", file_url: "https://cdn/hero.jpg", status: "approved" },
      ],
      pricingRows: [
        {
          product_id: "p1",
          price_channel: "b2b",
          approval_status: "approved",
          calculated_price: 2800,
          currency: "INR",
          uom: "kg",
        },
      ],
      moqRows: [],
    });

    const media = readiness.dimensions.find((d) => d.dimension === "media_status");
    const pricing = readiness.dimensions.find((d) => d.dimension === "pricing_status");
    const compliance = readiness.dimensions.find((d) => d.dimension === "compliance_status");

    expect(media?.complete).toBe(true);
    expect(pricing?.complete).toBe(true);
    expect(compliance?.complete).toBe(true);
  });
});
