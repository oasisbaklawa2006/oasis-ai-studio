import { describe, expect, it } from "vitest";
import { CATALOGUE_DRAFT_STATUSES, type CatalogueDraftStatus } from "./catalogueDraftTypes";
import { canApprove, canReject, canSubmitForReview, STATUS_LABEL } from "./catalogueDraftWorkflow";

describe("catalogueDraftWorkflow transition guards", () => {
  it("only DRAFT can be submitted for review", () => {
    for (const status of CATALOGUE_DRAFT_STATUSES) {
      expect(canSubmitForReview(status)).toBe(status === "DRAFT");
    }
  });

  it("only UNDER_REVIEW can be approved", () => {
    for (const status of CATALOGUE_DRAFT_STATUSES) {
      expect(canApprove(status)).toBe(status === "UNDER_REVIEW");
    }
  });

  it("only UNDER_REVIEW can be rejected", () => {
    for (const status of CATALOGUE_DRAFT_STATUSES) {
      expect(canReject(status)).toBe(status === "UNDER_REVIEW");
    }
  });

  it("has a label for every status", () => {
    for (const status of CATALOGUE_DRAFT_STATUSES) {
      expect(STATUS_LABEL[status as CatalogueDraftStatus]).toBeTruthy();
    }
  });
});
