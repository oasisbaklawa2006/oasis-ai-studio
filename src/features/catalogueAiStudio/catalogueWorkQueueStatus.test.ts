import { describe, expect, it } from "vitest";
import { classifyWorkQueueStatus, WORK_QUEUE_STATUS_LABEL, WORK_QUEUE_STATUSES } from "./catalogueWorkQueueStatus";

describe("classifyWorkQueueStatus", () => {
  it("classifies a not-ready product with no draft as needing Product Truth", () => {
    expect(classifyWorkQueueStatus({ readinessOverallLabel: "Not ready", draftStatus: null })).toBe("needs_truth");
  });

  it("classifies a ready product with no draft as ready for generation", () => {
    expect(classifyWorkQueueStatus({ readinessOverallLabel: "Catalogue-ready", draftStatus: null })).toBe(
      "ready_for_generation",
    );
    expect(classifyWorkQueueStatus({ readinessOverallLabel: "Needs attention", draftStatus: null })).toBe(
      "ready_for_generation",
    );
  });

  it("classifies an open DRAFT as draft, regardless of readiness label", () => {
    expect(classifyWorkQueueStatus({ readinessOverallLabel: "Not ready", draftStatus: "DRAFT" })).toBe("draft");
  });

  it("draft status always takes priority over readiness for UNDER_REVIEW/REJECTED/APPROVED", () => {
    expect(classifyWorkQueueStatus({ readinessOverallLabel: "Not ready", draftStatus: "UNDER_REVIEW" })).toBe(
      "under_review",
    );
    expect(classifyWorkQueueStatus({ readinessOverallLabel: "Not ready", draftStatus: "REJECTED" })).toBe("rejected");
    expect(classifyWorkQueueStatus({ readinessOverallLabel: "Not ready", draftStatus: "APPROVED" })).toBe("approved");
  });

  it("every status has a human label and appears in the enumerated status list", () => {
    for (const status of WORK_QUEUE_STATUSES) {
      expect(WORK_QUEUE_STATUS_LABEL[status]).toBeTruthy();
    }
  });
});
