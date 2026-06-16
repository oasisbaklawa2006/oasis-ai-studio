import { describe, expect, it } from "vitest";
import { buildProductReadinessSnapshot } from "@/features/readiness/productReadinessSnapshot";
import {
  dimensionMediaCardLabel,
  labelStatusInfoLine,
  mediaGovernanceStatusLine,
  productCardMediaNeedLabel,
} from "./mediaGovernanceDisplay";

describe("mediaGovernanceDisplay", () => {
  it("uses hero-only labels in testing mode", () => {
    import.meta.env.VITE_MEDIA_GOVERNANCE_MODE = "testing";

    expect(productCardMediaNeedLabel()).toBe("Needs hero image");
    expect(
      mediaGovernanceStatusLine({
        complete: true,
        heroUrl: "https://cdn/hero.jpg",
        derivedStatus: "approved",
      }),
    ).toBe("Complete");
    expect(
      mediaGovernanceStatusLine({
        complete: false,
        heroUrl: null,
        derivedStatus: "missing",
      }),
    ).toBe("Needs hero image");
    expect(labelStatusInfoLine("draft")).toContain("label designer not part of current catalogue readiness");
  });

  it("maps readiness snapshot media dimension to Complete when hero approved", () => {
    import.meta.env.VITE_MEDIA_GOVERNANCE_MODE = "testing";

    const { readiness } = buildProductReadinessSnapshot(
      {
        product_name: "Bourma Pistachio",
        sku: "OAS-TEST",
        hero_image_url: "https://cdn/hero.jpg",
        hsn_code: "19053290",
        gst_rate: 5,
      },
      {
        productMediaRows: [
          { type: "hero_image", file_url: "https://cdn/hero.jpg", status: "approved" },
        ],
      },
    );

    expect(dimensionMediaCardLabel(readiness)).toBe("Complete");
  });
});
