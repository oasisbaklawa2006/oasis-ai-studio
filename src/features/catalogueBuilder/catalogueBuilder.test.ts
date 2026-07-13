import { describe, expect, it, vi } from "vitest";
import { evaluateCataloguePublishability } from "./cataloguePublishability";
import { generateWhatsAppMiniCatalogueText } from "./whatsappPreview";
import { exportCataloguePdf } from "./pdfExport";
import { selectApprovedImageUrlsForCentral } from "@/features/mediaReadiness/mediaReadinessEngine";
import type { MediaAsset } from "@/features/mediaReadiness/types";
import type { CatalogueProductCard } from "./types";
import { createCatalogueShareLink, transitionCollection } from "./collectionStore";

vi.mock("@/integrations/supabase/client", () => {
  const reject = { data: null, error: { message: "mock" } };
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.order = () => Promise.resolve(reject);
  chain.insert = () => chain;
  chain.update = () => chain;
  chain.delete = () => chain;
  chain.in = () => chain;
  chain.limit = () => chain;
  chain.single = () => Promise.resolve(reject);
  chain.maybeSingle = () => Promise.resolve(reject);
  return { supabase: { from: () => chain, rpc: () => Promise.resolve(reject) } };
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
        imageUrl: null,
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

  it("separates review, publication and external sharing", async () => {
    const now = new Date().toISOString();
    localStorage.setItem("oasis_catalogue_collections", JSON.stringify([{
      id: "collection-1",
      title: "Reviewed catalogue",
      slug: "reviewed",
      catalogue_type: "b2b_catalogue",
      channel: "b2b",
      status: "draft",
      revision: 1,
      description: null,
      theme: "classic_white",
      created_by: null,
      reviewed_by: null,
      reviewed_at: null,
      published_by: null,
      published_at: null,
      created_at: now,
      updated_at: now,
    }]));

    await expect(createCatalogueShareLink("collection-1")).rejects.toThrow(/publish/i);
    const review = await transitionCollection("collection-1", 1, "internal_review");
    expect(review.status).toBe("internal_review");
    expect(review.revision).toBe(2);
    await expect(transitionCollection("collection-1", 1, "published")).rejects.toThrow(/revision conflict/i);
    const published = await transitionCollection("collection-1", 2, "published");
    expect(published.status).toBe("published");
    expect(published.revision).toBe(3);
    const share = await createCatalogueShareLink("collection-1", "view");
    expect(share.share_token).toMatch(/^[a-f0-9]{64}$/);
    expect(share.collection_revision).toBe(3);
    const reopened = await transitionCollection("collection-1", 3, "internal_review");
    expect(reopened.revision).toBe(4);
    const storedShares = JSON.parse(localStorage.getItem("oasis_catalogue_share_links") ?? "[]") as Array<{
      status: string;
      revoked_at: string | null;
    }>;
    expect(storedShares[0]?.status).toBe("revoked");
    expect(storedShares[0]?.revoked_at).toBeTruthy();
  });
});
