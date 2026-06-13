import { describe, expect, it } from "vitest";
import { heroUrlWritePayload, resolveProductHeroUrl } from "./productImage";

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
});
