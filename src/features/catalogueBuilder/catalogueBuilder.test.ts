import { describe, expect, it, vi } from "vitest";
import { evaluateCataloguePublishability } from "./cataloguePublishability";
import { generateWhatsAppMiniCatalogueText } from "./whatsappPreview";
import { exportCataloguePdf } from "./pdfExport";
import { selectApprovedImageUrlsForCentral } from "@/features/mediaReadiness/mediaReadinessEngine";
import type { MediaAsset } from "@/features/mediaReadiness/types";
import type { CatalogueProductCard } from "./types";

vi.mock("@/integrations/supabase/client", () => {
  const reject = { data: null, error: { message: "mock" } };
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.order = () => Promise.resolve(reject);
  chain.insert = () => chain;
  chain.single = () => Promise.resolve(reject);
  return { supabase: { from: () => chain } };
});

const completeForm: Record<string, unknown> = {
  product_name: "Cashew Pyramid",
  sku: "OB-001",
  category: "Baklawa",
  hero_image_url: "https://cdn.example/hero.jpg",
  media_status: "approved",
  hsn_code: "18069090",
  gst_rate: "5",
  primary_uom: "kg",
  main_department: "ready_goods_store",
  production_department: "dragees",
  pieces_per_kg: 40,
  approximate_piece_weight_g: 25,
  master_carton_qty: 8,
  media_assets: [
    { type: "catalogue_image", url: "https://cdn.example/white.jpg", status: "approved" },
    { type: "close_up_image", url: "https://cdn.example/close.jpg", status: "approved" },
    { type: "lifestyle_image", url: "https://cdn.example/life.jpg", status: "approved" },
  ],
};

describe("catalogueBuilder", () => {
  it("catalogue collection can include approved product when readiness passes", () => {
    const pub = evaluateCataloguePublishability({
      form: completeForm,
      complianceApproved: true,
      prices: [
        { channel: "mrp", priceStatus: "approved", mrp: 1200 },
        { channel: "b2b", priceStatus: "approved", sellingPrice: 1000 },
      ],
    });
    expect(pub.contentOk).toBe(true);
    expect(pub.mediaOk).toBe(true);
  });

  it("unready product shows catalogue blocker", () => {
    const pub = evaluateCataloguePublishability({
      form: { product_name: "Draft only" },
      complianceApproved: false,
    });
    expect(pub.publishable).toBe(false);
    expect(pub.blockers.length).toBeGreaterThan(0);
  });

  it("generates WhatsApp preview text", () => {
    const text = generateWhatsAppMiniCatalogueText({
      title: "B2B Summer",
      products: [
        {
          productId: "1",
          name: "Pyramid",
          sku: "OB-1",
          category: "Baklawa",
          description: null,
          imageUrl: null,
          mrp: 1200,
          sellingPrice: 1000,
          moqLabel: "5 kg",
          isFeatured: false,
          publishable: true,
          blockers: [],
        },
      ],
      shareUrl: "https://example.com/c/abc",
    });
    expect(text).toContain("B2B Summer");
    expect(text).toContain("Pyramid");
    expect(text).toContain("https://example.com/c/abc");
  });

  it("PDF export does not crash on missing image", async () => {
    const products: CatalogueProductCard[] = [
      {
        productId: "1",
        name: "No Image Product",
        sku: null,
        category: null,
        description: "Test",
        imageUrl: "https://invalid.local/not-a-real-image",
        mrp: null,
        sellingPrice: null,
        moqLabel: null,
        isFeatured: false,
        publishable: false,
        blockers: ["Media missing"],
      },
    ];
    const blob = await exportCataloguePdf({ title: "Test", products });
    expect(blob.size).toBeGreaterThan(500);
  });

  it("Central payload uses approved media only", () => {
    const assets: MediaAsset[] = [
      { type: "primary_image", url: "https://a/1.jpg", status: "approved" },
      { type: "pairing_image", url: "https://a/2.jpg", status: "draft" },
    ];
    const urls = selectApprovedImageUrlsForCentral(assets);
    expect(urls).toEqual(["https://a/1.jpg"]);
  });
});
