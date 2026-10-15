import { describe, expect, it } from "vitest";
import {
  isMediaCatalogueApprovalAvailable,
  isMediaDraftApprovalUiBlocked,
  MEDIA_CATALOGUE_APPROVAL_BLOCKED_MESSAGE,
} from "./mediaCatalogueApprovalPolicy";

describe("mediaCatalogueApprovalPolicy", () => {
  it("exposes the existing Core media approval capability without a local backend", () => {
    expect(isMediaCatalogueApprovalAvailable()).toBe(true);
    expect(MEDIA_CATALOGUE_APPROVAL_BLOCKED_MESSAGE).toMatch(/not finalized/i);
  });

  it("does not suppress canonical media approval after the Core mapping deployment", () => {
    expect(isMediaDraftApprovalUiBlocked("media")).toBe(false);
    expect(isMediaDraftApprovalUiBlocked("product")).toBe(false);
    expect(isMediaDraftApprovalUiBlocked("alias")).toBe(false);
  });
});
