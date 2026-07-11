import { describe, expect, it } from "vitest";
import {
  isInvalidCatalogueStudioTab,
  resolveCatalogueStudioTab,
  withSelectedProduct,
  withStudioTab,
} from "./catalogueStudioUrlState";

describe("resolveCatalogueStudioTab", () => {
  it("returns every real tab value unchanged", () => {
    for (const tab of ["content", "language", "media", "packaging", "export"]) {
      expect(resolveCatalogueStudioTab(tab)).toBe(tab);
    }
  });

  it("falls back to 'content' for null, empty, or an unrecognized value", () => {
    expect(resolveCatalogueStudioTab(null)).toBe("content");
    expect(resolveCatalogueStudioTab("")).toBe("content");
    expect(resolveCatalogueStudioTab("bogus-old-bookmark")).toBe("content");
  });
});

describe("isInvalidCatalogueStudioTab", () => {
  it("is false for null (no tab in the URL yet — not an error) and every real tab", () => {
    expect(isInvalidCatalogueStudioTab(null)).toBe(false);
    for (const tab of ["content", "language", "media", "packaging", "export"]) {
      expect(isInvalidCatalogueStudioTab(tab)).toBe(false);
    }
  });

  it("is true only when a tab value is present but not real", () => {
    expect(isInvalidCatalogueStudioTab("bogus")).toBe(true);
    expect(isInvalidCatalogueStudioTab("")).toBe(false);
  });
});

describe("withSelectedProduct", () => {
  it("sets ?product= without disturbing other existing params", () => {
    const prev = new URLSearchParams("tab=media&foo=bar");
    const next = withSelectedProduct(prev, "p1");
    expect(next.get("product")).toBe("p1");
    expect(next.get("tab")).toBe("media");
    expect(next.get("foo")).toBe("bar");
  });

  it("does not mutate the input params object", () => {
    const prev = new URLSearchParams("product=old");
    withSelectedProduct(prev, "new");
    expect(prev.get("product")).toBe("old");
  });
});

describe("withStudioTab", () => {
  it("sets ?tab= without disturbing other existing params", () => {
    const prev = new URLSearchParams("product=p1");
    const next = withStudioTab(prev, "language");
    expect(next.get("tab")).toBe("language");
    expect(next.get("product")).toBe("p1");
  });

  it("does not mutate the input params object", () => {
    const prev = new URLSearchParams("tab=content");
    withStudioTab(prev, "media");
    expect(prev.get("tab")).toBe("content");
  });
});
