import { describe, expect, it } from "vitest";
import { resolveProductCardHeroMeta } from "./productImage";

describe("resolveProductCardHeroMeta", () => {
  it("uses media-row dimensions when hero comes from approved media row", () => {
    const meta = resolveProductCardHeroMeta(
      {
        hero_image_url: "https://cdn.example/stale.jpg",
        hero_image_width_px: 2000,
        hero_image_height_px: 2000,
      },
      [
        {
          type: "hero_image",
          file_url: "https://cdn.example/media-hero.jpg",
          status: "approved",
          created_at: "2026-01-02T00:00:00Z",
          width_px: 2400,
          height_px: 1800,
        },
      ],
    );
    expect(meta.url).toBe("https://cdn.example/media-hero.jpg");
    expect(meta.widthPx).toBe(2400);
    expect(meta.heightPx).toBe(1800);
    expect(meta.source).toBe("media_row");
  });

  it("returns null dimensions for media row when width_px/height_px absent", () => {
    const meta = resolveProductCardHeroMeta(
      {
        hero_image_url: "https://cdn.example/stale.jpg",
        hero_image_width_px: 2000,
        hero_image_height_px: 2000,
      },
      [
        {
          type: "hero_image",
          file_url: "https://cdn.example/media-hero.jpg",
          status: "approved",
          created_at: "2026-01-02T00:00:00Z",
        },
      ],
    );
    expect(meta.url).toBe("https://cdn.example/media-hero.jpg");
    expect(meta.widthPx).toBeNull();
    expect(meta.heightPx).toBeNull();
    expect(meta.source).toBe("media_row");
  });

  it("uses product dimensions when hero comes from product column", () => {
    const meta = resolveProductCardHeroMeta({
      hero_image_url: "https://cdn.example/product-hero.jpg",
      hero_image_width_px: 1600,
      hero_image_height_px: 1400,
    });
    expect(meta.url).toBe("https://cdn.example/product-hero.jpg");
    expect(meta.widthPx).toBe(1600);
    expect(meta.heightPx).toBe(1400);
    expect(meta.source).toBe("product_column");
  });
});
