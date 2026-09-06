import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Durable census evidence for Point 27 — Fast Create authority surfaces.
 * Fails if canonical modules, routes, or governance contracts are removed.
 */
const ROOT = resolve(import.meta.dirname, "../../..");

function readRepoFile(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf8");
}

describe("Point 27 Fast Create authority census", () => {
  it("registers the canonical /products/new/fast route", () => {
    const app = readRepoFile("src/App.tsx");
    expect(app).toContain('path="/products/new/fast"');
    expect(app).toContain("FastCreateProduct");
  });

  it("lists Fast Create entry points on Products and Dashboard", () => {
    expect(readRepoFile("src/pages/Products.tsx")).toContain("/products/new/fast");
    expect(readRepoFile("src/pages/Dashboard.tsx")).toContain("/products/new/fast");
  });

  it("never inserts master products from saveFastCreateProduct", () => {
    const save = readRepoFile("src/features/fastCreate/saveFastCreateProduct.ts");
    expect(save).toContain("submitFastCreateProductDraft");
    expect(save).not.toMatch(/from\("products"\)\.insert/);
    expect(save).not.toContain('.from("products")');
  });

  it("submits drafts through governed Core RPC", () => {
    const intake = readRepoFile("src/features/fastCreate/fastCreateIntakeBarcode.ts");
    expect(intake).toContain("submit_catalogue_product_draft_v1");
  });

  it("blocks duplicate barcodes during multimodal intake (Point 29 boundary)", () => {
    const intake = readRepoFile("src/features/fastCreate/intake/barcodeIntake.ts");
    expect(intake).toContain("duplicate_barcode");
    expect(readRepoFile("src/features/fastCreate/intake/barcodeLookup.ts")).toContain(
      "lookupBarcodeInCatalog",
    );
  });

  it("keeps Point 28 similar-product detection outside Fast Create save path", () => {
    const save = readRepoFile("src/features/fastCreate/saveFastCreateProduct.ts");
    expect(save).not.toContain("duplicateDetection");
    expect(readRepoFile("src/features/productGovernance/duplicateDetection.ts")).toContain(
      "similar-product detection",
    );
  });

  it("routes AI enrichment through governed extraction (Point 30 boundary)", () => {
    expect(readRepoFile("src/features/governedAiExtraction/fastCreateEnrichment.ts")).toContain(
      "getPersistableFastCreateAliases",
    );
  });

  it("hands off session draft to Full Editor without bypassing approval", () => {
    const draft = readRepoFile("src/features/fastCreate/fastCreateDraft.ts");
    expect(draft).toContain("fastCreateFormPatchFromDraft");
    const edit = readRepoFile("src/pages/ProductEdit.tsx");
    expect(edit).toContain("loadFastCreateDraft");
    expect(edit).toContain("clearFastCreateDraft");
  });
});
