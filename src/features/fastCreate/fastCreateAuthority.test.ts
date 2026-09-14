import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

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
    expect(save).not.toMatch(/from\(["']products["']\)\.insert/);
    expect(save).not.toContain('.from("products")');
  });

  it("submits drafts through the governed Core RPC", () => {
    const intake = readRepoFile("src/features/fastCreate/fastCreateIntakeBarcode.ts");
    expect(intake).toContain("submit_catalogue_product_draft_v1");
  });

  it("retains Point28 exact duplicate blocking before draft submission", () => {
    const save = readRepoFile("src/features/fastCreate/saveFastCreateProduct.ts");
    expect(save).toContain("assertNoBlockingProductCollisions");
    expect(save.indexOf("assertNoBlockingProductCollisions")).toBeLessThan(
      save.lastIndexOf("submitFastCreateProductDraft"),
    );
  });

  it("keeps fuzzy/similar-name detection review-only rather than auto-merging identity", () => {
    const duplicateContract = readRepoFile(
      "src/features/productGovernance/productDuplicateContract.ts",
    );
    expect(duplicateContract).toContain("similar_name");
    expect(duplicateContract).toContain("review");
  });

  it("routes AI enrichment through governed extraction", () => {
    expect(readRepoFile("src/features/governedAiExtraction/fastCreateEnrichment.ts")).toContain(
      "getPersistableFastCreateAliases",
    );
  });

  it("preserves factual-composition fields in the governed draft handoff", () => {
    const save = readRepoFile("src/features/fastCreate/saveFastCreateProduct.ts");
    expect(save).toContain("factualCompositionDraftPayload");
    expect(save).toContain("appendLiveLegalFieldsToContributorCompliance");
  });
});
