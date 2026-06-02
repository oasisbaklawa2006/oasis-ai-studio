import { describe, expect, it } from "vitest";
import {
  canSyncMediaToCentral,
  evaluateMediaReadiness,
  getMissingMediaAssets,
  selectApprovedImageUrlsForCentral,
} from "./mediaReadinessEngine";
import type { MediaAsset, ProductMediaContext } from "./types";

const baklawaProduct: ProductMediaContext = {
  category: "Baklawa",
  subcategory: "Pyramid",
};

const giftProduct: ProductMediaContext = {
  productClass: "ready_pack",
  subcategory: "Acrylic Box",
};

const exportProduct: ProductMediaContext = {
  productClass: "export",
  category: "Export",
};

function asset(
  type: MediaAsset["type"],
  status: MediaAsset["status"] = "approved",
  source: MediaAsset["source"] = "manual",
): MediaAsset {
  return {
    type,
    url: `https://cdn.example/${type}.jpg`,
    status,
    source,
  };
}

describe("mediaReadinessEngine", () => {
  it("Baklawa requires pairing image", () => {
    const assets = [asset("primary_image"), asset("close_up_image")];
    const missing = getMissingMediaAssets(baklawaProduct, assets);
    expect(missing).toContain("pairing_image");
  });

  it("Gift box requires closed and open pack images", () => {
    const assets = [asset("primary_image")];
    const missing = getMissingMediaAssets(giftProduct, assets);
    expect(missing).toContain("pack_front_image");
    expect(missing).toContain("open_pack_image");
  });

  it("Export pack requires label and carton media", () => {
    const assets = [asset("label_front_image")];
    const missing = getMissingMediaAssets(exportProduct, assets);
    expect(missing).toContain("label_back_image");
    expect(missing).toContain("master_carton_image");
  });

  it("missing required media blocks media readiness", () => {
    const r = evaluateMediaReadiness(baklawaProduct, [asset("primary_image")]);
    expect(r.canPublishMedia).toBe(false);
    expect(r.canSyncMediaToCentral).toBe(false);
    expect(r.blockers.length).toBeGreaterThan(0);
  });

  it("approved media URLs selected for Central payload", () => {
    const assets = [
      asset("primary_image"),
      asset("pairing_image"),
      asset("close_up_image"),
    ];
    const urls = selectApprovedImageUrlsForCentral(assets);
    expect(urls).toHaveLength(3);
  });

  it("unapproved media excluded from Central payload", () => {
    const assets = [
      asset("primary_image", "approved"),
      asset("pairing_image", "draft"),
      asset("close_up_image", "approved"),
    ];
    const urls = selectApprovedImageUrlsForCentral(assets);
    expect(urls).toHaveLength(2);
    expect(urls).not.toContain("https://cdn.example/pairing_image.jpg");
  });

  it("complete Baklawa media passes Central sync gate", () => {
    const assets = [
      asset("primary_image"),
      asset("pairing_image"),
      asset("close_up_image"),
    ];
    expect(canSyncMediaToCentral(baklawaProduct, assets)).toBe(true);
  });

  it("legacy product does not throw and shows incomplete status", () => {
    const r = evaluateMediaReadiness(
      { ...baklawaProduct, isLegacy: true },
      [],
    );
    expect(r.isLegacy).toBe(true);
    expect(r.canPublishMedia).toBe(false);
    expect(r.blockers.some((b) => b.toLowerCase().includes("legacy"))).toBe(true);
  });
});
