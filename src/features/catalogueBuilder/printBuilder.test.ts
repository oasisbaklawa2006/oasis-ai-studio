import { describe, expect, it } from "vitest";
import { buildPrintComposition, validateCompositionForPrint } from "./printComposition";
import { validatePrintImageQuality, validatePrintLayout } from "./printLayout";
import { applyPriceVisibilityToCard, formatPriceForExport, resolvePriceDisplay } from "./priceVisibility";
import {
  createPrintCatalogueSnapshot,
  hashPrintSnapshotContent,
  snapshotsAreReproducible,
} from "./printSnapshot";
import { defaultTemplateForCollectionType, getPrintTemplate } from "./printTemplates";
import { exportPrintCataloguePdf } from "./pdfExport";
import type { CatalogueCollectionItemRow, CatalogueCollectionRow, CatalogueProductCard } from "./types";

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

const baseItem = (productId: string, sort: number, visibility: "visible" | "hidden" | "inquiry" = "visible"): CatalogueCollectionItemRow => ({
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
    const cards = [
      baseCard({ productId: "p1" }),
      baseCard({ productId: "p2", name: "Second" }),
    ];
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
    const cards = [baseCard({ imageWidthPx: 500, imageHeightPx: 500 })];
    const composition = buildPrintComposition({
      collection: baseCollection,
      items: [baseItem("p1", 0)],
      cards,
      templateId: "b2b_classic",
    });
    const validation = validateCompositionForPrint(composition, cards);
    expect(validation.imageIssues.length).toBeGreaterThan(0);
  });
});

describe("printSnapshot", () => {
  it("produces deterministic content hash for same inputs", () => {
    const items = [baseItem("p1", 0, "hidden")];
    const cards = [applyPriceVisibilityToCard(baseCard(), "hidden")];
    const hashA = hashPrintSnapshotContent({
      collection: baseCollection,
      items,
      cards,
      templateId: "b2b_classic",
    });
    const hashB = hashPrintSnapshotContent({
      collection: baseCollection,
      items,
      cards,
      templateId: "b2b_classic",
    });
    expect(hashA).toBe(hashB);
    expect(hashA).toMatch(/^fnv1a-/);
  });

  it("changes hash when price visibility changes", () => {
    const itemsVisible = [baseItem("p1", 0, "visible")];
    const itemsHidden = [baseItem("p1", 0, "hidden")];
    const cardsVisible = [applyPriceVisibilityToCard(baseCard(), "visible")];
    const cardsHidden = [applyPriceVisibilityToCard(baseCard(), "hidden")];
    const hashVisible = hashPrintSnapshotContent({
      collection: baseCollection,
      items: itemsVisible,
      cards: cardsVisible,
      templateId: "b2b_classic",
    });
    const hashHidden = hashPrintSnapshotContent({
      collection: baseCollection,
      items: itemsHidden,
      cards: cardsHidden,
      templateId: "b2b_classic",
    });
    expect(hashVisible).not.toBe(hashHidden);
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
    });
    const snapB = createPrintCatalogueSnapshot({
      collection: baseCollection,
      items,
      cards,
      templateId: "b2b_classic",
      composition,
      existingVersions: [{ ...snapA, versionNumber: 1 }],
    });
    expect(snapshotsAreReproducible(snapA, { ...snapA, versionNumber: 2 })).toBe(true);
    expect(snapB.versionNumber).toBe(2);
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
    });
    const blob = await exportPrintCataloguePdf({ composition, templateId: "b2b_classic", snapshot });
    expect(blob.size).toBeGreaterThan(1000);
    expect(blob.type).toBe("application/pdf");
  });
});
