import { describe, expect, it } from "vitest";
import {
  isMediaCatalogueApprovalAvailable,
  MEDIA_CATALOGUE_APPROVAL_BLOCKED_MESSAGE,
} from "./mediaCatalogueApprovalPolicy";

describe("mediaCatalogueApprovalPolicy", () => {
  it("fail-closes media catalogue approval until Core mapping is finalized", () => {
    expect(isMediaCatalogueApprovalAvailable()).toBe(false);
    expect(MEDIA_CATALOGUE_APPROVAL_BLOCKED_MESSAGE).toMatch(/not finalized/i);
  });
});
