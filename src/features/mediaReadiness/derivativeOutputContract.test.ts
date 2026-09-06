import { describe, expect, it } from "vitest";
import type { ProductMediaContext } from "./types";
import {
  assessSourceOverwriteRisk,
  buildDerivativeOutputCensus,
  buildDerivativeStoragePath,
  executeMockDerivativeTransform,
  getDerivativeOutputProfile,
  listDerivativeOutputProfiles,
  resolveDerivativeOutputContract,
  resolveProfilesForSlot,
  validateApprovedQaSource,
  validateDerivativePersistenceHandoff,
  validateDerivativeTransformOutput,
} from "./derivativeOutputContract";
import {
  evaluateQaReadiness,
  recordQaDisposition,
  resolveImageQaValidation,
  runAutomatedQaChecks,
  type QaAuditRecord,
} from "./imageQaValidation";

const POINT46_HEAD = "b1d2f02";

const baklawaProduct: ProductMediaContext = {
  productId: "prod-baklawa-1",
  category: "Baklawa",
  subcategory: "Pyramid",
};

const captureCandidateBase = {
  mediaRef: "mock://qa/approved-hero-001",
  origin: "capture" as const,
  productId: "prod-baklawa-1",
  sourceMediaId: "media-capture-001",
  sourceContentHash: "sha256:capturehash001",
  readinessSlot: "primary_image" as const,
  uploaderType: "hero_image",
  metadata: {
    mimeType: "image/jpeg",
    widthPx: 3000,
    heightPx: 4000,
    fileSizeBytes: 2_000_000,
    captureSource: "guided_camera" as const,
  },
};

const authorizedReviewer = {
  reviewerId: "reviewer-qa-1",
  role: "media_qa_reviewer" as const,
  authorizedAt: new Date(0).toISOString(),
};

function approvedQaFixture(): { audit: QaAuditRecord; approvedSource: Parameters<typeof resolveDerivativeOutputContract>[1] } {
  const resolved = resolveImageQaValidation(baklawaProduct, captureCandidateBase);
  expect(resolved.ok).toBe(true);
  if (!resolved.ok) throw new Error("fixture setup failed");

  const checks = runAutomatedQaChecks(resolved.contract);
  const readiness = evaluateQaReadiness(checks);
  expect(readiness.ok).toBe(true);

  const disposition = recordQaDisposition(resolved.contract, checks, {
    disposition: "approved",
    reviewer: authorizedReviewer,
    recordedAt: new Date(0).toISOString(),
  });
  expect(disposition.ok).toBe(true);
  if (!disposition.ok) throw new Error("fixture setup failed");

  return {
    audit: disposition.audit,
    approvedSource: {
      approvedMediaId: "media-approved-hero-001",
      approvedMediaRef: captureCandidateBase.mediaRef,
      sourceMediaId: captureCandidateBase.sourceMediaId,
      sourceContentHash: captureCandidateBase.sourceContentHash,
      productId: captureCandidateBase.productId,
      readinessSlot: captureCandidateBase.readinessSlot,
      uploaderType: captureCandidateBase.uploaderType,
      familyKey: "baklawa_small_sweets",
    },
  };
}

describe("derivativeOutputContract", () => {
  describe("output profiles", () => {
    it("lists five governed profiles covering WebP, WebM, print, and UHD", () => {
      const profiles = listDerivativeOutputProfiles();
      expect(profiles).toHaveLength(5);
      expect(profiles.map((p) => p.id)).toEqual([
        "web_catalogue_webp",
        "web_hero_webp",
        "print_ready_jpeg",
        "uhd_archive_jpeg",
        "web_motion_webm",
      ]);
    });

    it("resolves slot-applicable profiles from existing readiness slots", () => {
      expect(resolveProfilesForSlot("catalogue_image", "square_image")).toContain("web_catalogue_webp");
      expect(resolveProfilesForSlot("primary_image", "hero_image")).toContain("web_hero_webp");
      expect(resolveProfilesForSlot("primary_image", "hero_image")).toContain("print_ready_jpeg");
      expect(resolveProfilesForSlot("primary_image", "video")).toEqual(["web_motion_webm"]);
    });

    it("returns undefined for unknown profile id", () => {
      expect(getDerivativeOutputProfile("not_a_profile")).toBeUndefined();
    });
  });

  describe("storage naming and overwrite protection", () => {
    it("builds deterministic derivative paths under derivatives/ namespace", () => {
      const path = buildDerivativeStoragePath({
        productId: "prod-baklawa-1",
        profileId: "web_hero_webp",
        sourceContentHash: "sha256:capturehash001",
        fileExtension: "webp",
      });
      expect(path).toBe(
        "products/prod-baklawa-1/derivatives/web_hero_webp/sha256_captureha.webp",
      );
      expect(path).not.toContain("/raw/");
    });

    it("fail-closed when derivative path targets raw/ namespace", () => {
      const risk = assessSourceOverwriteRisk("products/p1/raw/hero.jpg");
      expect(risk.ok).toBe(false);
    });

    it("fail-closed when derivative path equals source path", () => {
      const sourcePath = "products/p1/derivatives/web_hero_webp/abc.webp";
      const risk = assessSourceOverwriteRisk(sourcePath, sourcePath);
      expect(risk.ok).toBe(false);
    });
  });

  describe("contract resolution", () => {
    it("resolves point47_v1 contract from approved Point 46 QA source", () => {
      const { audit, approvedSource } = approvedQaFixture();
      const resolved = resolveDerivativeOutputContract(
        baklawaProduct,
        approvedSource,
        audit,
        "web_hero_webp",
      );
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;

      expect(resolved.contract.schema).toBe("point47_v1");
      expect(resolved.contract.profile.id).toBe("web_hero_webp");
      expect(resolved.contract.profile.mimeType).toBe("image/webp");
      expect(resolved.contract.upstreamAuthority.imageQa).toBe("point46");
      expect(resolved.contract.approvedSource.qaAuditRef).toContain("point46_audit_v1");
    });

    it("fail-closed when Point 46 disposition is not approved", () => {
      const { audit, approvedSource } = approvedQaFixture();
      const pendingAudit: QaAuditRecord = { ...audit, disposition: "pending_review" };
      const resolved = resolveDerivativeOutputContract(
        baklawaProduct,
        approvedSource,
        pendingAudit,
        "web_hero_webp",
      );
      expect(resolved.ok).toBe(false);
      if (resolved.ok) return;
      expect(resolved.error).toBe("qa_source_unapproved");
    });

    it("fail-closed on unknown output profile", () => {
      const { audit, approvedSource } = approvedQaFixture();
      const resolved = resolveDerivativeOutputContract(
        baklawaProduct,
        approvedSource,
        audit,
        "unknown_profile",
      );
      expect(resolved.ok).toBe(false);
      if (resolved.ok) return;
      expect(resolved.error).toBe("unknown_output_profile");
    });

    it("fail-closed when profile is incompatible with readiness slot", () => {
      const { audit, approvedSource } = approvedQaFixture();
      const resolved = resolveDerivativeOutputContract(
        baklawaProduct,
        approvedSource,
        audit,
        "web_catalogue_webp",
      );
      expect(resolved.ok).toBe(false);
      if (resolved.ok) return;
      expect(resolved.error).toBe("profile_slot_incompatible");
    });

    it("fail-closed when product identity is unresolved", () => {
      const { audit, approvedSource } = approvedQaFixture();
      const resolved = resolveDerivativeOutputContract(
        { category: "Baklawa" },
        approvedSource,
        audit,
        "web_hero_webp",
      );
      expect(resolved.ok).toBe(false);
      if (resolved.ok) return;
      expect(resolved.error).toBe("product_identity_unresolved");
    });

    it("fail-closed when source content hash is missing", () => {
      const { audit, approvedSource } = approvedQaFixture();
      const resolved = resolveDerivativeOutputContract(
        baklawaProduct,
        { ...approvedSource, sourceContentHash: "" },
        audit,
        "web_hero_webp",
      );
      expect(resolved.ok).toBe(false);
      if (resolved.ok) return;
      expect(resolved.error).toBe("source_hash_missing");
    });

    it("fail-closed when QA audit media ref mismatches approved source", () => {
      const { audit, approvedSource } = approvedQaFixture();
      const validation = validateApprovedQaSource(
        { ...audit, candidateMediaRef: "mock://other" },
        approvedSource,
      );
      expect(validation.ok).toBe(false);
      if (validation.ok) return;
      expect(validation.error).toBe("qa_audit_mismatch");
    });
  });

  describe("mock transform and provenance", () => {
    it("executes mock WebP transform with manifest metadata and QA linkage", () => {
      const { audit, approvedSource } = approvedQaFixture();
      const resolved = resolveDerivativeOutputContract(
        baklawaProduct,
        approvedSource,
        audit,
        "web_hero_webp",
      );
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;

      const output = executeMockDerivativeTransform(resolved.contract, {
        widthPx: 3000,
        heightPx: 4000,
      });
      expect("ok" in output).toBe(false);
      if ("ok" in output) return;

      expect(output.mimeType).toBe("image/webp");
      expect(output.manifest.schema).toBe("point47_manifest_v1");
      expect(output.manifest.qaAuditRef).toBe(resolved.contract.approvedSource.qaAuditRef);
      expect(output.provenance.sourceContentHash).toBe(approvedSource.sourceContentHash);

      const provenanceCheck = validateDerivativeTransformOutput(resolved.contract, output);
      expect(provenanceCheck.ok).toBe(true);
    });

    it("executes mock print and UHD JPEG profiles", () => {
      const { audit, approvedSource } = approvedQaFixture();
      for (const profileId of ["print_ready_jpeg", "uhd_archive_jpeg"] as const) {
        const resolved = resolveDerivativeOutputContract(
          baklawaProduct,
          approvedSource,
          audit,
          profileId,
        );
        expect(resolved.ok).toBe(true);
        if (!resolved.ok) continue;

        const output = executeMockDerivativeTransform(resolved.contract, {
          widthPx: 3000,
          heightPx: 4000,
        });
        expect("ok" in output).toBe(false);
        if ("ok" in output) continue;
        expect(output.mimeType).toBe("image/jpeg");
        expect(output.manifest.profileId).toBe(profileId);
      }
    });

    it("executes mock WebM profile for video uploader type", () => {
      const audit: QaAuditRecord = {
        schema: "point46_audit_v1",
        candidateMediaRef: "mock://qa/approved-video-001",
        productId: "prod-baklawa-1",
        readinessSlot: "primary_image",
        origin: "capture",
        disposition: "approved",
        automatedChecks: [],
        reviewer: authorizedReviewer,
        recordedAt: new Date(0).toISOString(),
      };

      const approvedSource = {
        approvedMediaId: "media-approved-video-001",
        approvedMediaRef: "mock://qa/approved-video-001",
        sourceMediaId: "media-video-001",
        sourceContentHash: "sha256:videohash001",
        productId: "prod-baklawa-1",
        readinessSlot: "primary_image" as const,
        uploaderType: "video",
        familyKey: "baklawa_small_sweets" as const,
      };

      const resolved = resolveDerivativeOutputContract(
        baklawaProduct,
        approvedSource,
        audit,
        "web_motion_webm",
      );
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;

      const output = executeMockDerivativeTransform(resolved.contract);
      expect("ok" in output).toBe(false);
      if ("ok" in output) return;
      expect(output.mimeType).toBe("video/webm");
    });

    it("fail-closed provenance validation on source hash mismatch", () => {
      const { audit, approvedSource } = approvedQaFixture();
      const resolved = resolveDerivativeOutputContract(
        baklawaProduct,
        approvedSource,
        audit,
        "web_hero_webp",
      );
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;

      const output = executeMockDerivativeTransform(resolved.contract);
      expect("ok" in output).toBe(false);
      if ("ok" in output) return;

      const tampered = {
        ...output,
        provenance: { ...output.provenance, sourceContentHash: "sha256:tampered" },
      };
      const check = validateDerivativeTransformOutput(resolved.contract, tampered);
      expect(check.ok).toBe(false);
      if (check.ok) return;
      expect(check.error).toBe("source_hash_mismatch");
    });
  });

  describe("persistence handoff", () => {
    it("accepts handoff only when canonical persistence succeeds at contract path", () => {
      const { audit, approvedSource } = approvedQaFixture();
      const resolved = resolveDerivativeOutputContract(
        baklawaProduct,
        approvedSource,
        audit,
        "web_hero_webp",
      );
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;

      const output = executeMockDerivativeTransform(resolved.contract);
      expect("ok" in output).toBe(false);
      if ("ok" in output) return;

      const handoff = validateDerivativePersistenceHandoff(resolved.contract, output, {
        persistenceResult: { ok: true, storagePath: output.storagePath },
      });
      expect(handoff.ok).toBe(true);
    });

    it("fail-closed when persistence result is missing", () => {
      const { audit, approvedSource } = approvedQaFixture();
      const resolved = resolveDerivativeOutputContract(
        baklawaProduct,
        approvedSource,
        audit,
        "web_hero_webp",
      );
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;

      const output = executeMockDerivativeTransform(resolved.contract);
      expect("ok" in output).toBe(false);
      if ("ok" in output) return;

      const handoff = validateDerivativePersistenceHandoff(resolved.contract, output, {});
      expect(handoff.ok).toBe(false);
      if (handoff.ok) return;
      expect(handoff.error).toBe("persistence_missing");
    });

    it("fail-closed on direct publish attempt", () => {
      const { audit, approvedSource } = approvedQaFixture();
      const resolved = resolveDerivativeOutputContract(
        baklawaProduct,
        approvedSource,
        audit,
        "web_hero_webp",
      );
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;

      const output = executeMockDerivativeTransform(resolved.contract);
      expect("ok" in output).toBe(false);
      if ("ok" in output) return;

      const handoff = validateDerivativePersistenceHandoff(resolved.contract, output, {
        attemptedPublish: true,
        persistenceResult: { ok: true, storagePath: output.storagePath },
      });
      expect(handoff.ok).toBe(false);
      if (handoff.ok) return;
      expect(handoff.error).toBe("direct_publish_forbidden");
    });

    it("fail-closed when persistence path does not match derivative output path", () => {
      const { audit, approvedSource } = approvedQaFixture();
      const resolved = resolveDerivativeOutputContract(
        baklawaProduct,
        approvedSource,
        audit,
        "web_hero_webp",
      );
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;

      const output = executeMockDerivativeTransform(resolved.contract);
      expect("ok" in output).toBe(false);
      if ("ok" in output) return;

      const handoff = validateDerivativePersistenceHandoff(resolved.contract, output, {
        persistenceResult: { ok: true, storagePath: "products/other/path.webp" },
      });
      expect(handoff.ok).toBe(false);
      if (handoff.ok) return;
      expect(handoff.error).toBe("persistence_failed");
    });
  });

  describe("programme census", () => {
    it("documents derivative surfaces and predecessor chain", () => {
      const census = buildDerivativeOutputCensus(POINT46_HEAD, POINT46_HEAD);
      expect(census.schema).toBe("point47_census_v1");
      expect(census.profileCount).toBe(5);
      expect(census.surfaces.point46ImageQa).toContain("imageQaValidation");
      expect(census.surfaces.derivativeOutputContract).toContain("derivativeOutputContract");
      expect(census.riskyPaths.some((r) => r.includes("overwrite"))).toBe(true);
    });
  });
});
