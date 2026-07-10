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
        hero_image_url: mediaResolvedHeroUrl ?? rawColumnBlank.hero_image_url,
      });
      expect(categories.find((c) => c.key === "hero_image")?.state).toBe("pass");
    },
  );
});
