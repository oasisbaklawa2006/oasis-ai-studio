import { describe, expect, it } from "vitest";
import {
  buildProductReadinessSnapshot,
  channelNeedsMoq,
  productCardTopLevelStatus,
} from "@/features/readiness/productReadinessSnapshot";

const readyProduct = {
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
  label_status: "draft",
  approximate_piece_weight_g: 25,
  master_carton_qty: 8,
};

const readyBundle = {
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
  moqRows: [
    {
      product_id: "p1",
      channel: "b2b",
      moq_applicable: true,
      moq_value: 1,
      moq_uom: "kg",
    },
  ],
};

describe("productListReadiness", () => {
  it("matches detail readiness for saved product with media and pricing", () => {
    const { readiness } = buildProductReadinessSnapshot(readyProduct, readyBundle);

    const media = readiness.dimensions.find((d) => d.dimension === "media_status");
    const pricing = readiness.dimensions.find((d) => d.dimension === "pricing_status");
    const compliance = readiness.dimensions.find((d) => d.dimension === "compliance_status");

    expect(media?.complete).toBe(true);
    expect(pricing?.complete).toBe(true);
    expect(compliance?.complete).toBe(true);
  });

  it("shows Ready on card when 8/8 ready despite label_status draft", () => {
    const { readiness } = buildProductReadinessSnapshot(readyProduct, readyBundle);

    expect(readiness.readyForCentralSync).toBe(true);
    expect(readyProduct.label_status).toBe("draft");

    const status = productCardTopLevelStatus(readiness, {
      pricingRows: readyBundle.pricingRows,
      moqRows: readyBundle.moqRows,
    });

    expect(status.label).toBe("Ready");
    expect(status.tone).toBe("ok");
    expect(status.label).not.toMatch(/draft/i);
  });

  it("shows Ready when catalogue snapshot is approved even if readiness lags", () => {
    const incomplete = buildProductReadinessSnapshot(
      { ...readyProduct, hsn_code: null, gst_rate: null },
      { productMediaRows: [], pricingRows: [], moqRows: [] },
    ).readiness;

    const status = productCardTopLevelStatus(incomplete, { catalogueVersionApproved: true });

    expect(status.label).toBe("Ready");
    expect(status.tone).toBe("ok");
  });

  it("never surfaces legacy draft — maps gaps to Needs * labels", () => {
    const { readiness } = buildProductReadinessSnapshot(
      { ...readyProduct, hsn_code: null, gst_rate: null },
      {
        productMediaRows: [],
        pricingRows: [],
        moqRows: [],
      },
    );

    expect(productCardTopLevelStatus(readiness).label).toBe("Needs media");
    expect(productCardTopLevelStatus(readiness).label).not.toMatch(/draft/i);
  });

  it("detects channel MOQ gap when pricing exists without MOQ rule", () => {
    expect(channelNeedsMoq(readyBundle.pricingRows, [])).toBe(true);
    expect(channelNeedsMoq(readyBundle.pricingRows, readyBundle.moqRows)).toBe(false);

    const { readiness } = buildProductReadinessSnapshot(
      { ...readyProduct, hsn_code: null, gst_rate: null },
      {
        productMediaRows: readyBundle.productMediaRows,
        pricingRows: readyBundle.pricingRows,
        moqRows: [],
      },
    );

    expect(
      productCardTopLevelStatus(readiness, {
        pricingRows: readyBundle.pricingRows,
        moqRows: [],
      }).label,
    ).toBe("Needs MOQ");
  });
});
