import { describe, expect, it } from "vitest";
import { isAliasSchemaMismatchError } from "./aliasSchemaAdapter";

describe("aliasSchemaAdapter", () => {
  it("detects missing migration alias column errors", () => {
    expect(isAliasSchemaMismatchError("column product_aliases.alias does not exist")).toBe(true);
    expect(isAliasSchemaMismatchError("Could not find the 'alias' column")).toBe(true);
    expect(isAliasSchemaMismatchError("duplicate key value violates unique constraint")).toBe(false);
  });
});
