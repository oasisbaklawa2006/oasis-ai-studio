import { describe, expect, it } from "vitest";
import {
  CATALOGUE_DRAFT_CONTENT_KEYS,
  CATALOGUE_DRAFT_STATUSES,
  type CatalogueDraftContent,
  type CatalogueDraftStatus,
} from "./catalogueDraftTypes";
import {
  canApprove,
  canReject,
  canSubmitForReview,
  isExportBundleDistributable,
  STATUS_LABEL,
} from "./catalogueDraftWorkflow";

function content(fill: string, overrides: Partial<CatalogueDraftContent> = {}): CatalogueDraftContent {
  const base = Object.fromEntries(CATALOGUE_DRAFT_CONTENT_KEYS.map((k) => [k, fill])) as CatalogueDraftContent;
  return { ...base, ...overrides };
}

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

describe("isExportBundleDistributable (owner-smoke-test: Stage 5 export-bundle safety)", () => {
  const complete = content("Complete real copy.");
  const incompleteRejected = content("ok", {
    b2b_sales_copy: "Blackcurrant Ball is available for wholesale. Add missing field first: B2B price.",
  });

  it("is distributable when APPROVED and every content block is complete", () => {
    expect(isExportBundleDistributable("APPROVED", complete)).toBe(true);
  });

  it("is never distributable for any non-APPROVED status, even with complete content", () => {
    for (const status of ["DRAFT", "UNDER_REVIEW", "REJECTED"] as const) {
      expect(isExportBundleDistributable(status, complete)).toBe(false);
    }
  });

  it("is never distributable with no persisted draft yet (null status)", () => {
    expect(isExportBundleDistributable(null, complete)).toBe(false);
  });

  it("is never distributable when APPROVED but a block still carries a missing-field placeholder", () => {
    expect(isExportBundleDistributable("APPROVED", incompleteRejected)).toBe(false);
  });

  it("is never distributable for the reported REJECTED + missing-B2B-price case", () => {
    expect(isExportBundleDistributable("REJECTED", incompleteRejected)).toBe(false);
  });
});
