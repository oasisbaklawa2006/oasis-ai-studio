import { describe, expect, it } from "vitest";
import { isSelectedCatalogueProductAvailable } from "./productSelection";

const options = [{ id: "sku-one" }, { id: "sku-two" }];

describe("catalogue add-product selection", () => {
  it("allows a product only when the active collection and available options are loaded", () => {
    expect(isSelectedCatalogueProductAvailable("sku-one", options, "collection-a", "collection-a")).toBe(true);
    expect(isSelectedCatalogueProductAvailable("", options, "collection-a", "collection-a")).toBe(false);
    expect(isSelectedCatalogueProductAvailable("missing", options, "collection-a", "collection-a")).toBe(false);
  });

  it("blocks a stale selection during a collection switch", () => {
    expect(isSelectedCatalogueProductAvailable("sku-one", options, "collection-b", "collection-a")).toBe(false);
    expect(isSelectedCatalogueProductAvailable("sku-one", options, "collection-b", null)).toBe(false);
    expect(isSelectedCatalogueProductAvailable("sku-one", options, null, null)).toBe(false);
  });

  it("rejects a product already present in the newly loaded collection", () => {
    // The available selector is derived from products minus collection items.
    const nextCollectionAvailable = options.filter((item) => item.id !== "sku-one");
    expect(
      isSelectedCatalogueProductAvailable(
        "sku-one",
        nextCollectionAvailable,
        "collection-b",
        "collection-b",
      ),
    ).toBe(false);
    expect(
      isSelectedCatalogueProductAvailable(
        "sku-two",
        nextCollectionAvailable,
        "collection-b",
        "collection-b",
      ),
    ).toBe(true);
  });
});
