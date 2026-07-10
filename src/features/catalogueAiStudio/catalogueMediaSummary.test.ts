import { describe, expect, it } from "vitest";
import { summarizeCatalogueMedia } from "./catalogueMediaSummary";

describe("summarizeCatalogueMedia", () => {
  it("resolves the hero URL via the shared media authority (approved hero_image row wins)", () => {
    const summary = summarizeCatalogueMedia(
      { hero_image_url: "https://cdn.example/legacy-hero.jpg" },
      [
        { id: "m1", type: "hero_image", status: "approved", file_url: "https://cdn.example/hero.jpg", created_at: "2026-01-01T00:00:00Z" },
      ],
    );
    expect(summary.heroUrl).toBe("https://cdn.example/hero.jpg");
  });

  it("falls back to the product row hero when no approved hero media row exists", () => {
    const summary = summarizeCatalogueMedia({ hero_image_url: "https://cdn.example/legacy-hero.jpg" }, []);
    expect(summary.heroUrl).toBe("https://cdn.example/legacy-hero.jpg");
  });

  it("lists approved non-hero media, newest first, with human-readable type labels", () => {
    const summary = summarizeCatalogueMedia(null, [
      { id: "a", type: "closeup", status: "approved", file_url: "https://cdn.example/a.jpg", created_at: "2026-01-01T00:00:00Z" },
      { id: "b", type: "lifestyle", status: "approved", file_url: "https://cdn.example/b.jpg", created_at: "2026-06-01T00:00:00Z" },
    ]);
    expect(summary.approvedMedia.map((m) => m.id)).toEqual(["b", "a"]);
    expect(summary.approvedMedia[0].typeLabel).toBe("Lifestyle");
  });

  it("excludes pending/draft/rejected media from the approved list", () => {
    const summary = summarizeCatalogueMedia(null, [
      { id: "p", type: "closeup", status: "pending_approval", file_url: "https://cdn.example/p.jpg" },
      { id: "r", type: "closeup", status: "rejected", file_url: "https://cdn.example/r.jpg" },
    ]);
    expect(summary.approvedMedia).toEqual([]);
  });

  it("excludes the hero row from the non-hero approved list", () => {
    const summary = summarizeCatalogueMedia(null, [
      { id: "h", type: "hero_image", status: "approved", file_url: "https://cdn.example/hero.jpg" },
    ]);
    expect(summary.approvedMedia).toEqual([]);
    expect(summary.heroUrl).toBe("https://cdn.example/hero.jpg");
  });

  it("reports no media when nothing is approved", () => {
    const summary = summarizeCatalogueMedia(null, []);
    expect(summary.heroUrl).toBeNull();
    expect(summary.approvedCount).toBe(0);
  });
});
