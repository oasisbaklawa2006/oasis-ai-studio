import { describe, expect, it } from "vitest";
import { CATALOGUE_EXPORT_PROFILES, getCatalogueExportProfile } from "./exportProfiles";
import { planCatalogueLayout } from "./catalogueLayout";
import { preflightCatalogueExport, requiredImagePixels, selectCatalogueRendition } from "./cataloguePreflight";
import { buildCatalogueFilename, buildProvenanceLine } from "./catalogueMetadata";
import { prepareCatalogueExport } from "./catalogueExport";
import type { CatalogueProductCard } from "./types";

function product(overrides: Partial<CatalogueProductCard> = {}): CatalogueProductCard {
  return {
    productId: "p-1",
    name: "Pistachio Baklawa",
    sku: "OAS-BAK-001",
    category: "Baklawa",
    description: "A long-form product description.",
    imageUrl: null,
    mrp: 1200,
    sellingPrice: 900,
    moqLabel: "6 boxes",
    isFeatured: false,
    publishable: true,
    blockers: [],
    ...overrides,
  };
}

describe("catalogue export profiles", () => {
  it("applies audience-specific field policies", () => {
    expect(CATALOGUE_EXPORT_PROFILES.b2b.fields).toMatchObject({ sku: true, price: "selling", moq: true });
    expect(CATALOGUE_EXPORT_PROFILES.b2c.fields).toMatchObject({ sku: false, price: "mrp", moq: false });
    expect(CATALOGUE_EXPORT_PROFILES.horeca.fields.moq).toBe(true);
    expect(CATALOGUE_EXPORT_PROFILES.export.fields.price).toBe("inquiry");
    expect(CATALOGUE_EXPORT_PROFILES.whatsapp).toMatchObject({ document: "compact_a4", dpi: 150 });
  });

  it("plans cover, grouped product pages, terms and back page deterministically", () => {
    const plan = planCatalogueLayout([
      product({ productId: "2", category: "Dragees" }),
      product({ productId: "1", category: "Baklawa" }),
      product({ productId: "3", category: null }),
    ], getCatalogueExportProfile("b2b"));
    expect(plan.sections).toEqual(["Baklawa", "Dragees", "Other products"]);
    expect(plan.pages.map((page) => page.kind)).toEqual(["cover", "products", "products", "products", "terms", "back"]);
    expect(plan.pages.map((page) => page.pageNumber)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("plans large collections without dropping or duplicating products", () => {
    const products = Array.from({ length: 503 }, (_, index) => product({ productId: `p-${index}` }));
    const plan = planCatalogueLayout(products, getCatalogueExportProfile("b2b"));
    const placed = plan.pages.flatMap((page) => page.kind === "products" ? page.products : []);
    expect(placed).toHaveLength(503);
    expect(new Set(placed.map((item) => item.productId)).size).toBe(503);
    expect(plan.pages).toHaveLength(1 + Math.ceil(503 / 4) + 2);
  });
});

describe("catalogue print preflight", () => {
  it("chooses the lightest adequate WebP rendition and reports true print thresholds", () => {
    const profile = getCatalogueExportProfile("b2b");
    const target = requiredImagePixels(profile);
    const card = product({
      imageRenditions: [
        { url: "large.jpg", width: 2400, height: 2400, bytes: 900_000, mimeType: "image/jpeg" },
        { url: "large.webp", width: target + 10, height: target + 10, bytes: 160_000, mimeType: "image/webp" },
        { url: "thumb.webp", width: 320, height: 320, bytes: 10_000, mimeType: "image/webp" },
      ],
    });
    expect(selectCatalogueRendition(card, profile)?.url).toBe("large.webp");
    expect(preflightCatalogueExport([card], profile).issues).toEqual([]);
  });

  it("flags missing, corrupt, low-resolution, unknown-resolution and Unicode risks truthfully", () => {
    const profile = getCatalogueExportProfile("b2b");
    const result = preflightCatalogueExport([
      product({ productId: "missing", imageStatus: "missing" }),
      product({ productId: "corrupt", imageUrl: "bad.webp", imageStatus: "corrupt" }),
      product({ productId: "small", imageRenditions: [{ url: "small.webp", width: 300, height: 200 }] }),
      product({ productId: "unknown", imageUrl: "unknown.webp" }),
      product({ productId: "unicode", name: "مزيج पिस्ता 🍫", imageRenditions: [{ url: "ok.webp", width: 1600, height: 1600 }] }),
      product({ productId: "long", name: "A".repeat(90), description: "B".repeat(400), imageRenditions: [{ url: "long.webp", width: 1600, height: 1600 }] }),
    ], profile);
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "missing_image", "corrupt_image", "insufficient_print_resolution", "unknown_image_dimensions", "unicode_font_required", "content_condensed",
    ]));
    expect(result.ready).toBe(true);
  });

  it("handles mixed aspect ratios without inventing an adequate print image", () => {
    const profile = getCatalogueExportProfile("b2b");
    const result = preflightCatalogueExport([product({
      imageRenditions: [{ url: "wide.webp", width: 2200, height: 500 }, { url: "portrait.webp", width: 600, height: 2200 }],
    })], profile);
    expect(result.issues.some((issue) => issue.code === "insufficient_print_resolution")).toBe(true);
  });
});

describe("catalogue version and provenance", () => {
  const metadata = {
    version: "v2.4 approved",
    generatedAt: "2026-07-13T08:30:00.000Z",
    sourceCollectionId: "collection-17",
    sourceRevision: "42",
  };

  it("creates deterministic safe filenames and provenance", () => {
    expect(buildCatalogueFilename({ title: "Summer / HoReCa 2026", audience: "horeca", metadata }))
      .toBe("summer-horeca-2026-horeca-v2.4-approved-2026-07-13.pdf");
    expect(buildProvenanceLine(metadata)).toContain("Collection collection-17 · Revision 42");
  });

  it("keeps the legacy export input valid while exposing the new plan", () => {
    const prepared = prepareCatalogueExport({ title: "Legacy", products: [product()], metadata });
    expect(prepared.profile.id).toBe("b2b");
    expect(prepared.filename).toContain("legacy-b2b");
    expect(prepared.plan.productCount).toBe(1);
  });
});
