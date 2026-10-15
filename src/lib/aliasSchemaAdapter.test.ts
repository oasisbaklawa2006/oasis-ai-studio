import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/integrations/supabase/types";
import {
  insertProductAlias,
  insertProductAliases,
  isAliasSchemaMismatchError,
  queryAliasesByPattern,
  queryProductAliasesForProductsResult,
  toCoreAliasInsert,
} from "./aliasSchemaAdapter";

function fixture(error: { message: string } | null = null) {
  const result = { data: error ? null : { id: "alias-id" }, error };
  const insert = vi.fn(() => ({ select: () => ({ single: async () => result }) }));
  const order = vi.fn(async () => ({ data: [], error }));
  const ids = vi.fn(() => ({ order }));
  const ilike = vi.fn(async () => ({ data: [], error }));
  const select = vi.fn(() => ({ in: ids, ilike }));
  const from = vi.fn(() => ({ insert, select }));
  return {
    client: { from } as unknown as SupabaseClient<Database>,
    from,
    insert,
    select,
    ids,
    ilike,
  };
}
const valid = {
  product_id: " core-id ",
  alias: " Baklava ",
  canonical_name: " Canonical name ",
  language: "ar",
  is_active: true,
};

describe("canonical Core aliases", () => {
  it("identifies historical schema errors without retrying another authority", () => {
    expect(isAliasSchemaMismatchError("column product_aliases.alias does not exist")).toBe(true);
    expect(isAliasSchemaMismatchError("duplicate key value violates unique constraint")).toBe(
      false,
    );
  });
  it("writes only deployed Core columns and preserves product identity", async () => {
    const f = fixture();
    expect(await insertProductAlias(f.client, valid)).toEqual({
      data: { id: "alias-id" },
      error: null,
    });
    expect(f.insert).toHaveBeenCalledWith({
      product_id: "core-id",
      alias_text: "Baklava",
      canonical_name: "Canonical name",
    });
    expect(f.insert).toHaveBeenCalledTimes(1);
  });
  it.each([
    "product_id",
    "alias",
    "canonical_name",
  ] as const)("rejects missing %s before a network write", async (key) => {
    const f = fixture();
    expect((await insertProductAlias(f.client, { ...valid, [key]: " " })).error).not.toBeNull();
    expect(f.from).not.toHaveBeenCalled();
  });
  it("validates the entire batch before submitting any row", async () => {
    const f = fixture();
    expect(
      (await insertProductAliases(f.client, [valid, { ...valid, canonical_name: "" }])).error,
    ).not.toBeNull();
    expect(f.from).not.toHaveBeenCalled();
  });
  it("does not retry schema or duplicate errors with a competing payload", async () => {
    const f = fixture({ message: "column product_aliases.alias does not exist" });
    expect((await insertProductAlias(f.client, valid)).error).not.toBeNull();
    expect(f.insert).toHaveBeenCalledTimes(1);
  });
  it("returns uncertain network failures without retrying the mutation", async () => {
    const f = fixture();
    f.insert.mockImplementation(() => {
      throw new Error("connection interrupted");
    });
    expect((await insertProductAlias(f.client, valid)).error?.message).toBe(
      "connection interrupted",
    );
    expect(f.insert).toHaveBeenCalledTimes(1);
  });
  it("deduplicates product IDs and queries no absent metadata columns", async () => {
    const f = fixture();
    await queryProductAliasesForProductsResult(f.client, [" core-id ", "core-id", ""]);
    expect(f.ids).toHaveBeenCalledWith("product_id", ["core-id"]);
    expect(f.select).toHaveBeenCalledWith("id, alias_text, canonical_name, product_id");
  });
  it("keeps alias patterns out of PostgREST logical filter grammar", async () => {
    const f = fixture();
    const pattern = "%,product_id.eq.other)%";
    await queryAliasesByPattern(f.client, pattern);
    expect(f.ilike).toHaveBeenCalledWith("alias_text", pattern);
  });
  it("does not invent a canonical name", () => {
    expect(() => toCoreAliasInsert({ ...valid, canonical_name: undefined })).toThrow(
      /canonical product name/,
    );
  });
});
