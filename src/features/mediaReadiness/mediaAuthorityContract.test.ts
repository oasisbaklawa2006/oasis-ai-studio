import { describe, expect, it } from "vitest";
import {
  authoritativeMediaAssets,
  deriveHeroUrlFromMediaRows,
  deriveMediaStatusFromRows,
} from "./mediaAuthorityContract";
import { buildProductReadinessSnapshot } from "@/features/readiness/productReadinessSnapshot";

describe("mediaAuthorityContract", () => {
  it("derives approved status when governed required slots are approved (testing: hero only)", () => {
    import.meta.env.VITE_MEDIA_GOVERNANCE_MODE = "testing";
    expect(
      deriveMediaStatusFromRows([
        { type: "hero_image", file_url: "https://a/1.jpg", status: "approved" },
        { type: "white_background", file_url: "https://a/2.jpg", status: "raw" },
      ]),
    ).toBe("approved");
  });

  it("uses product_media only when rows exist (ignores stale form hero)", () => {
    const assets = authoritativeMediaAssets(
      [{ type: "hero_image", file_url: "https://db/h.jpg", status: "raw" }],
      { hero_image_url: "https://form/h.jpg", media_status: "approved" },
    );
    expect(assets[0]?.url).toBe("https://db/h.jpg");
    expect(assets[0]?.status).toBe("pending_approval");
  });

  it("returns missing when no rows and no hero", () => {
    expect(authoritativeMediaAssets([], {})).toEqual([]);
  });

  it("accepts products.hero_image_url as approved hero in testing when no media rows", () => {
    import.meta.env.VITE_MEDIA_GOVERNANCE_MODE = "testing";
    expect(
      deriveMediaStatusFromRows([], { fallbackHeroUrl: "https://cdn/hero.jpg" }),
    ).toBe("approved");
  });

  it("does not use raw_photo when no approved hero_image row exists", () => {
    import.meta.env.VITE_MEDIA_GOVERNANCE_MODE = "testing";
    const rows = [{ type: "raw_photo", file_url: "https://cdn/h.jpg", status: "approved" }];
    expect(
      deriveMediaStatusFromRows(rows, { fallbackHeroUrl: "https://cdn/h.jpg" }),
    ).toBe("approved");
    expect(deriveHeroUrlFromMediaRows(rows)).toBeNull();
  });

  it("testing-mode product readiness completes when approved hero_image row persists", () => {
    import.meta.env.VITE_MEDIA_GOVERNANCE_MODE = "testing";
    const snap = buildProductReadinessSnapshot(
      {
        id: "p1",
        product_name: "Smoke Test Bourma",
        sku: "OAS-AS-BKL-PST-LOOSE-9922",
        main_department: "packing_assembly",
      },
      {
        productMediaRows: [
          {
            product_id: "p1",
            type: "hero_image",
            file_url: "https://cdn/hero.jpg",
            status: "approved",
          },
        ],
      },
    );
    const media = snap.readiness.dimensions.find((d) => d.dimension === "media_status");
    expect(media?.complete).toBe(true);
    expect(snap.derivedMediaStatus).toBe("approved");
  });
});
