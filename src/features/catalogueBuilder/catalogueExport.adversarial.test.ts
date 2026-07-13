import { describe, expect, it } from "vitest";
import { getCatalogueExportProfile } from "./exportProfiles";
import { planCatalogueLayout } from "./catalogueLayout";
import { preflightCatalogueExport, requiredImagePixels } from "./cataloguePreflight";
import type { CatalogueProductCard } from "./types";

function card(index: number, overrides: Partial<CatalogueProductCard> = {}): CatalogueProductCard {
  return {
    productId: `product-${index}`,
    name: `Product ${index}`,
    sku: `OAS-STRESS-${String(index).padStart(6, "0")}`,
    category: `Category ${index % 17}`,
    description: "Printable product detail",
    imageUrl: null,
    imageRenditions: [{
      url: `https://cdn.example/${index}.webp`,
      width: 1_600,
      height: 1_600,
      bytes: 120_000,
      mimeType: "image/webp",
    }],
    mrp: 1_200,
    sellingPrice: 900,
    moqLabel: "6 boxes",
    isFeatured: false,
    publishable: true,
    blockers: [],
    ...overrides,
  };
}

describe("catalogue export adversarial scale and layout", () => {
  it("plans 10,003 products exactly once with contiguous page numbering", () => {
    const profile = getCatalogueExportProfile("whatsapp");
    const products = Array.from({ length: 10_003 }, (_, index) => card(index));
    const plan = planCatalogueLayout(products, profile);
    const productPages = plan.pages.filter((page) => page.kind === "products");
    const placed = productPages.flatMap((page) => page.products);
    expect(placed).toHaveLength(products.length);
    expect(new Set(placed.map((product) => product.productId)).size).toBe(products.length);
    expect(plan.pages.map((page) => page.pageNumber))
      .toEqual(Array.from({ length: plan.pages.length }, (_, index) => index + 1));
    expect(productPages.every((page) => page.products.length <= profile.cardsPerPage)).toBe(true);
  });

  it("keeps Unicode, RTL, HTML-like and JSON-like text as inert catalogue content", () => {
    const products = [
      card(1, { name: "مزيج فستق \u202E 24ct", category: "حلويات" }),
      card(2, { name: "פיסטוק <img src=x onerror=alert(1)>", category: "מתנות" }),
      card(3, { name: 'Gift {"tier":"B2B"} 🍫', category: "उपहार" }),
    ];
    const plan = planCatalogueLayout(products, getCatalogueExportProfile("b2b"));
    const placed = plan.pages.flatMap((page) => page.kind === "products" ? page.products : []);
    expect(placed.map((product) => product.name)).toEqual(expect.arrayContaining(products.map((product) => product.name)));
    const preflight = preflightCatalogueExport(products, getCatalogueExportProfile("b2b"));
    expect(preflight.issues.filter((issue) => issue.code === "unicode_font_required")).toHaveLength(3);
  });

  it("marks duplicate and blank product identities as hard export blockers", () => {
    const result = preflightCatalogueExport([
      card(1, { productId: "duplicate" }),
      card(2, { productId: "duplicate" }),
      card(3, { productId: "   " }),
    ], getCatalogueExportProfile("b2b"));
    expect(result.ready).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "duplicate_product_id",
      "missing_product_id",
    ]));
  });

  it("stores prototype-shaped product ids without prototype mutation", () => {
    const products = [
      card(1, { productId: "__proto__" }),
      card(2, { productId: "constructor" }),
      card(3, { productId: "toString" }),
    ];
    const result = preflightCatalogueExport(products, getCatalogueExportProfile("b2b"));
    for (const product of products) {
      expect(Object.hasOwn(result.selectedImages, product.productId)).toBe(true);
      expect(result.selectedImages[product.productId]?.url).toContain("cdn.example");
    }
    expect(Object.getPrototypeOf(result.selectedImages)).toBeNull();
  });

  it("preflights a large mixed-quality catalogue without dropping diagnostics", () => {
    const profile = getCatalogueExportProfile("b2b");
    const required = requiredImagePixels(profile);
    const products = Array.from({ length: 2_000 }, (_, index) => card(index, {
      imageStatus: index % 10 === 0 ? "corrupt" : "ready",
      imageRenditions: index % 10 === 1
        ? [{ url: `small-${index}.webp`, width: required - 1, height: required - 1, mimeType: "image/webp" }]
        : [{ url: `ok-${index}.webp`, width: required, height: required, mimeType: "image/webp" }],
      name: index % 10 === 2 ? `מוצר ${index}` : `Product ${index}`,
      description: index % 10 === 3 ? "x".repeat(321) : "Printable detail",
    }));
    const result = preflightCatalogueExport(products, profile);
    expect(Object.keys(result.selectedImages)).toHaveLength(products.length);
    expect(result.issues.filter((issue) => issue.code === "corrupt_image")).toHaveLength(200);
    expect(result.issues.filter((issue) => issue.code === "insufficient_print_resolution")).toHaveLength(200);
    expect(result.issues.filter((issue) => issue.code === "unicode_font_required")).toHaveLength(200);
    expect(result.issues.filter((issue) => issue.code === "content_condensed")).toHaveLength(200);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "client_export_product_limit", severity: "error" }));
    expect(result.ready).toBe(false);
  });
});
