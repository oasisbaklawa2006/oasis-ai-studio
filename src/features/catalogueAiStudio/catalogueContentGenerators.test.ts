import { describe, expect, it } from "vitest";
import { exportBundleHasMissingFieldPlaceholder, generateCatalogueDraftContent } from "./catalogueContentGenerators";
import { CATALOGUE_DRAFT_CONTENT_KEYS, type CatalogueDraftContent } from "./catalogueDraftTypes";

function content(fill: string, overrides: Partial<CatalogueDraftContent> = {}): CatalogueDraftContent {
  const base = Object.fromEntries(CATALOGUE_DRAFT_CONTENT_KEYS.map((k) => [k, fill])) as CatalogueDraftContent;
  return { ...base, ...overrides };
}

describe("exportBundleHasMissingFieldPlaceholder (owner-smoke-test: Stage 5 export-bundle safety)", () => {
  it("returns false when every block is complete real copy", () => {
    expect(exportBundleHasMissingFieldPlaceholder(content("Complete real copy."))).toBe(false);
  });

  it("returns true for a block that is purely the missing-field placeholder", () => {
    expect(
      exportBundleHasMissingFieldPlaceholder(
        content("ok", { catalogue_title: "Add missing field first: Product Name." }),
      ),
    ).toBe(true);
  });

  it("returns true for the placeholder embedded inline in otherwise-real copy — the reported defect shape ('...available for wholesale. Add missing field first: B2B price.')", () => {
    expect(
      exportBundleHasMissingFieldPlaceholder(
        content("ok", {
          b2b_sales_copy: "Blackcurrant Ball is available for wholesale. Add missing field first: B2B price.",
        }),
      ),
    ).toBe(true);
  });

  it("reflects a real generated bundle for a product missing a required field (no b2b_price)", () => {
    const generated = generateCatalogueDraftContent({ product_name: "Blackcurrant Ball" });
    expect(exportBundleHasMissingFieldPlaceholder(generated)).toBe(true);
  });

  it("is false for a fully-specified real product", () => {
    const generated = generateCatalogueDraftContent({
      product_name: "Blackcurrant Ball",
      category: "Sweets",
      pack_size: "250g",
      b2b_price: 650,
      b2b_uom: "kg",
      moq_text: "10 boxes",
      hsn_code: "1704",
      gst_rate: 12,
      net_weight_g: 250,
      shelf_life_days: 30,
      storage_instructions: "Store in a cool dry place",
      mrp: 750,
      description: "A rich, buttery baklawa ball.",
    });
    expect(exportBundleHasMissingFieldPlaceholder(generated)).toBe(false);
  });
});
