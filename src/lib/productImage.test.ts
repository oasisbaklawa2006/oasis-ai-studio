import { describe, expect, it } from "vitest";
import { buildProductReadinessSnapshot } from "@/features/readiness/productReadinessSnapshot";
import {
  heroUrlWritePayload,
  latestApprovedHeroUrlFromMediaRows,
  resolveProductCardHeroUrl,
  resolveProductHeroUrl,
} from "./productImage";

describe("productImage", () => {
  it("prefers hero_image_url over image_url", () => {
    expect(
      resolveProductHeroUrl({
        hero_image_url: "https://cdn.example/hero.jpg",
        image_url: "https://cdn.example/central.jpg",
      }),
    ).toBe("https://cdn.example/hero.jpg");
  });

  it("falls back to image_url from Central", () => {
    expect(resolveProductHeroUrl({ image_url: "https://cdn.example/central.jpg" })).toBe(
      "https://cdn.example/central.jpg",
    );
  });

  it("writes both columns for sync", () => {
    expect(heroUrlWritePayload("https://cdn.example/x.jpg")).toEqual({
      hero_image_url: "https://cdn.example/x.jpg",
      image_url: "https://cdn.example/x.jpg",
    });
  });

  it("card hero prefers products.hero_image_url over stale older media row", () => {
    const product = {
      hero_image_url: "https://cdn.example/baklawa.jpg",
      image_url: "https://cdn.example/baklawa.jpg",
    };
    const mediaRows = [
      {
        type: "hero_image",
        file_url: "https://cdn.example/wrong-book.jpg",
        status: "approved",
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        type: "hero_image",
        file_url: "https://cdn.example/baklawa.jpg",
        status: "approved",
        created_at: "2026-02-01T00:00:00Z",
      },
    ];

    expect(resolveProductCardHeroUrl(product, mediaRows)).toBe("https://cdn.example/baklawa.jpg");
  });

  it("uses latest approved hero_image media when products.hero_image_url is empty", () => {
    const mediaRows = [
      {
        type: "hero_image",
        file_url: "https://cdn.example/wrong-book.jpg",
        status: "approved",
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        type: "hero_image",
        file_url: "https://cdn.example/baklawa.jpg",
        status: "approved",
        created_at: "2026-03-01T00:00:00Z",
      },
    ];

    expect(latestApprovedHeroUrlFromMediaRows(mediaRows)).toBe("https://cdn.example/baklawa.jpg");
    expect(resolveProductCardHeroUrl({ hero_image_url: null, image_url: null }, mediaRows)).toBe(
      "https://cdn.example/baklawa.jpg",
    );
  });

  it("ignores raw_photo and non-approved hero rows", () => {
    const mediaRows = [
      { type: "raw_photo", file_url: "https://cdn.example/book.jpg", status: "approved", created_at: "2026-03-01T00:00:00Z" },
      { type: "hero_image", file_url: "https://cdn.example/pending.jpg", status: "pending", created_at: "2026-04-01T00:00:00Z" },
      { type: "hero_image", file_url: "https://cdn.example/deleted.jpg", status: "rejected", created_at: "2026-05-01T00:00:00Z" },
    ];

    expect(latestApprovedHeroUrlFromMediaRows(mediaRows)).toBeNull();
    expect(resolveProductCardHeroUrl({ hero_image_url: null, image_url: "https://cdn.example/legacy.jpg" }, mediaRows)).toBe(
      "https://cdn.example/legacy.jpg",
    );
  });

  it("detail readiness snapshot and list card resolve the same hero after hero replacement", () => {
    const productRow = {
      id: "p1",
      product_name: "Baklawa",
      sku: "OAS-BKL-001",
      hero_image_url: "https://cdn.example/baklawa.jpg",
      image_url: "https://cdn.example/baklawa.jpg",
      main_department: "ready_goods_store",
    };
    const mediaRows = [
      {
        type: "hero_image",
        file_url: "https://cdn.example/wrong-book.jpg",
        status: "approved",
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        type: "hero_image",
        file_url: "https://cdn.example/baklawa.jpg",
        status: "approved",
        created_at: "2026-02-15T00:00:00Z",
      },
    ];

    const snapshot = buildProductReadinessSnapshot(productRow, { productMediaRows: mediaRows });
    const listHero = resolveProductCardHeroUrl(productRow, mediaRows);
    const detailHero = resolveProductHeroUrl({
      hero_image_url: productRow.hero_image_url,
      image_url: productRow.image_url,
    });

    expect(listHero).toBe("https://cdn.example/baklawa.jpg");
    expect(detailHero).toBe("https://cdn.example/baklawa.jpg");
    expect(snapshot.derivedHeroUrl).toBe("https://cdn.example/baklawa.jpg");
  });
});
