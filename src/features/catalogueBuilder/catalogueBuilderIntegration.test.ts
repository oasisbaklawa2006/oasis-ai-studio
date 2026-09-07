import { describe, expect, it } from "vitest";
import { exportPrintCataloguePdf, hashPdfBlob } from "./pdfExport";
import { buildPrintComposition, validateCompositionForPrint } from "./printComposition";
import {
  createPrintCatalogueSnapshot,
  regenerateFromSnapshot,
  verifySnapshotIntegrity,
} from "./printSnapshot";
import { buildCatalogueProductCard } from "./productCardBuilder";
import type { CatalogueCollectionItemRow, CatalogueCollectionRow } from "./types";

const collection: CatalogueCollectionRow = {
  id: "integration-col",
  title: "Integration B2B",
  slug: "integration-b2b",
  catalogue_type: "b2b_catalogue",
  channel: "b2b",
  status: "draft",
  description: null,
  theme: "classic_white",
  created_by: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const item = (
  productId: string,
  visibility: CatalogueCollectionItemRow["price_visibility"] = "visible",
): CatalogueCollectionItemRow => ({
  id: `item-${productId}`,
  collection_id: collection.id,
  product_id: productId,
  catalogue_version_id: null,
  sort_order: 0,
  display_name_override: null,
  description_override: null,
  price_visibility: visibility,
  is_featured: false,
  created_at: "2026-01-01T00:00:00Z",
});

const product = {
  id: "prod-1",
  product_name: "Pistachio Baklawa",
  sku: "OB-100",
  category: "Baklawa",
  short_description: "Premium pistachio",
  hsn_code: "18069090",
  gst_rate: "5",
  hero_image_url: "https://cdn.example/hero.jpg",
  hero_image_width_px: 1800,
  hero_image_height_px: 1800,
  media_status: "approved",
  media_assets: [
    { type: "catalogue_image", url: "https://cdn.example/white.jpg", status: "approved" },
    { type: "close_up_image", url: "https://cdn.example/close.jpg", status: "approved" },
    { type: "lifestyle_image", url: "https://cdn.example/life.jpg", status: "approved" },
  ],
};

describe("catalogueBuilder integration", () => {
  it("runs governed facts → composition → snapshot → PDF regeneration", async () => {
    const collectionItem = item("prod-1", "inquiry");
    const card = buildCatalogueProductCard({
      product,
      item: collectionItem,
      pricingRows: [
        {
          product_id: "prod-1",
          price_channel: "b2b",
          calculated_price: 950,
          approval_status: "approved",
        },
        {
          product_id: "prod-1",
          price_channel: "mrp",
          calculated_price: 1200,
          approval_status: "approved",
        },
      ],
      moqRows: [{ product_id: "prod-1", channel: "b2b", moq_value: 5, moq_uom: "kg" }],
      channel: "b2b",
      catalogueVersionStatus: "synced",
    });

    expect(card.priceVisibilityMode).toBe("inquiry");
    expect(card.sellingPrice).toBeNull();
    expect(card.imageWidthPx).toBe(1800);
    expect(card.imageApproved).toBe(true);

    const composition = buildPrintComposition({
      collection,
      items: [collectionItem],
      cards: [card],
      templateId: "b2b_classic",
    });

    const validation = validateCompositionForPrint(composition, [card]);
    expect(validation.ok).toBe(true);

    const snapshot = createPrintCatalogueSnapshot({
      collection,
      items: [collectionItem],
      cards: [card],
      templateId: "b2b_classic",
      composition,
      createdAt: "2026-06-01T12:00:00.000Z",
      snapshotId: "integration-snap",
    });

    expect(verifySnapshotIntegrity(snapshot)).toBe(true);

    const frozen = regenerateFromSnapshot(snapshot);
    const blob = await exportPrintCataloguePdf({
      composition: frozen.composition,
      templateId: frozen.templateId,
      snapshot,
    });

    expect(blob.size).toBeGreaterThan(1000);

    const regenBlob = await exportPrintCataloguePdf({
      composition: frozen.composition,
      templateId: frozen.templateId,
      snapshot,
    });
    const [hash1, hash2] = await Promise.all([hashPdfBlob(blob), hashPdfBlob(regenBlob)]);
    expect(hash1).toBe(hash2);
  });
});
