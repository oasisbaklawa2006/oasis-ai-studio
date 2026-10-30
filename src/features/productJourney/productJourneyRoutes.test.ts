import { describe, expect, it } from "vitest";
import {
  catalogueBuilderRoute,
  productCatalogueCopyRoute,
  productEditorRoute,
  productMediaRoute,
} from "./productJourneyRoutes";

describe("product journey routes", () => {
  it("preserves one encoded canonical product identity across governed workspaces", () => {
    expect(productEditorRoute(" product/id ")).toBe("/products/product%2Fid");
    expect(productMediaRoute(" product/id ")).toBe("/products/product%2Fid/media");
    expect(productCatalogueCopyRoute(" product/id ")).toBe(
      "/admin/catalogue-product-studio?product=product%2Fid",
    );
  });

  it("uses the existing governed catalogue builder", () => {
    expect(catalogueBuilderRoute).toBe("/admin/catalogue-builder");
  });
});
