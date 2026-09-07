import { describe, expect, it } from "vitest";
import {
  deriveDeterministicPdfFileId,
  exportCataloguePdf,
  exportPrintCataloguePdf,
  hashPdfBlob,
  isoToCanonicalPdfUtcDate,
} from "./pdfExport";
import {
  applyPriceVisibilityToCard,
  exportTextContainsPriceLeak,
  formatPriceForExport,
  formatPriceSegmentForShare,
  resolvePriceDisplay,
} from "./priceVisibility";
import { buildPrintComposition, validateCompositionForPrint } from "./printComposition";
import {
  contentBoxMm,
  PRINT_PAGE,
  validatePrintImageQuality,
  validatePrintLayout,
} from "./printLayout";
import {
  createPrintCatalogueSnapshot,
  hashPrintSnapshotContent,
  regenerateFromSnapshot,
  snapshotsAreReproducible,
  verifySnapshotIntegrity,
} from "./printSnapshot";
import {
  compatibleTemplatesForCollection,
  defaultTemplateForCollectionType,
  getPrintTemplate,
  isTemplateCompatibleWithCollection,
} from "./printTemplates";
import type {
  CatalogueCollectionItemRow,
  CatalogueCollectionRow,
  CatalogueProductCard,
} from "./types";
import { generateWhatsAppMiniCatalogueText } from "./whatsappPreview";

const baseCollection: CatalogueCollectionRow = {
  id: "col-1",
  title: "Summer B2B",
  slug: "summer-b2b",
  catalogue_type: "b2b_catalogue",
  channel: "b2b",
  status: "draft",
  description: null,
  theme: "classic_white",
  created_by: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const baseItem = (
  productId: string,
  sort: number,
  visibility: "visible" | "hidden" | "inquiry" = "visible",
): CatalogueCollectionItemRow => ({
  id: `item-${productId}`,
  collection_id: "col-1",
  product_id: productId,
  catalogue_version_id: null,
  sort_order: sort,
  display_name_override: null,
  description_override: null,
  price_visibility: visibility,
  is_featured: false,
  created_at: "2026-01-01T00:00:00Z",
});

const baseCard = (overrides: Partial<CatalogueProductCard> = {}): CatalogueProductCard => ({
  productId: "p1",
  name: "Cashew Pyramid",
  sku: "OB-001",
  category: "Baklawa",
  description: "Premium cashew baklawa",
  imageUrl: "https://cdn.example/hero.jpg",
  mrp: 1200,
  sellingPrice: 1000,
  moqLabel: "5 kg",
  isFeatured: false,
  publishable: true,
  blockers: [],
  imageWidthPx: 1500,
  imageHeightPx: 1500,
  ...overrides,
});

describe("printTemplates", () => {
  it("maps collection types to default templates", () => {
    expect(defaultTemplateForCollectionType("b2b_catalogue")).toBe("b2b_classic");
    expect(defaultTemplateForCollectionType("qr_exhibition_catalogue")).toBe("exhibition_hero");
    expect(getPrintTemplate("exhibition_hero").defaultPriceVisibility).toBe("inquiry");
  });

  it("isolates template variants per collection type", () => {
    expect(isTemplateCompatibleWithCollection("b2b_classic", "b2b_catalogue")).toBe(true);
    expect(isTemplateCompatibleWithCollection("exhibition_hero", "b2b_catalogue")).toBe(false);
    const b2bTemplates = compatibleTemplatesForCollection("b2b_catalogue");
    expect(b2bTemplates.every((t) => t.variant === "b2b")).toBe(true);
    expect(b2bTemplates.some((t) => t.id === "exhibition_hero")).toBe(false);
  });
});

describe("priceVisibility", () => {
  it("hides prices when mode is hidden", () => {
    const card = baseCard();
    const hidden = applyPriceVisibilityToCard(card, "hidden");
    expect(hidden.sellingPrice).toBeNull();
    expect(hidden.mrp).toBeNull();
    expect(formatPriceForExport(hidden, "hidden")).toBe("—");
  });

  it("shows inquiry label when mode is inquiry", () => {
    const display = resolvePriceDisplay(baseCard(), "inquiry");
    expect(display.showPrice).toBe(false);
    expect(display.inquiryLabel).toBe("Price on inquiry");
    expect(formatPriceForExport(baseCard(), "inquiry")).toBe("Price on inquiry");
  });

  it("shows approved price when visible", () => {
    expect(formatPriceForExport(baseCard(), "visible")).toBe("₹1000");
  });

  it("does not leak hidden prices into WhatsApp preview", () => {
    const hidden = applyPriceVisibilityToCard(baseCard(), "hidden");
    const text = generateWhatsAppMiniCatalogueText({ title: "Test", products: [hidden] });
    expect(exportTextContainsPriceLeak(text, [hidden])).toBe(false);
    expect(text).not.toContain("₹1000");
    expect(text).not.toContain("MRP");
  });

  it("omits price segment entirely for hidden mode in share text", () => {
    const hidden = applyPriceVisibilityToCard(baseCard(), "hidden");
    expect(formatPriceSegmentForShare(hidden)).toBe("MOQ 5 kg");
    const noMoq = applyPriceVisibilityToCard(baseCard({ moqLabel: null }), "hidden");
    expect(formatPriceSegmentForShare(noMoq)).toBe("");
  });
});

describe("printLayout", () => {
  it("rejects low-resolution images", () => {
    const result = validatePrintImageQuality({
      imageUrl: "https://cdn.example/small.jpg",
      widthPx: 800,
      heightPx: 600,
      approved: true,
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.includes("width"))).toBe(true);
  });

  it("passes high-resolution approved images", () => {
    const result = validatePrintImageQuality({
      imageUrl: "https://cdn.example/large.jpg",
      widthPx: 1800,
      heightPx: 1800,
      approved: true,
    });
    expect(result.ok).toBe(true);
    expect(result.effectiveDpi).toBeGreaterThanOrEqual(300);
  });

  it("flags empty catalogues", () => {
    const layout = validatePrintLayout({ productCount: 0, imagesWithIssues: 0, hasCover: true });
    expect(layout.ok).toBe(false);
  });

  it("blocks export when image quality gates fail", () => {
    const layout = validatePrintLayout({ productCount: 2, imagesWithIssues: 1, hasCover: true });
    expect(layout.ok).toBe(false);
    expect(layout.issues.some((i) => i.includes("image-quality"))).toBe(true);
  });

  it("requires dimensions for production DPI verification", () => {
    const result = validatePrintImageQuality({
      imageUrl: "https://cdn.example/hero.jpg",
      widthPx: null,
      heightPx: null,
      approved: true,
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.includes("dimensions unknown"))).toBe(true);
  });
});

describe("printComposition", () => {
  it("builds sections with cover, contents, and category dividers", () => {
    const items = [baseItem("p1", 0), baseItem("p2", 1)];
    const cards = [
      baseCard({ productId: "p1", category: "Baklawa" }),
      baseCard({ productId: "p2", name: "Pistachio Roll", category: "Baklawa" }),
    ];
    const composition = buildPrintComposition({
      collection: baseCollection,
      items,
      cards,
      templateId: "b2b_classic",
    });
    expect(composition.productCount).toBe(2);
    expect(composition.sections.some((s) => s.kind === "cover")).toBe(true);
    expect(composition.sections.some((s) => s.kind === "contents")).toBe(true);
    expect(composition.sections.some((s) => s.kind === "category_divider")).toBe(true);
    expect(composition.sections.some((s) => s.kind === "product")).toBe(true);
  });

  it("respects product ordering without duplicating truth", () => {
    const items = [baseItem("p2", 0), baseItem("p1", 1)];
    const cards = [baseCard({ productId: "p1" }), baseCard({ productId: "p2", name: "Second" })];
    const composition = buildPrintComposition({
      collection: baseCollection,
      items,
      cards,
      templateId: "b2b_grid",
    });
    const productSection = composition.sections.find((s) => s.kind === "product");
    expect(productSection?.products?.[0]?.name).toBe("Second");
  });

  it("validates composition image quality", () => {
    const cards = [baseCard({ imageWidthPx: 500, imageHeightPx: 500, imageApproved: true })];
    const composition = buildPrintComposition({
      collection: baseCollection,
      items: [baseItem("p1", 0)],
      cards,
      templateId: "b2b_classic",
    });
    const validation = validateCompositionForPrint(composition, cards);
    expect(validation.imageIssues.length).toBeGreaterThan(0);
    expect(validation.ok).toBe(false);
  });

  it("enforces item price_visibility in composed product sections", () => {
    const items = [baseItem("p1", 0, "hidden")];
    const cards = [baseCard({ sellingPrice: 1000, mrp: 1200 })];
    const composition = buildPrintComposition({
      collection: baseCollection,
      items,
      cards,
      templateId: "b2b_classic",
    });
    const productSection = composition.sections.find((s) => s.kind === "product");
    const composed = productSection?.products?.[0];
    expect(composed?.priceVisibilityMode).toBe("hidden");
    expect(composed?.sellingPrice).toBeNull();
    expect(formatPriceForExport(composed!)).toBe("—");
  });
});

describe("printSnapshot", () => {
  it("produces deterministic content hash for same inputs", () => {
    const items = [baseItem("p1", 0, "hidden")];
    const cards = [applyPriceVisibilityToCard(baseCard(), "hidden")];
    const composition = buildPrintComposition({
      collection: baseCollection,
      items,
      cards,
      templateId: "b2b_classic",
    });
    const hashA = hashPrintSnapshotContent({
      collection: baseCollection,
      items,
      cards,
      templateId: "b2b_classic",
      composition,
    });
    const hashB = hashPrintSnapshotContent({
      collection: baseCollection,
      items,
      cards,
      templateId: "b2b_classic",
      composition,
    });
    expect(hashA).toBe(hashB);
    expect(hashA).toMatch(/^fnv1a-/);
  });

  it("changes hash when price visibility changes", () => {
    const itemsVisible = [baseItem("p1", 0, "visible")];
    const itemsHidden = [baseItem("p1", 0, "hidden")];
    const cardsVisible = [applyPriceVisibilityToCard(baseCard(), "visible")];
    const cardsHidden = [applyPriceVisibilityToCard(baseCard(), "hidden")];
    const compositionVisible = buildPrintComposition({
      collection: baseCollection,
      items: itemsVisible,
      cards: cardsVisible,
      templateId: "b2b_classic",
    });
    const compositionHidden = buildPrintComposition({
      collection: baseCollection,
      items: itemsHidden,
      cards: cardsHidden,
      templateId: "b2b_classic",
    });
    const hashVisible = hashPrintSnapshotContent({
      collection: baseCollection,
      items: itemsVisible,
      cards: cardsVisible,
      templateId: "b2b_classic",
      composition: compositionVisible,
    });
    const hashHidden = hashPrintSnapshotContent({
      collection: baseCollection,
      items: itemsHidden,
      cards: cardsHidden,
      templateId: "b2b_classic",
      composition: compositionHidden,
    });
    expect(hashVisible).not.toBe(hashHidden);
  });

  it("detects tampered composition during integrity check", () => {
    const items = [baseItem("p1", 0)];
    const cards = [baseCard()];
    const composition = buildPrintComposition({
      collection: baseCollection,
      items,
      cards,
      templateId: "b2b_classic",
    });
    const snapshot = createPrintCatalogueSnapshot({
      collection: baseCollection,
      items,
      cards,
      templateId: "b2b_classic",
      composition,
    });
    const tampered = {
      ...snapshot,
      composition: {
        ...snapshot.composition,
        collectionTitle: "Tampered Title",
      },
    };
    expect(verifySnapshotIntegrity(tampered)).toBe(false);
    expect(() => regenerateFromSnapshot(tampered)).toThrow(/integrity/i);
  });

  it("supports reproducible regeneration from snapshot", () => {
    const items = [baseItem("p1", 0)];
    const cards = [baseCard()];
    const composition = buildPrintComposition({
      collection: baseCollection,
      items,
      cards,
      templateId: "b2b_classic",
    });
    const snapA = createPrintCatalogueSnapshot({
      collection: baseCollection,
      items,
      cards,
      templateId: "b2b_classic",
      composition,
      createdAt: "2026-01-01T00:00:00.000Z",
      snapshotId: "snap-test-1",
    });
    const snapB = createPrintCatalogueSnapshot({
      collection: baseCollection,
      items,
      cards,
      templateId: "b2b_classic",
      composition,
      existingVersions: [{ ...snapA, versionNumber: 1 }],
      createdAt: "2026-01-01T00:00:00.000Z",
      snapshotId: "snap-test-2",
    });
    expect(verifySnapshotIntegrity(snapA)).toBe(true);
    expect(snapshotsAreReproducible(snapA, { ...snapA, versionNumber: 2 })).toBe(true);
    expect(snapB.versionNumber).toBe(2);
    const regen = regenerateFromSnapshot(snapA);
    expect(regen.contentHash).toBe(snapA.contentHash);
    expect(regen.templateId).toBe("b2b_classic");
  });
});

describe("printLayout bleed", () => {
  it("uses trim plus 3mm bleed on each edge for media box", () => {
    expect(PRINT_PAGE.mediaWidthMm).toBe(216);
    expect(PRINT_PAGE.mediaHeightMm).toBe(303);
    expect(PRINT_PAGE.mediaWidthMm).toBe(PRINT_PAGE.trimWidthMm + 2 * PRINT_PAGE.bleedMm);
    expect(PRINT_PAGE.mediaHeightMm).toBe(PRINT_PAGE.trimHeightMm + 2 * PRINT_PAGE.bleedMm);
  });

  it("positions content inside bleed and safe margins", () => {
    const box = contentBoxMm();
    expect(box.left).toBe(PRINT_PAGE.bleedMm + PRINT_PAGE.safeMarginMm);
    expect(box.top).toBe(PRINT_PAGE.bleedMm + PRINT_PAGE.safeMarginMm);
    expect(box.width).toBe(
      PRINT_PAGE.trimWidthMm - 2 * (PRINT_PAGE.safeMarginMm + PRINT_PAGE.bleedMm),
    );
  });
});

describe("deterministicPdfMetadata", () => {
  it("formats canonical UTC PDF date strings", () => {
    expect(isoToCanonicalPdfUtcDate("1970-01-01T00:00:00.000Z")).toBe("D:19700101000000+00'00'");
    expect(isoToCanonicalPdfUtcDate("2026-01-01T12:30:45.000Z")).toBe("D:20260101123045+00'00'");
  });

  it("derives valid 32-char hex file IDs from preview and hash seeds", () => {
    const previewId = deriveDeterministicPdfFileId("preview");
    expect(previewId).toMatch(/^[a-f0-9]{32}$/);
    const hashId = deriveDeterministicPdfFileId("fnv1a-deadbeef");
    expect(hashId).toMatch(/^[a-f0-9]{32}$/);
    expect(deriveDeterministicPdfFileId("preview")).toBe(previewId);
  });
});

describe("printPdfExport", () => {
  it("generates deterministic production PDF blob", async () => {
    const items = [baseItem("p1", 0, "hidden")];
    const cards = [applyPriceVisibilityToCard(baseCard(), "hidden")];
    const composition = buildPrintComposition({
      collection: baseCollection,
      items,
      cards,
      templateId: "b2b_classic",
    });
    const snapshot = createPrintCatalogueSnapshot({
      collection: baseCollection,
      items,
      cards,
      templateId: "b2b_classic",
      composition,
      createdAt: "2026-01-01T00:00:00.000Z",
      snapshotId: "pdf-snap-1",
    });
    const blob = await exportPrintCataloguePdf({
      composition,
      templateId: "b2b_classic",
      snapshot,
    });
    expect(blob.size).toBeGreaterThan(1000);
    expect(blob.type).toBe("application/pdf");
  });

  it("produces identical PDF hash for same frozen snapshot", async () => {
    const items = [baseItem("p1", 0, "hidden")];
    const cards = [applyPriceVisibilityToCard(baseCard(), "hidden")];
    const composition = buildPrintComposition({
      collection: baseCollection,
      items,
      cards,
      templateId: "b2b_classic",
    });
    const snapshot = createPrintCatalogueSnapshot({
      collection: baseCollection,
      items,
      cards,
      templateId: "b2b_classic",
      composition,
      createdAt: "2026-01-01T00:00:00.000Z",
      snapshotId: "pdf-snap-repro",
    });
    const frozen = regenerateFromSnapshot(snapshot);
    const blobA = await exportPrintCataloguePdf({
      composition: frozen.composition,
      templateId: frozen.templateId,
      snapshot,
    });
    const blobB = await exportPrintCataloguePdf({
      composition: frozen.composition,
      templateId: frozen.templateId,
      snapshot,
    });
    const [hashA, hashB] = await Promise.all([hashPdfBlob(blobA), hashPdfBlob(blobB)]);
    expect(hashA).toBe(hashB);
  });

  it("produces identical hash for no-snapshot preview exports", async () => {
    const cards = [applyPriceVisibilityToCard(baseCard(), "hidden")];
    const blobA = await exportCataloguePdf({
      title: "Preview Catalogue",
      products: cards,
    });
    const blobB = await exportCataloguePdf({
      title: "Preview Catalogue",
      products: cards,
    });
    const [hashA, hashB] = await Promise.all([hashPdfBlob(blobA), hashPdfBlob(blobB)]);
    expect(hashA).toBe(hashB);
  });

  it("uses deterministic metadata seeds for production snapshots", async () => {
    const items = [baseItem("p1", 0)];
    const cards = [baseCard()];
    const composition = buildPrintComposition({
      collection: baseCollection,
      items,
      cards,
      templateId: "b2b_classic",
    });
    const snapshot = createPrintCatalogueSnapshot({
      collection: baseCollection,
      items,
      cards,
      templateId: "b2b_classic",
      composition,
      createdAt: "2026-06-15T18:45:30.000Z",
      snapshotId: "pdf-tz-stable",
    });
    expect(isoToCanonicalPdfUtcDate(snapshot.createdAt)).toBe("D:20260615184530+00'00'");
    expect(deriveDeterministicPdfFileId(snapshot.contentHash)).toMatch(/^[a-f0-9]{32}$/);

    const blobA = await exportPrintCataloguePdf({
      composition,
      templateId: "b2b_classic",
      snapshot,
    });
    const blobB = await exportPrintCataloguePdf({
      composition,
      templateId: "b2b_classic",
      snapshot,
    });
    const [hashA, hashB] = await Promise.all([hashPdfBlob(blobA), hashPdfBlob(blobB)]);
    expect(hashA).toBe(hashB);
  });
});
