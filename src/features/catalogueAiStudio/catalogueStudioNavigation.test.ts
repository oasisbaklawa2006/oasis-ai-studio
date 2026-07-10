import { describe, expect, it } from "vitest";
import { fullEditorDeepLink, fullEditorTabForCategory } from "./catalogueStudioNavigation";
import { computeCatalogueProductReadiness } from "./catalogueProductReadiness";

describe("fullEditorTabForCategory", () => {
  it("maps every category produced by computeCatalogueProductReadiness to a real tab", () => {
    const { categories } = computeCatalogueProductReadiness({});
    for (const c of categories) {
      expect(fullEditorTabForCategory(c.key)).toBeTruthy();
    }
  });

  it("maps identity-family categories to the identity tab", () => {
    expect(fullEditorTabForCategory("identity")).toBe("identity");
    expect(fullEditorTabForCategory("sku")).toBe("identity");
    expect(fullEditorTabForCategory("category")).toBe("identity");
    expect(fullEditorTabForCategory("catalogue_visibility")).toBe("identity");
  });

  it("maps hero_image to the media tab", () => {
    expect(fullEditorTabForCategory("hero_image")).toBe("media");
  });

  it("maps pricing to the channels (Business Rules) tab", () => {
    expect(fullEditorTabForCategory("pricing")).toBe("channels");
  });

  it("maps pack/carton/moq to the uom tab", () => {
    expect(fullEditorTabForCategory("pack_size")).toBe("uom");
    expect(fullEditorTabForCategory("carton_packaging")).toBe("uom");
    expect(fullEditorTabForCategory("moq")).toBe("uom");
  });

  it("maps shelf/export-compliance to the compliance tab", () => {
    expect(fullEditorTabForCategory("shelf_storage")).toBe("compliance");
    expect(fullEditorTabForCategory("export_compliance")).toBe("compliance");
  });

  it("falls back to identity for an unknown category key", () => {
    expect(fullEditorTabForCategory("some_future_category")).toBe("identity");
  });
});

describe("fullEditorDeepLink", () => {
  it("builds a product URL with the correct tab query param", () => {
    expect(fullEditorDeepLink("prod-1", "pricing")).toBe("/products/prod-1?tab=channels");
    expect(fullEditorDeepLink("prod-2", "hero_image")).toBe("/products/prod-2?tab=media");
  });
});
