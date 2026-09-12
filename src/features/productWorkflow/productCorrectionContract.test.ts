import { describe, expect, it } from "vitest";
import { CATALOGUE_DRAFT_STATUSES } from "@/features/catalogueAiStudio/catalogueDraftTypes";
import {
  assertCorrectionResubmissionAllowed,
  assertRejectionReasonRequired,
  assertTerminalSnapshotNotMutatedInPlace,
  buildPredecessorLinkage,
  buildRejectAuditMetadata,
  contributorDraftRequiresNewSubmission,
  correctionKindFromPredecessorStatus,
  evaluateContributorCorrection,
  evaluateCorrectionSave,
  isStaleDraftStatus,
  isTerminalDraftStatus,
  normalizeRejectionReason,
  REJECTION_REASON_REQUIRED_MESSAGE,
  TERMINAL_SNAPSHOT_IMMUTABLE_MESSAGE,
} from "./productCorrectionContract";

describe("Point39 rejection reason (fail-closed)", () => {
  it("requires a non-empty trimmed rejection reason", () => {
    expect(() => assertRejectionReasonRequired("")).toThrow(REJECTION_REASON_REQUIRED_MESSAGE);
    expect(() => assertRejectionReasonRequired("   ")).toThrow(REJECTION_REASON_REQUIRED_MESSAGE);
    expect(() => assertRejectionReasonRequired("\n\t")).toThrow(REJECTION_REASON_REQUIRED_MESSAGE);
    assertRejectionReasonRequired("Missing B2B price");
    expect(normalizeRejectionReason("  fix copy  ")).toBe("fix copy");
  });

  it("persists normalized reason in reject audit metadata", () => {
    expect(buildRejectAuditMetadata("  tone mismatch  ")).toEqual({
      rejection_reason: "tone mismatch",
    });
    expect(() => buildRejectAuditMetadata("")).toThrow(REJECTION_REASON_REQUIRED_MESSAGE);
  });
});

describe("Point39 terminal snapshot immutability", () => {
  it("identifies terminal draft statuses", () => {
    expect(isTerminalDraftStatus("APPROVED")).toBe(true);
    expect(isTerminalDraftStatus("REJECTED")).toBe(true);
    expect(isTerminalDraftStatus("DRAFT")).toBe(false);
    expect(isTerminalDraftStatus("UNDER_REVIEW")).toBe(false);
  });

  it("blocks in-place mutation of approved/rejected snapshots", () => {
    expect(() => assertTerminalSnapshotNotMutatedInPlace("APPROVED")).toThrow(
      TERMINAL_SNAPSHOT_IMMUTABLE_MESSAGE,
    );
    expect(() => assertTerminalSnapshotNotMutatedInPlace("REJECTED")).toThrow(
      TERMINAL_SNAPSHOT_IMMUTABLE_MESSAGE,
    );
    expect(() => assertTerminalSnapshotNotMutatedInPlace("DRAFT")).not.toThrow();
  });
});

describe("Point39 predecessor linkage and correction kind", () => {
  it("classifies correction kind from predecessor status", () => {
    expect(correctionKindFromPredecessorStatus("REJECTED")).toBe("post_rejection");
    expect(correctionKindFromPredecessorStatus("APPROVED")).toBe("post_approval");
    expect(correctionKindFromPredecessorStatus("DRAFT")).toBe("initial");
  });

  it("carries rejection reason forward for post-rejection corrections", () => {
    const linkage = buildPredecessorLinkage({
      predecessorDraftId: "draft-v1",
      predecessorVersionNumber: 1,
      predecessorStatus: "REJECTED",
      rejectionReason: "Missing export copy",
    });
    expect(linkage).toEqual({
      predecessor_draft_id: "draft-v1",
      predecessor_version_number: 1,
      predecessor_status: "REJECTED",
      correction_kind: "post_rejection",
      previous_version_rejection_reason: "Missing export copy",
    });
  });

  it("omits rejection reason for post-approval new versions", () => {
    const linkage = buildPredecessorLinkage({
      predecessorDraftId: "draft-v2",
      predecessorVersionNumber: 2,
      predecessorStatus: "APPROVED",
      rejectionReason: null,
    });
    expect(linkage.correction_kind).toBe("post_approval");
    expect(linkage.previous_version_rejection_reason).toBeUndefined();
  });
});

describe("Point39 correction save / new-version semantics", () => {
  it("creates a new version when saving from APPROVED or REJECTED", () => {
    expect(
      evaluateCorrectionSave({ latestStatus: "REJECTED", actorRole: "contributor" }),
    ).toMatchObject({ allowed: true, createsNewVersion: true });
    expect(
      evaluateCorrectionSave({ latestStatus: "APPROVED", actorRole: "contributor" }),
    ).toMatchObject({ allowed: true, createsNewVersion: true });
    expect(
      evaluateCorrectionSave({ latestStatus: "DRAFT", actorRole: "contributor" }),
    ).toMatchObject({ allowed: true, createsNewVersion: false });
  });

  it("blocks save while UNDER_REVIEW (no in-place correction during review)", () => {
    const result = evaluateCorrectionSave({
      latestStatus: "UNDER_REVIEW",
      actorRole: "contributor",
    });
    expect(result.allowed).toBe(false);
    expect(result.blockReason).toMatch(/submitted for review/i);
  });

  it("delegates create_new_version legality to Point 38", () => {
    assertCorrectionResubmissionAllowed({ fromStatus: "REJECTED", actorRole: "contributor" });
    assertCorrectionResubmissionAllowed({ fromStatus: "APPROVED", actorRole: "contributor" });
    expect(() =>
      assertCorrectionResubmissionAllowed({ fromStatus: "DRAFT", actorRole: "contributor" }),
    ).toThrow();
    expect(() =>
      assertCorrectionResubmissionAllowed({ fromStatus: "UNDER_REVIEW", actorRole: "contributor" }),
    ).toThrow();
  });

  it("forbids rejected→approved without resubmission (Point 38 skip guard)", () => {
    for (const status of CATALOGUE_DRAFT_STATUSES) {
      if (status === "UNDER_REVIEW") continue;
      const canApproveFromRejected =
        status === "REJECTED"
          ? evaluateContributorCorrection({
              status: "rejected",
              actorRole: "reviewer",
              action: "approve",
            }).allowed
          : null;
      if (status === "REJECTED") {
        expect(canApproveFromRejected).toBe(false);
      }
    }
  });
});

describe("Point39 contributor draft correction paths", () => {
  it("requires new submission only from rejected contributor drafts", () => {
    expect(contributorDraftRequiresNewSubmission("rejected")).toBe(true);
    expect(contributorDraftRequiresNewSubmission("pending_approval")).toBe(false);
    expect(contributorDraftRequiresNewSubmission("approved")).toBe(false);
  });

  it("allows contributor resubmit only from rejected", () => {
    expect(
      evaluateContributorCorrection({
        status: "rejected",
        actorRole: "contributor",
        action: "resubmit",
      }).allowed,
    ).toBe(true);
    expect(
      evaluateContributorCorrection({
        status: "approved",
        actorRole: "contributor",
        action: "resubmit",
      }).allowed,
    ).toBe(false);
    expect(
      evaluateContributorCorrection({
        status: "rejected",
        actorRole: "reviewer",
        action: "resubmit",
      }).allowed,
    ).toBe(false);
  });

  it("requires rejection reason for contributor reject actions", () => {
    const missing = evaluateContributorCorrection({
      status: "pending_approval",
      actorRole: "reviewer",
      action: "reject",
      rejectionReason: "",
    });
    expect(missing.allowed).toBe(false);
    expect(missing.blockReason).toBe(REJECTION_REASON_REQUIRED_MESSAGE);

    const ok = evaluateContributorCorrection({
      status: "pending_approval",
      actorRole: "reviewer",
      action: "reject",
      rejectionReason: "Invalid SKU",
    });
    expect(ok.allowed).toBe(true);
  });
});

describe("Point39 stale-version guard", () => {
  it("detects status drift between expected and actual", () => {
    expect(isStaleDraftStatus("DRAFT", "UNDER_REVIEW")).toBe(true);
    expect(isStaleDraftStatus("DRAFT", "DRAFT")).toBe(false);
  });
});
