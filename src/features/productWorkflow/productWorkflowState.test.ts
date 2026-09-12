import { describe, expect, it } from "vitest";
import { CATALOGUE_DRAFT_STATUSES } from "@/features/catalogueAiStudio/catalogueDraftTypes";
import {
  evaluateWorkflowTransition,
  isPoint39CorrectionPhase,
  isPoint54PublicationPhase,
  isWorkflowExternallyDistributable,
  mapCatalogueDraftStatus,
  mapCatalogueVersionStatus,
  mapContributorDraftStatus,
  POINT_38_CANONICAL_PHASES,
  POINT_54_PUBLICATION_PHASE,
  serializeWorkflowStateForSnapshot,
  workflowStatusStale,
} from "./productWorkflowState";

describe("Point38 domain status mapping", () => {
  it("maps every catalogue AI studio draft status to a canonical phase", () => {
    expect(mapCatalogueDraftStatus(null)).toBe("pre_draft");
    expect(mapCatalogueDraftStatus("DRAFT")).toBe("draft");
    expect(mapCatalogueDraftStatus("UNDER_REVIEW")).toBe("submitted");
    expect(mapCatalogueDraftStatus("APPROVED")).toBe("approved");
    expect(mapCatalogueDraftStatus("REJECTED")).toBe("rejected");
    for (const status of CATALOGUE_DRAFT_STATUSES) {
      expect(POINT_38_CANONICAL_PHASES).toContain(mapCatalogueDraftStatus(status));
    }
  });

  it("maps contributor draft statuses without inventing parallel vocabulary", () => {
    expect(mapContributorDraftStatus("pending_approval")).toBe("submitted");
    expect(mapContributorDraftStatus("approved")).toBe("approved");
    expect(mapContributorDraftStatus("rejected")).toBe("rejected");
  });

  it("maps catalogue version publication states to Point 54 boundary", () => {
    expect(mapCatalogueVersionStatus("draft")).toBe("draft");
    expect(mapCatalogueVersionStatus("pending_approval")).toBe("submitted");
    expect(mapCatalogueVersionStatus("approved")).toBe("approved");
    expect(mapCatalogueVersionStatus("published")).toBe(POINT_54_PUBLICATION_PHASE);
    expect(mapCatalogueVersionStatus("synced")).toBe(POINT_54_PUBLICATION_PHASE);
    expect(isPoint54PublicationPhase(mapCatalogueVersionStatus("published"))).toBe(true);
  });
});

describe("Point38 transition guards (fail-closed)", () => {
  const domain = "catalogue_ai_studio_draft" as const;

  it("allows draft → submitted via contributor submit", () => {
    const result = evaluateWorkflowTransition({
      domain,
      fromPhase: "draft",
      action: "submit",
      actorRole: "contributor",
    });
    expect(result.allowed).toBe(true);
    expect(result.toPhase).toBe("submitted");
  });

  it("forbids draft → approved (illegal skip)", () => {
    const result = evaluateWorkflowTransition({
      domain,
      fromPhase: "draft",
      action: "approve",
      actorRole: "reviewer",
    });
    expect(result.allowed).toBe(false);
    expect(result.blockReason).toMatch(/draft→approved skips are forbidden/i);
  });

  it("forbids draft → published (Point 54 boundary)", () => {
    const result = evaluateWorkflowTransition({
      domain,
      fromPhase: "draft",
      action: "publish",
      actorRole: "reviewer",
    });
    expect(result.allowed).toBe(false);
    expect(result.blockReason).toMatch(/Point 54/i);
  });

  it("forbids rejected → approved without resubmission", () => {
    const result = evaluateWorkflowTransition({
      domain,
      fromPhase: "rejected",
      action: "approve",
      actorRole: "reviewer",
    });
    expect(result.allowed).toBe(false);
  });

  it("allows submitted → approved/rejected by reviewer only", () => {
    expect(
      evaluateWorkflowTransition({
        domain,
        fromPhase: "submitted",
        action: "approve",
        actorRole: "reviewer",
      }).allowed,
    ).toBe(true);
    expect(
      evaluateWorkflowTransition({
        domain,
        fromPhase: "submitted",
        action: "reject",
        actorRole: "reviewer",
      }).allowed,
    ).toBe(true);
    expect(
      evaluateWorkflowTransition({
        domain,
        fromPhase: "submitted",
        action: "approve",
        actorRole: "contributor",
      }).allowed,
    ).toBe(false);
  });

  it("blocks save while submitted for review", () => {
    const result = evaluateWorkflowTransition({
      domain,
      fromPhase: "submitted",
      action: "save",
      actorRole: "contributor",
    });
    expect(result.allowed).toBe(false);
    expect(result.blockReason).toMatch(/submitted for review/i);
  });

  it("allows create_new_version from approved/rejected (Point 39 boundary)", () => {
    for (const fromPhase of ["approved", "rejected"] as const) {
      const result = evaluateWorkflowTransition({
        domain,
        fromPhase,
        action: "create_new_version",
        actorRole: "contributor",
      });
      expect(result.allowed).toBe(true);
      expect(result.toPhase).toBe("draft");
      if (fromPhase === "rejected") {
        expect(isPoint39CorrectionPhase(fromPhase)).toBe(true);
      }
    }
  });

  it("forbids create_new_version from open draft or submitted", () => {
    for (const fromPhase of ["draft", "submitted"] as const) {
      expect(
        evaluateWorkflowTransition({
          domain,
          fromPhase,
          action: "create_new_version",
          actorRole: "contributor",
        }).allowed,
      ).toBe(false);
    }
  });

  it("marks only approved phase as externally distributable", () => {
    expect(isWorkflowExternallyDistributable("approved")).toBe(true);
    for (const phase of ["pre_draft", "draft", "submitted", "rejected"] as const) {
      expect(isWorkflowExternallyDistributable(phase)).toBe(false);
    }
  });
});

describe("Point38 stale status inference guard", () => {
  it("detects when persisted phase disagrees with expected phase", () => {
    expect(workflowStatusStale("draft", "submitted")).toBe(true);
    expect(workflowStatusStale("draft", "draft")).toBe(false);
  });
});

describe("Point38 workflow snapshot serializer", () => {
  it("emits point38_v1 snapshot with boundary flags", () => {
    const snap = serializeWorkflowStateForSnapshot({
      domain: "catalogue_ai_studio_draft",
      domainStatus: "REJECTED",
      phase: "rejected",
    });
    expect(snap.schema).toBe("point38_v1");
    expect(snap.externally_distributable).toBe(false);
    expect(snap.point39_correction_boundary).toBe(true);
    expect(snap.point54_publication_boundary).toBe(false);
  });
});
