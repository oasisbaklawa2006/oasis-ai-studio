import { afterEach, describe, expect, it } from "vitest";
import {
  getMediaGovernanceMode,
  governedRequiredProfileSlots,
  governedRecommendedProfileSlots,
} from "./mediaGovernanceMode";
import { evaluateMediaReadiness, getMissingMediaAssets } from "./mediaReadinessEngine";
import type { MediaAsset, ProductMediaContext } from "./types";

const baklawaProduct: ProductMediaContext = {
  category: "Baklawa",
  subcategory: "Pyramid",
};

function asset(
  type: MediaAsset["type"],
  status: MediaAsset["status"] = "approved",
): MediaAsset {
  return {
    type,
    url: `https://cdn.example/${type}.jpg`,
    status,
    source: "manual",
  };
}

function withMode(mode: string, fn: () => void) {
  const prev = import.meta.env.VITE_MEDIA_GOVERNANCE_MODE;
  import.meta.env.VITE_MEDIA_GOVERNANCE_MODE = mode;
  try {
    fn();
  } finally {
    import.meta.env.VITE_MEDIA_GOVERNANCE_MODE = prev;
  }
}

afterEach(() => {
  import.meta.env.VITE_MEDIA_GOVERNANCE_MODE = "testing";
});

describe("mediaGovernanceMode", () => {
  it("defaults to testing when env unset", () => {
    import.meta.env.VITE_MEDIA_GOVERNANCE_MODE = "";
    expect(getMediaGovernanceMode()).toBe("testing");
  });

  it("testing mode requires hero only for Baklawa profile", () => {
    withMode("testing", () => {
      const required = governedRequiredProfileSlots(baklawaProduct);
      expect(required.map((s) => s.type)).toEqual(["primary_image"]);
      const recommended = governedRecommendedProfileSlots(baklawaProduct);
      expect(recommended.some((s) => s.type === "catalogue_image")).toBe(true);
      expect(recommended.some((s) => s.type === "close_up_image")).toBe(true);
    });
  });

  it("pilot mode requires hero and white background", () => {
    withMode("pilot", () => {
      const required = governedRequiredProfileSlots(baklawaProduct).map((s) => s.type);
      expect(required).toContain("primary_image");
      expect(required).toContain("catalogue_image");
      expect(required).not.toContain("close_up_image");
    });
  });

  it("approved hero alone passes readiness in testing mode", () => {
    withMode("testing", () => {
      const r = evaluateMediaReadiness(baklawaProduct, [asset("primary_image")]);
      expect(r.canPublishMedia).toBe(true);
      expect(r.canSyncMediaToCentral).toBe(true);
      expect(r.blockers).toHaveLength(0);
      expect(getMissingMediaAssets(baklawaProduct, [asset("primary_image")])).toEqual([]);
    });
  });

  it("missing white background does not block in testing mode", () => {
    withMode("testing", () => {
      const assets = [asset("primary_image"), asset("close_up_image")];
      const missing = getMissingMediaAssets(baklawaProduct, assets);
      expect(missing).not.toContain("catalogue_image");
      expect(evaluateMediaReadiness(baklawaProduct, assets).canPublishMedia).toBe(true);
    });
  });

  it("production mode keeps category profile requirements", () => {
    withMode("production", () => {
      const missing = getMissingMediaAssets(baklawaProduct, [asset("primary_image")]);
      expect(missing).toContain("catalogue_image");
      expect(missing).toContain("close_up_image");
    });
  });
});
