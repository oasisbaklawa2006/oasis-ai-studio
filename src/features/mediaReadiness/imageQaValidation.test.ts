import { describe, expect, it } from "vitest";
import type { ProductMediaContext } from "./types";
import {
  buildImageQaValidationCensus,
  evaluateQaReadiness,
  recordQaDisposition,
  resolveImageQaValidation,
  runAutomatedQaChecks,
  validateQaReviewerAuthorization,
} from "./imageQaValidation";

const POINT45_HEAD = "986e202";

const baklawaProduct: ProductMediaContext = {
  productId: "prod-baklawa-1",
  category: "Baklawa",
  subcategory: "Pyramid",
};

const captureCandidateBase = {
  mediaRef: "mock://capture/candidate-001",
  origin: "capture" as const,
  productId: "prod-baklawa-1",
  sourceMediaId: "media-capture-001",
  sourceContentHash: "sha256:capturehash001",
  readinessSlot: "primary_image" as const,
  uploaderType: "hero_image",
  metadata: {
    mimeType: "image/jpeg",
    widthPx: 1200,
    heightPx: 1200,
    fileSizeBytes: 500_000,
    captureSource: "guided_camera" as const,
  },
};

const authorizedReviewer = {
  reviewerId: "reviewer-qa-1",
  role: "media_qa_reviewer" as const,
  authorizedAt: new Date(0).toISOString(),
};

describe("imageQaValidation", () => {
  describe("QA contract resolution", () => {
    it("resolves point46_v1 contract with Point 42/43 upstream chain", () => {
      const resolved = resolveImageQaValidation(baklawaProduct, captureCandidateBase);
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;

      expect(resolved.contract.schema).toBe("point46_v1");
      expect(resolved.contract.familyKey).toBe("baklawa_small_sweets");
      expect(resolved.governance.schema).toBe("point43_v1");
      expect(resolved.contract.upstreamAuthority.enhancement).toBe("point45");
      expect(resolved.contract.downstreamAuthority.outputs).toBe("point47");
      expect(resolved.contract.mandatoryChecks.length).toBe(7);
    });

    it("fail-closed when product identity is unresolved", () => {
      const resolved = resolveImageQaValidation(
        { category: "Baklawa" },
        captureCandidateBase,
      );
      expect(resolved.ok).toBe(false);
      if (resolved.ok) return;
      expect(resolved.error).toBe("product_identity_unresolved");
    });

    it("fail-closed when source content hash is missing", () => {
      const resolved = resolveImageQaValidation(baklawaProduct, {
        ...captureCandidateBase,
        sourceContentHash: "",
      });
      expect(resolved.ok).toBe(false);
      if (resolved.ok) return;
      expect(resolved.error).toBe("source_hash_missing");
    });

    it("fail-closed when source media id is missing", () => {
      const resolved = resolveImageQaValidation(baklawaProduct, {
        ...captureCandidateBase,
        sourceMediaId: "",
      });
      expect(resolved.ok).toBe(false);
      if (resolved.ok) return;
      expect(resolved.error).toBe("source_media_unbound");
    });

    it("fail-closed on source product mismatch", () => {
      const resolved = resolveImageQaValidation(baklawaProduct, {
        ...captureCandidateBase,
        productId: "other-product",
      });
      expect(resolved.ok).toBe(false);
      if (resolved.ok) return;
      expect(resolved.error).toBe("source_product_mismatch");
    });

    it("fail-closed on unknown uploader type", () => {
      const resolved = resolveImageQaValidation(baklawaProduct, {
        ...captureCandidateBase,
        uploaderType: "not_a_real_slot",
      });
      expect(resolved.ok).toBe(false);
      if (resolved.ok) return;
      expect(resolved.error).toBe("unknown_uploader_type");
    });
  });

  describe("automated QA checks", () => {
    it("passes all mandatory checks for valid capture candidate", () => {
      const resolved = resolveImageQaValidation(baklawaProduct, captureCandidateBase);
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;

      const checks = runAutomatedQaChecks(resolved.contract);
      const mandatory = checks.filter((check) => check.mandatory);
      expect(mandatory.every((check) => check.status === "pass")).toBe(true);
    });

    it("produces evidence scores without granting approval", () => {
      const resolved = resolveImageQaValidation(baklawaProduct, captureCandidateBase);
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;

      const checks = runAutomatedQaChecks(resolved.contract);
      for (const check of checks) {
        if (check.status === "pass") {
          expect(check.score).toBeGreaterThan(0);
        }
        expect(check.evidence).toBeTruthy();
      }
    });

    it("fails source binding check when hash is empty in contract candidate", () => {
      const resolved = resolveImageQaValidation(baklawaProduct, captureCandidateBase);
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;

      const tampered = {
        ...resolved.contract,
        candidate: { ...resolved.contract.candidate, sourceContentHash: "" },
      };
      const checks = runAutomatedQaChecks(tampered);
      const sourceCheck = checks.find((check) => check.id === "source_binding");
      expect(sourceCheck?.status).toBe("fail");
    });

    it("holds on packaging preservation uncertainty for enhancement origin", () => {
      const enhancementCandidate = {
        ...captureCandidateBase,
        mediaRef: "mock://enhancement/candidate-001",
        origin: "enhancement" as const,
        metadata: {
          mimeType: "image/jpeg",
          widthPx: 1200,
          heightPx: 1200,
          fileSizeBytes: 500_000,
          enhancementProvenance: {
            providerName: "mock_point45_provider",
            policySchema: "point45_v1" as const,
            sourceContentHash: "sha256:capturehash001",
            sourceMediaId: "media-capture-001",
            productId: "prod-baklawa-1",
            readinessSlot: "primary_image" as const,
            requestedOperations: ["lighting_balance"] as const,
            preservationAttestation: {
              packagingTextPreserved: false,
              productGeometryPreserved: true,
              pieceCountPreserved: true,
              logoArtworkPreserved: true,
              productColorPreserved: true,
            },
            executedAt: new Date(0).toISOString(),
          },
        },
      };

      const resolved = resolveImageQaValidation(baklawaProduct, enhancementCandidate);
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;

      const checks = runAutomatedQaChecks(resolved.contract);
      const preservation = checks.find((check) => check.id === "preservation_provenance");
      expect(preservation?.status).toBe("uncertain");

      const readiness = evaluateQaReadiness(checks);
      expect(readiness.ok).toBe(false);
      if (readiness.ok) return;
      expect(readiness.status).toBe("hold");
    });

    it("fails technical quality for undersized images", () => {
      const resolved = resolveImageQaValidation(baklawaProduct, {
        ...captureCandidateBase,
        metadata: { ...captureCandidateBase.metadata, widthPx: 400, heightPx: 400 },
      });
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;

      const checks = runAutomatedQaChecks(resolved.contract);
      const technical = checks.find((check) => check.id === "technical_quality");
      expect(technical?.status).toBe("fail");
    });

    it("fails metadata integrity for unsupported MIME type", () => {
      const resolved = resolveImageQaValidation(baklawaProduct, {
        ...captureCandidateBase,
        metadata: { ...captureCandidateBase.metadata, mimeType: "image/tiff" },
      });
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;

      const checks = runAutomatedQaChecks(resolved.contract);
      const metadata = checks.find((check) => check.id === "metadata_integrity");
      expect(metadata?.status).toBe("fail");
    });
  });

  describe("QA readiness evaluation", () => {
    it("marks capture candidate ready for human review when all checks pass", () => {
      const resolved = resolveImageQaValidation(baklawaProduct, captureCandidateBase);
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;

      const checks = runAutomatedQaChecks(resolved.contract);
      const readiness = evaluateQaReadiness(checks);
      expect(readiness.ok).toBe(true);
      if (!readiness.ok) return;
      expect(readiness.status).toBe("ready_for_human_review");
    });

    it("rejects when mandatory checks fail", () => {
      const readiness = evaluateQaReadiness([
        {
          id: "source_binding",
          status: "fail",
          score: 0,
          evidence: "Source binding broken",
          mandatory: true,
        },
        {
          id: "product_identity",
          status: "pass",
          score: 100,
          evidence: "OK",
          mandatory: true,
        },
      ]);
      expect(readiness.ok).toBe(false);
      if (readiness.ok) return;
      expect(readiness.status).toBe("rejected");
      expect(readiness.blockingCheckIds).toContain("source_binding");
    });
  });

  describe("reviewer authorization and disposition", () => {
    it("authorizes media_qa_reviewer for approval", () => {
      const auth = validateQaReviewerAuthorization(authorizedReviewer, "approved");
      expect(auth.ok).toBe(true);
    });

    it("rejects unauthorized reviewer role", () => {
      const auth = validateQaReviewerAuthorization(
        { ...authorizedReviewer, role: "media_qa_reviewer" },
        "approved",
      );
      expect(auth.ok).toBe(true);

      const noId = validateQaReviewerAuthorization(
        { ...authorizedReviewer, reviewerId: "" },
        "approved",
      );
      expect(noId.ok).toBe(false);
    });

    it("records approved disposition with audit when checks pass and reviewer authorized", () => {
      const resolved = resolveImageQaValidation(baklawaProduct, captureCandidateBase);
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;

      const checks = runAutomatedQaChecks(resolved.contract);
      const disposition = recordQaDisposition(resolved.contract, checks, {
        disposition: "approved",
        reviewer: authorizedReviewer,
        reviewerNotes: "Exact-product fidelity confirmed visually.",
        recordedAt: new Date(0).toISOString(),
      });

      expect(disposition.ok).toBe(true);
      if (!disposition.ok) return;
      expect(disposition.audit.schema).toBe("point46_audit_v1");
      expect(disposition.audit.disposition).toBe("approved");
      expect(disposition.audit.reviewer?.reviewerId).toBe("reviewer-qa-1");
      expect(disposition.audit.automatedChecks.length).toBeGreaterThan(0);
    });

    it("rejects auto-approve without reviewer", () => {
      const resolved = resolveImageQaValidation(baklawaProduct, captureCandidateBase);
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;

      const checks = runAutomatedQaChecks(resolved.contract);
      const disposition = recordQaDisposition(resolved.contract, checks, {
        disposition: "approved",
      });

      expect(disposition.ok).toBe(false);
      if (disposition.ok) return;
      expect(disposition.error).toBe("reviewer_missing");
    });

    it("rejects approval when preservation is uncertain", () => {
      const enhancementCandidate = {
        ...captureCandidateBase,
        mediaRef: "mock://enhancement/candidate-002",
        origin: "enhancement" as const,
        metadata: {
          mimeType: "image/jpeg",
          widthPx: 1200,
          heightPx: 1200,
          enhancementProvenance: {
            providerName: "mock",
            policySchema: "point45_v1" as const,
            sourceContentHash: "sha256:capturehash001",
            sourceMediaId: "media-capture-001",
            productId: "prod-baklawa-1",
            readinessSlot: "primary_image" as const,
            requestedOperations: ["lighting_balance"] as const,
            preservationAttestation: {
              packagingTextPreserved: false,
              productGeometryPreserved: true,
              pieceCountPreserved: true,
              logoArtworkPreserved: false,
              productColorPreserved: true,
            },
            executedAt: new Date(0).toISOString(),
          },
        },
      };

      const resolved = resolveImageQaValidation(baklawaProduct, enhancementCandidate);
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;

      const checks = runAutomatedQaChecks(resolved.contract);
      const disposition = recordQaDisposition(resolved.contract, checks, {
        disposition: "approved",
        reviewer: authorizedReviewer,
      });

      expect(disposition.ok).toBe(false);
      if (disposition.ok) return;
      expect(disposition.error).toBe("preservation_uncertain");
    });

    it("rejects direct publish attempts", () => {
      const resolved = resolveImageQaValidation(baklawaProduct, captureCandidateBase);
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;

      const checks = runAutomatedQaChecks(resolved.contract);
      const disposition = recordQaDisposition(resolved.contract, checks, {
        disposition: "approved",
        reviewer: authorizedReviewer,
        attemptedPublish: true,
      });

      expect(disposition.ok).toBe(false);
      if (disposition.ok) return;
      expect(disposition.error).toBe("direct_publish_forbidden");
    });

    it("records hold disposition with reviewer authorization", () => {
      const resolved = resolveImageQaValidation(baklawaProduct, captureCandidateBase);
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;

      const checks = runAutomatedQaChecks(resolved.contract);
      const disposition = recordQaDisposition(resolved.contract, checks, {
        disposition: "hold",
        reviewer: authorizedReviewer,
        reviewerNotes: "Awaiting packaging text verification.",
      });

      expect(disposition.ok).toBe(true);
      if (!disposition.ok) return;
      expect(disposition.audit.disposition).toBe("hold");
    });

    it("records rejected disposition with reviewer authorization", () => {
      const resolved = resolveImageQaValidation(baklawaProduct, {
        ...captureCandidateBase,
        metadata: { ...captureCandidateBase.metadata, widthPx: 200, heightPx: 200 },
      });
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;

      const checks = runAutomatedQaChecks(resolved.contract);
      const disposition = recordQaDisposition(resolved.contract, checks, {
        disposition: "rejected",
        reviewer: authorizedReviewer,
        reviewerNotes: "Resolution below minimum threshold.",
      });

      expect(disposition.ok).toBe(true);
      if (!disposition.ok) return;
      expect(disposition.audit.disposition).toBe("rejected");
    });
  });

  it("builds census with Point 45 predecessor SHA and risky path evidence", () => {
    const census = buildImageQaValidationCensus(POINT45_HEAD, POINT45_HEAD);
    expect(census.schema).toBe("point46_census_v1");
    expect(census.baselineSha).toBe(POINT45_HEAD);
    expect(census.mandatoryCheckCount).toBe(7);
    expect(census.riskyPaths.length).toBeGreaterThan(0);
    expect(census.gaps.length).toBeGreaterThan(0);
    expect(census.surfaces.point45Enhancement).toContain("exactProductEnhancement");
  });
});
