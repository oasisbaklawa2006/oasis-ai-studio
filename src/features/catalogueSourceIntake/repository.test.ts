import { describe, expect, it } from "vitest";

import {
  buildStagedEntryRows,
  CATALOGUE_SOURCE_PRODUCT_CREATION_AUTHORITY,
  CORE_ATOMIC_STAGE_CATALOGUE_SOURCE_BATCH_RPC,
} from "./repository";

describe("catalogue source intake boundary", () => {
  it("has no product-creation authority", () => {
    expect(CATALOGUE_SOURCE_PRODUCT_CREATION_AUTHORITY).toBe(false);
  });

  it("forces every imported source entry to safe unmatched STAGED state", () => {
    const [row] = buildStagedEntryRows("batch-1", [
      {
        sourceEntryKey: " page-001:item-001 ",
        sourcePageNumber: 1,
        sourceTitle: " Catalogue Candidate ",
        sourceSku: " candidate-sku ",
        rawSourceData: {
          title: "Catalogue Candidate",
          status: "APPROVED_FOR_DRAFT",
          matched_product_id: "attacker-controlled-product-id",
        },
        candidateProductData: {
          catalogue_title: "Catalogue Candidate",
          price: 999,
        },
      },
    ]);

    expect(row).toMatchObject({
      batch_id: "batch-1",
      source_entry_key: "page-001:item-001",
      source_page_number: 1,
      source_title: "Catalogue Candidate",
      source_sku: "candidate-sku",
      matched_product_id: null,
      match_confidence: null,
      status: "STAGED",
      review_note: null,
      reviewed_by: null,
      reviewed_at: null,
    });

    expect(row.raw_source_data).toMatchObject({
      status: "APPROVED_FOR_DRAFT",
      matched_product_id: "attacker-controlled-product-id",
    });
  });

  it("rejects duplicate source entry keys before persistence", () => {
    expect(() =>
      buildStagedEntryRows("batch-1", [
        { sourceEntryKey: "same", rawSourceData: {} },
        { sourceEntryKey: " same ", rawSourceData: {} },
      ]),
    ).toThrow("Duplicate source entry key");
  });

  it("rejects invalid source page numbers", () => {
    expect(() =>
      buildStagedEntryRows("batch-1", [
        { sourceEntryKey: "entry-1", sourcePageNumber: 0, rawSourceData: {} },
      ]),
    ).toThrow("must be a positive integer");
  });

  it("rejects an empty intake rather than inventing catalogue records", () => {
    expect(() => buildStagedEntryRows("batch-1", [])).toThrow(
      "At least one catalogue source entry is required.",
    );
  });

  it("documents the Core RPC required for atomic batch staging", () => {
    expect(CORE_ATOMIC_STAGE_CATALOGUE_SOURCE_BATCH_RPC).toBe("stage_catalogue_source_batch_v1");
  });
});
