import { describe, expect, it } from "vitest";
import { batchProductIds, RUNTIME_CATALOG_ALIAS_BATCH_SIZE } from "../runtime/catalogLexicon";

describe("runtime catalog bulk alias batching", () => {
  it("uses one bulk alias query per product batch instead of per product", () => {
    expect(batchProductIds([], RUNTIME_CATALOG_ALIAS_BATCH_SIZE)).toEqual([]);
    expect(batchProductIds(["a"], RUNTIME_CATALOG_ALIAS_BATCH_SIZE)).toEqual([["a"]]);
    expect(batchProductIds(["a", "b", "c"], 2)).toEqual([["a", "b"], ["c"]]);
    const manyIds = Array.from({ length: 401 }, (_, index) => `p-${index}`);
    expect(batchProductIds(manyIds, RUNTIME_CATALOG_ALIAS_BATCH_SIZE)).toHaveLength(3);
  });
});
