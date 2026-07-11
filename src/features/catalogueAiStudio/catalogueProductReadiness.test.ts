import { describe, expect, it } from "vitest";
import { computeCatalogueProductReadiness } from "./catalogueProductReadiness";

describe("computeCatalogueProductReadiness — hero image category", () => {
  it("passes when hero_image_url is set directly on the input", () => {
    const { categories } = computeCatalogueProductReadiness({ hero_image_url: "https://cdn.example/hero.jpg" });
    expect(categories.find((c) => c.key === "hero_image")?.state).toBe("pass");
  });

  it("is missing when hero_image_url is blank", () => {
    const { categories } = computeCatalogueProductReadiness({});
    expect(categories.find((c) => c.key === "hero_image")?.state).toBe("missing");
  });

  it(
    "reflects a media-authority-resolved hero URL passed in place of the raw column " +
      "(CatalogueProductStudio.tsx feeds mediaSummary.heroUrl here so readiness never disagrees " +
      "with the anchor/Media tab — Bugbot regression)",
    () => {
      // Simulates the exact override CatalogueProductStudio.tsx applies: the raw column is blank,
      // but an approved product_media hero row resolves a URL via summarizeCatalogueMedia().
      const rawColumnBlank = { hero_image_url: null };
      const mediaResolvedHeroUrl = "https://cdn.example/approved-hero.jpg";
      const { categories } = computeCatalogueProductReadiness({
        ...rawColumnBlank,
        hero_image_url: mediaResolvedHeroUrl,
      });
      expect(categories.find((c) => c.key === "hero_image")?.state).toBe("pass");
    },
  );

  it(
    "does NOT fall back to the raw hero_image_url column when mediaSummary.heroUrl is null " +
      "(Bugbot regression: a `?? selected.hero_image_url` fallback on the page used to re-leak " +
      "the legacy column here even when product_media rows exist with no approved hero — the page " +
      "now passes mediaSummary.heroUrl straight through with no further fallback)",
    () => {
      const { categories } = computeCatalogueProductReadiness({
        hero_image_url: null,
      });
      expect(categories.find((c) => c.key === "hero_image")?.state).toBe("missing");
    },
  );
});
