import { describe, expect, it } from "vitest";
import {
  authoritativeMediaAssets,
  deriveMediaStatusFromRows,
} from "./mediaAuthorityContract";

describe("mediaAuthorityContract", () => {
  it("derives approved status when all rows are approved", () => {
    expect(
      deriveMediaStatusFromRows([
        { type: "hero_image", file_url: "https://a/1.jpg", status: "approved" },
        { type: "white_background", file_url: "https://a/2.jpg", status: "approved" },
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
});
