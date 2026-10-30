import { describe, expect, it } from "vitest";
import {
  canLeaveProductEditor,
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

  it("only asks for confirmation when product edits are unsaved", () => {
    let confirmations = 0;
    const confirmLeave = () => {
      confirmations += 1;
      return false;
    };

    expect(canLeaveProductEditor(false, confirmLeave)).toBe(true);
    expect(confirmations).toBe(0);
    expect(canLeaveProductEditor(true, confirmLeave)).toBe(false);
    expect(confirmations).toBe(1);
  });
});
