import { describe, expect, it } from "vitest";
import { isCatalogueCollectionAuthoringAvailable } from "./dataSource";

describe("isCatalogueCollectionAuthoringAvailable", () => {
  it("allows governed Supabase persistence", () => {
    expect(isCatalogueCollectionAuthoringAvailable("supabase")).toBe(true);
  });

  it("allows the explicit development-only local fallback", () => {
    expect(isCatalogueCollectionAuthoringAvailable("local_only")).toBe(true);
  });

  it("fails closed when the governed collection contract is unavailable", () => {
    expect(isCatalogueCollectionAuthoringAvailable("supabase_unavailable")).toBe(false);
  });
});
