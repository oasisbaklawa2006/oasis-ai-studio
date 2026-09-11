import { describe, expect, it } from "vitest";

import {
  buildStageCatalogueSourceRpcPayload,
  CATALOGUE_SOURCE_PRODUCT_CREATION_AUTHORITY,
  CORE_ATOMIC_STAGE_CATALOGUE_SOURCE_BATCH_RPC,
} from "./repository";

describe("catalogue source intake boundary", () => {
  it("has no product-creation authority", () => {
    expect(CATALOGUE_SOURCE_PRODUCT_CREATION_AUTHORITY).toBe(false);
  });

  it("targets the Core atomic staging RPC", () => {
    expect(CORE_ATOMIC_STAGE_CATALOGUE_SOURCE_BATCH_RPC).toBe("stage_catalogue_source_batch_v1");
  });

  it("builds a snake_case RPC payload with safe unmatched STAGED semantics", () => {
    const payload = buildStageCatalogueSourceRpcPayload({
      sourceProvider: " catalogue_upload ",
      sourceDocumentName: " Oasis catalogue ",
      dedupeKey: "catalogue:2026-2027:rev-1",
      entries: [
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
      ],
    });

    expect(payload).toMatchObject({
      source_provider: "catalogue_upload",
      source_document_name: "Oasis catalogue",
      dedupe_key: "catalogue:2026-2027:rev-1",
      entries: [
        {
          source_entry_key: "page-001:item-001",
          source_page_number: 1,
          source_title: "Catalogue Candidate",
          source_sku: "candidate-sku",
          raw_source_data: {
            status: "APPROVED_FOR_DRAFT",
            matched_product_id: "attacker-controlled-product-id",
          },
          candidate_product_data: {
            price: 999,
          },
        },
      ],
    });
  });

  it("rejects duplicate source entry keys before RPC invocation", () => {
    expect(() =>
      buildStageCatalogueSourceRpcPayload({
        sourceProvider: "catalogue_upload",
        sourceDocumentName: "Oasis catalogue",
        dedupeKey: "catalogue:2026-2027:rev-1",
        entries: [
          { sourceEntryKey: "same", rawSourceData: {} },
          { sourceEntryKey: " same ", rawSourceData: {} },
        ],
      }),
    ).toThrow("Duplicate source entry key");
  });

  it("rejects invalid source page numbers", () => {
    expect(() =>
      buildStageCatalogueSourceRpcPayload({
        sourceProvider: "catalogue_upload",
        sourceDocumentName: "Oasis catalogue",
        dedupeKey: "catalogue:2026-2027:rev-1",
        entries: [{ sourceEntryKey: "entry-1", sourcePageNumber: 0, rawSourceData: {} }],
      }),
    ).toThrow("must be a positive integer");
  });

  it("rejects an empty intake rather than inventing catalogue records", () => {
    expect(() =>
      buildStageCatalogueSourceRpcPayload({
        sourceProvider: "catalogue_upload",
        sourceDocumentName: "Oasis catalogue",
        dedupeKey: "catalogue:2026-2027:rev-1",
        entries: [],
      }),
    ).toThrow("At least one catalogue source entry is required.");
  });
});
