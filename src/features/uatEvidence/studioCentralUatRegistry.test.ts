import { describe, expect, it } from "vitest";
import {
  assertStudioCentralUatRegistry,
  getStudioCentralUatCase,
  STUDIO_CENTRAL_UAT_EVIDENCE_CASES,
  STUDIO_CENTRAL_UAT_IDS,
} from "./studioCentralUatRegistry";

describe("studioCentralUatRegistry", () => {
  it("defines stable Central census mapping for UAT-0122..0127", () => {
    assertStudioCentralUatRegistry();
    expect(STUDIO_CENTRAL_UAT_IDS).toEqual([
      "UAT-0122",
      "UAT-0123",
      "UAT-0124",
      "UAT-0125",
      "UAT-0126",
      "UAT-0127",
    ]);
  });

  it("maps each UAT ID to the governed route and device profile", () => {
    expect(getStudioCentralUatCase("UAT-0122")).toMatchObject({
      pathname: "/",
      deviceProfile: "desktop",
      uiState: "default",
    });
    expect(getStudioCentralUatCase("UAT-0123")).toMatchObject({
      pathname: "/media",
      deviceProfile: "phone",
    });
    expect(getStudioCentralUatCase("UAT-0124")).toMatchObject({
      pathname: "/media/review",
      deviceProfile: "desktop",
    });
    expect(getStudioCentralUatCase("UAT-0127")).toMatchObject({
      pathname: "/media",
      uiState: "camera-capture-flow",
      deviceProfile: "phone",
    });
  });

  it("keeps /media/review as canonical review route (not an invented path)", () => {
    const review = STUDIO_CENTRAL_UAT_EVIDENCE_CASES.find((c) => c.uatId === "UAT-0124");
    expect(review?.pathname).toBe("/media/review");
  });
});
