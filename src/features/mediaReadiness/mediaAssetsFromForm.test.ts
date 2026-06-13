import { describe, expect, it } from "vitest";
import {
  mediaAssetsFromProductMedia,
  mediaAssetsFromSources,
  slotDisplayLabel,
} from "./mediaAssetsFromForm";

describe("mediaAssetsFromProductMedia", () => {
  it("maps uploader types to authoritative readiness slots", () => {
    const assets = mediaAssetsFromProductMedia([
      { type: "hero_image", file_url: "https://cdn/a.jpg", status: "raw" },
      { type: "lifestyle", file_url: "https://cdn/b.jpg", status: "raw" },
      { type: "closeup", file_url: "https://cdn/c.jpg", status: "raw" },
      { type: "white_background", file_url: "https://cdn/d.jpg", status: "raw" },
    ]);

    const byType = Object.fromEntries(assets.map((a) => [a.type, a]));
    expect(byType.primary_image?.url).toBe("https://cdn/a.jpg");
    expect(byType.lifestyle_image?.url).toBe("https://cdn/b.jpg");
    expect(byType.close_up_image?.url).toBe("https://cdn/c.jpg");
    expect(byType.catalogue_image?.url).toBe("https://cdn/d.jpg");
  });

  it("maps angle shots to secondary_angle", () => {
    const assets = mediaAssetsFromProductMedia([
      { type: "side_angle", file_url: "https://cdn/s.jpg", status: "approved" },
    ]);
    expect(assets[0]?.type).toBe("secondary_angle");
  });

  it("treats raw uploads as pending approval, not missing", () => {
    const assets = mediaAssetsFromProductMedia([
      { type: "hero_image", file_url: "https://cdn/a.jpg", status: "raw" },
    ]);
    expect(assets[0]?.status).toBe("pending_approval");
    expect(slotDisplayLabel({ present: true, approved: false, status: "pending_approval" })).toBe(
      "draft pending approval",
    );
  });

  it("merges product_media over form hero for the same slot", () => {
    const assets = mediaAssetsFromSources({
      form: { hero_image_url: "https://form/hero.jpg" },
      productMediaRows: [
        { type: "hero_image", file_url: "https://db/hero.jpg", status: "approved" },
      ],
    });
    const primary = assets.find((a) => a.type === "primary_image");
    expect(primary?.url).toBe("https://db/hero.jpg");
    expect(primary?.status).toBe("approved");
  });
});
