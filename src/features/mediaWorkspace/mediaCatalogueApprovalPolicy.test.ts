import { describe, expect, it } from "vitest";
import {
  isMediaCatalogueApprovalAvailable,
  isMediaDraftApprovalUiBlocked,
  MEDIA_CATALOGUE_APPROVAL_BLOCKED_MESSAGE,
} from "./mediaCatalogueApprovalPolicy";

describe("mediaCatalogueApprovalPolicy", () => {
  it("fail-closes media catalogue approval until Core mapping is finalized", () => {
    expect(isMediaCatalogueApprovalAvailable()).toBe(false);
    expect(MEDIA_CATALOGUE_APPROVAL_BLOCKED_MESSAGE).toMatch(/not finalized/i);
  });

  it("blocks media Approve UI in review surfaces while policy is fail-closed", () => {
    expect(isMediaDraftApprovalUiBlocked("media")).toBe(true);
    expect(isMediaDraftApprovalUiBlocked("product")).toBe(false);
    expect(isMediaDraftApprovalUiBlocked("alias")).toBe(false);
  });
});
