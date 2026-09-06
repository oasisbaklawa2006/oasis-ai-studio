/**
 * Point 46 — Image QA validation canonical contract.
 * Fail-closed QA decisioning for captured/enhanced media. Validates product/source identity,
 * Point 42 required slot, Point 43 benchmark constraints, Point 45 provenance/preservation,
 * basic technical quality, and explicit human-review disposition.
 * Automated checks produce evidence/scores only — never auto-approve exact-product fidelity.
 * Media remains pending_review until all mandatory automated checks pass and a governed reviewer
 * records disposition. No real image analysis/generation; fixtures/mocks only.
 */
import {
  type BenchmarkPhotographyGovernanceContract,
  resolveBenchmarkPhotographyGovernance,
} from "./benchmarkPhotographyGovernance";
import {
  type ControlledPhotographyFamilyKey,
  mapUploaderTypeToReadinessSlot,
  resolveControlledPhotographyFamily,
} from "./controlledPhotographyFamilies";
import type { EnhancementProviderProvenance } from "./exactProductEnhancement";
import type { MediaAssetType, ProductMediaContext } from "./types";

export type ImageQaMediaOrigin = "capture" | "enhancement";

export type ImageQaCandidateMetadata = {
  mimeType?: string;
  widthPx?: number;
  heightPx?: number;
  fileSizeBytes?: number;
  captureSource?: "guided_camera" | "governed_gallery_fallback" | "desktop_gallery";
  enhancementProvenance?: EnhancementProviderProvenance;
};

export type ImageQaCandidate = {
  mediaRef: string;
  origin: ImageQaMediaOrigin;
  productId: string;
  sourceMediaId: string;
  sourceContentHash: string;
  readinessSlot: MediaAssetType;
  uploaderType: string;
  familyKey: ControlledPhotographyFamilyKey;
  metadata: ImageQaCandidateMetadata;
};

export type QaAutomatedCheckId =
  | "source_binding"
  | "product_identity"
  | "slot_compliance"
  | "benchmark_compliance"
  | "preservation_provenance"
  | "technical_quality"
  | "metadata_integrity";

export type QaAutomatedCheckStatus = "pass" | "fail" | "uncertain" | "skipped";

export type QaAutomatedCheckResult = {
  id: QaAutomatedCheckId;
  status: QaAutomatedCheckStatus;
  /** Evidence score 0–100 — informational only; never grants approval. */
  score?: number;
  evidence: string;
  mandatory: boolean;
};

export type ImageQaPolicy = {
  autoApproveForbidden: true;
  humanFidelityReviewRequired: true;
  directPublishForbidden: true;
};

export type ImageQaValidationContract = {
  schema: "point46_v1";
  familyKey: ControlledPhotographyFamilyKey;
  productContext: ProductMediaContext;
  candidate: ImageQaCandidate;
  mandatoryChecks: readonly QaAutomatedCheckId[];
  policy: ImageQaPolicy;
  upstreamAuthority: {
    photographyFamilies: "point42";
    benchmarkGovernance: "point43";
    mobileCapture: "point44";
    enhancement: "point45";
  };
  downstreamAuthority: {
    outputs: "point47";
  };
};

export type ImageQaValidationResolution =
  | { ok: true; contract: ImageQaValidationContract; governance: BenchmarkPhotographyGovernanceContract }
  | {
      ok: false;
      error:
        | "product_identity_unresolved"
        | "source_media_unbound"
        | "source_hash_missing"
        | "unknown_uploader_type"
        | "unknown_slot"
        | "family_resolution_failed"
        | "source_product_mismatch"
        | "malformed_metadata";
      message: string;
    };

export type QaReadinessEvaluation =
  | {
      ok: true;
      status: "ready_for_human_review";
      checks: readonly QaAutomatedCheckResult[];
    }
  | {
      ok: false;
      status: "pending_review" | "hold" | "rejected";
      checks: readonly QaAutomatedCheckResult[];
      blockingCheckIds: readonly QaAutomatedCheckId[];
      message: string;
    };

export type QaDisposition = "pending_review" | "approved" | "rejected" | "hold";

export type QaReviewerRole = "media_qa_reviewer" | "media_qa_lead" | "catalogue_admin";

export type QaReviewerAuthorization = {
  reviewerId: string;
  role: QaReviewerRole;
  authorizedAt: string;
};

export type QaAuditRecord = {
  schema: "point46_audit_v1";
  candidateMediaRef: string;
  productId: string;
  readinessSlot: MediaAssetType;
  origin: ImageQaMediaOrigin;
  disposition: QaDisposition;
  automatedChecks: readonly QaAutomatedCheckResult[];
  reviewer?: QaReviewerAuthorization;
  reviewerNotes?: string;
  recordedAt: string;
};

export type QaDispositionValidation =
  | { ok: true; audit: QaAuditRecord }
  | {
      ok: false;
      error:
        | "auto_approve_forbidden"
        | "direct_publish_forbidden"
        | "automated_checks_incomplete"
        | "automated_checks_failed"
        | "preservation_uncertain"
        | "reviewer_unauthorized"
        | "reviewer_missing"
        | "source_binding_broken";
      message: string;
    };

export type ImageQaValidationCensus = {
  schema: "point46_census_v1";
  baselineSha: string;
  predecessorSha: string;
  mandatoryCheckCount: number;
  surfaces: {
    point42Families: string;
    point43BenchmarkGovernance: string;
    point44GuidedCapture: string;
    point45Enhancement: string;
    mediaAuthorityContract: string;
    mediaReadinessEngine: string;
    productMediaPersistence: string;
    productMediaUploader: string;
    catalogueProductStudio: string;
    catalogueMediaSlots: string;
    mediaLibraryPage: string;
  };
  riskyPaths: readonly string[];
  gaps: readonly string[];
  downstreamPoints: Record<string, string>;
};

const MANDATORY_CHECKS: readonly QaAutomatedCheckId[] = [
  "source_binding",
  "product_identity",
  "slot_compliance",
  "benchmark_compliance",
  "preservation_provenance",
  "technical_quality",
  "metadata_integrity",
];

const AUTHORIZED_ROLES_FOR_APPROVAL: ReadonlySet<QaReviewerRole> = new Set([
  "media_qa_reviewer",
  "media_qa_lead",
  "catalogue_admin",
]);

const AUTHORIZED_ROLES_FOR_REJECTION: ReadonlySet<QaReviewerRole> = new Set([
  "media_qa_reviewer",
  "media_qa_lead",
  "catalogue_admin",
]);

const MIN_TECHNICAL_WIDTH_PX = 800;
const MIN_TECHNICAL_HEIGHT_PX = 800;
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Resolve Point 46 QA contract — fail-closed via Point 42/43 chain and candidate binding. */
export function resolveImageQaValidation(
  product: ProductMediaContext,
  candidate: Omit<ImageQaCandidate, "familyKey"> & { familyKey?: ControlledPhotographyFamilyKey },
): ImageQaValidationResolution {
  const productId = product.productId?.trim();
  if (!productId) {
    return {
      ok: false,
      error: "product_identity_unresolved",
      message: "Product identity is required before QA validation can begin.",
    };
  }

  if (candidate.productId.trim() !== productId) {
    return {
      ok: false,
      error: "source_product_mismatch",
      message: "Candidate product id does not match resolved product context.",
    };
  }

  const sourceContentHash = candidate.sourceContentHash.trim();
  if (!sourceContentHash) {
    return {
      ok: false,
      error: "source_hash_missing",
      message: "Source media content hash is required for QA provenance binding.",
    };
  }

  const sourceMediaId = candidate.sourceMediaId.trim();
  if (!sourceMediaId) {
    return {
      ok: false,
      error: "source_media_unbound",
      message: "Source media id is required for QA source binding.",
    };
  }

  const mediaRef = candidate.mediaRef.trim();
  if (!mediaRef) {
    return {
      ok: false,
      error: "malformed_metadata",
      message: "Candidate media reference is required.",
    };
  }

  const familyResolved = resolveControlledPhotographyFamily(product);
  if (!familyResolved.ok) {
    return {
      ok: false,
      error: "family_resolution_failed",
      message: familyResolved.message,
    };
  }

  const governanceResolved = resolveBenchmarkPhotographyGovernance(product);
  if (!governanceResolved.ok) {
    return {
      ok: false,
      error: "family_resolution_failed",
      message: governanceResolved.message,
    };
  }

  const mappedSlot = mapUploaderTypeToReadinessSlot(candidate.uploaderType);
  if (!mappedSlot.ok) {
    return {
      ok: false,
      error: "unknown_uploader_type",
      message: mappedSlot.message,
    };
  }

  if (candidate.readinessSlot !== mappedSlot.slot) {
    return {
      ok: false,
      error: "unknown_slot",
      message: "Candidate readiness slot does not match Point 42 uploader mapping.",
    };
  }

  const familyKey = candidate.familyKey ?? familyResolved.contract.familyKey;
  if (familyKey !== familyResolved.contract.familyKey) {
    return {
      ok: false,
      error: "source_product_mismatch",
      message: "Candidate family key does not match resolved product family.",
    };
  }

  const slotInFamily = [...familyResolved.contract.requiredSlots, ...familyResolved.contract.optionalSlots].some(
    (slot) => slot.readinessSlot === candidate.readinessSlot,
  );
  if (!slotInFamily) {
    return {
      ok: false,
      error: "unknown_slot",
      message: "Candidate readiness slot is not valid for this product family.",
    };
  }

  return {
    ok: true,
    governance: governanceResolved.contract,
    contract: {
      schema: "point46_v1",
      familyKey,
      productContext: { ...product, productId },
      candidate: {
        ...candidate,
        mediaRef,
        productId,
        sourceMediaId,
        sourceContentHash,
        familyKey,
      },
      mandatoryChecks: MANDATORY_CHECKS,
      policy: {
        autoApproveForbidden: true,
        humanFidelityReviewRequired: true,
        directPublishForbidden: true,
      },
      upstreamAuthority: {
        photographyFamilies: "point42",
        benchmarkGovernance: "point43",
        mobileCapture: "point44",
        enhancement: "point45",
      },
      downstreamAuthority: {
        outputs: "point47",
      },
    },
  };
}

/** Run deterministic automated QA checks — evidence/scores only; no real image analysis. */
export function runAutomatedQaChecks(
  contract: ImageQaValidationContract,
): readonly QaAutomatedCheckResult[] {
  const { candidate } = contract;
  const checks: QaAutomatedCheckResult[] = [];

  checks.push({
    id: "source_binding",
    status:
      candidate.sourceMediaId && candidate.sourceContentHash ? "pass" : "fail",
    score: candidate.sourceMediaId && candidate.sourceContentHash ? 100 : 0,
    evidence: candidate.sourceMediaId
      ? `Source media ${candidate.sourceMediaId} bound with hash ${candidate.sourceContentHash}`
      : "Source media binding missing",
    mandatory: true,
  });

  checks.push({
    id: "product_identity",
    status: candidate.productId ? "pass" : "fail",
    score: candidate.productId ? 100 : 0,
    evidence: candidate.productId
      ? `Product identity resolved: ${candidate.productId}`
      : "Product identity unresolved",
    mandatory: true,
  });

  const familyResolved = resolveControlledPhotographyFamily(contract.productContext);
  const slotValid =
    familyResolved.ok &&
    [...familyResolved.contract.requiredSlots, ...familyResolved.contract.optionalSlots].some(
      (slot) => slot.readinessSlot === candidate.readinessSlot,
    );

  checks.push({
    id: "slot_compliance",
    status: slotValid ? "pass" : "fail",
    score: slotValid ? 100 : 0,
    evidence: slotValid
      ? `Slot ${candidate.readinessSlot} is valid for family ${contract.familyKey}`
      : `Slot ${candidate.readinessSlot} is not mapped for family ${contract.familyKey}`,
    mandatory: true,
  });

  const governanceResolved = resolveBenchmarkPhotographyGovernance(contract.productContext);
  const benchmarkOk = governanceResolved.ok;
  checks.push({
    id: "benchmark_compliance",
    status: benchmarkOk ? "pass" : "fail",
    score: benchmarkOk ? 95 : 0,
    evidence: benchmarkOk
      ? `Point 43 benchmark constraints satisfied for ${contract.familyKey}`
      : "Point 43 benchmark governance resolution failed",
    mandatory: true,
  });

  const preservation = evaluatePreservationProvenance(candidate);
  checks.push({
    id: "preservation_provenance",
    status: preservation.status,
    score: preservation.score,
    evidence: preservation.evidence,
    mandatory: true,
  });

  const technical = evaluateTechnicalQuality(candidate.metadata);
  checks.push({
    id: "technical_quality",
    status: technical.status,
    score: technical.score,
    evidence: technical.evidence,
    mandatory: true,
  });

  const metadata = evaluateMetadataIntegrity(candidate.metadata);
  checks.push({
    id: "metadata_integrity",
    status: metadata.status,
    score: metadata.score,
    evidence: metadata.evidence,
    mandatory: true,
  });

  return checks;
}

function evaluatePreservationProvenance(candidate: ImageQaCandidate): {
  status: QaAutomatedCheckStatus;
  score: number;
  evidence: string;
} {
  if (candidate.origin === "capture") {
    return {
      status: "pass",
      score: 100,
      evidence: "Capture origin — original pixels preserved; no enhancement attestation required.",
    };
  }

  const provenance = candidate.metadata.enhancementProvenance;
  if (!provenance) {
    return {
      status: "fail",
      score: 0,
      evidence: "Enhancement origin requires Point 45 provenance metadata.",
    };
  }

  if (provenance.sourceContentHash !== candidate.sourceContentHash) {
    return {
      status: "fail",
      score: 0,
      evidence: "Enhancement provenance source hash does not match candidate source binding.",
    };
  }

  const attestation = provenance.preservationAttestation;
  const uncertain =
    !attestation.packagingTextPreserved ||
    !attestation.logoArtworkPreserved;
  if (uncertain) {
    return {
      status: "uncertain",
      score: 40,
      evidence:
        "Packaging/text/logo preservation cannot be verified automatically — human visual review required.",
    };
  }

  const allPreserved =
    attestation.packagingTextPreserved &&
    attestation.productGeometryPreserved &&
    attestation.pieceCountPreserved &&
    attestation.logoArtworkPreserved &&
    attestation.productColorPreserved;

  return {
    status: allPreserved ? "pass" : "uncertain",
    score: allPreserved ? 90 : 50,
    evidence: allPreserved
      ? "Point 45 preservation attestation complete — exact-product fidelity still requires human review."
      : "Partial preservation attestation — hold for human verification.",
  };
}

function evaluateTechnicalQuality(metadata: ImageQaCandidateMetadata): {
  status: QaAutomatedCheckStatus;
  score: number;
  evidence: string;
} {
  const width = metadata.widthPx ?? 0;
  const height = metadata.heightPx ?? 0;
  const fileSize = metadata.fileSizeBytes ?? 0;

  if (!width || !height) {
    return {
      status: "uncertain",
      score: 30,
      evidence: "Dimensions unavailable — technical quality cannot be fully verified.",
    };
  }

  if (width < MIN_TECHNICAL_WIDTH_PX || height < MIN_TECHNICAL_HEIGHT_PX) {
    return {
      status: "fail",
      score: 20,
      evidence: `Resolution ${width}x${height} below minimum ${MIN_TECHNICAL_WIDTH_PX}x${MIN_TECHNICAL_HEIGHT_PX}.`,
    };
  }

  if (fileSize > MAX_FILE_SIZE_BYTES) {
    return {
      status: "fail",
      score: 10,
      evidence: `File size ${fileSize} exceeds maximum ${MAX_FILE_SIZE_BYTES} bytes.`,
    };
  }

  const aspect = width / height;
  const aspectScore = aspect >= 0.5 && aspect <= 2 ? 95 : 70;

  return {
    status: "pass",
    score: aspectScore,
    evidence: `Resolution ${width}x${height}px within technical thresholds.`,
  };
}

function evaluateMetadataIntegrity(metadata: ImageQaCandidateMetadata): {
  status: QaAutomatedCheckStatus;
  score: number;
  evidence: string;
} {
  if (!metadata.mimeType) {
    return {
      status: "uncertain",
      score: 40,
      evidence: "MIME type missing — metadata integrity partially verified.",
    };
  }

  if (!ALLOWED_MIME_TYPES.has(metadata.mimeType)) {
    return {
      status: "fail",
      score: 0,
      evidence: `Unsupported MIME type: ${metadata.mimeType}`,
    };
  }

  return {
    status: "pass",
    score: 100,
    evidence: `MIME type ${metadata.mimeType} is supported.`,
  };
}

/** Evaluate whether mandatory automated checks allow human review — does not approve media. */
export function evaluateQaReadiness(
  checks: readonly QaAutomatedCheckResult[],
): QaReadinessEvaluation {
  const mandatory = checks.filter((check) => check.mandatory);
  const failed = mandatory.filter((check) => check.status === "fail");
  const uncertain = mandatory.filter((check) => check.status === "uncertain");

  if (failed.length > 0) {
    return {
      ok: false,
      status: "rejected",
      checks,
      blockingCheckIds: failed.map((check) => check.id),
      message: `Mandatory automated checks failed: ${failed.map((check) => check.id).join(", ")}`,
    };
  }

  if (uncertain.length > 0) {
    const hasPreservationUncertainty = uncertain.some(
      (check) => check.id === "preservation_provenance",
    );
    return {
      ok: false,
      status: hasPreservationUncertainty ? "hold" : "pending_review",
      checks,
      blockingCheckIds: uncertain.map((check) => check.id),
      message: hasPreservationUncertainty
        ? "Packaging/text/logo preservation uncertain — hold until human visual review."
        : `Automated checks uncertain: ${uncertain.map((check) => check.id).join(", ")}`,
    };
  }

  const allMandatoryPass = mandatory.every((check) => check.status === "pass");
  if (!allMandatoryPass) {
    return {
      ok: false,
      status: "pending_review",
      checks,
      blockingCheckIds: mandatory
        .filter((check) => check.status !== "pass")
        .map((check) => check.id),
      message: "Not all mandatory automated checks have passed.",
    };
  }

  return {
    ok: true,
    status: "ready_for_human_review",
    checks,
  };
}

/** Validate reviewer authorization for the requested disposition. */
export function validateQaReviewerAuthorization(
  reviewer: QaReviewerAuthorization,
  disposition: QaDisposition,
): { ok: true } | { ok: false; error: "reviewer_unauthorized"; message: string } {
  if (!reviewer.reviewerId.trim()) {
    return {
      ok: false,
      error: "reviewer_unauthorized",
      message: "Reviewer id is required for governed QA disposition.",
    };
  }

  if (disposition === "approved" && !AUTHORIZED_ROLES_FOR_APPROVAL.has(reviewer.role)) {
    return {
      ok: false,
      error: "reviewer_unauthorized",
      message: `Role ${reviewer.role} is not authorized to approve media.`,
    };
  }

  if (disposition === "rejected" && !AUTHORIZED_ROLES_FOR_REJECTION.has(reviewer.role)) {
    return {
      ok: false,
      error: "reviewer_unauthorized",
      message: `Role ${reviewer.role} is not authorized to reject media.`,
    };
  }

  return { ok: true };
}

/**
 * Record governed QA disposition — fail-closed. Approval requires all mandatory automated checks
 * to pass and an authorized reviewer. Automated scores never auto-approve exact-product fidelity.
 */
export function recordQaDisposition(
  contract: ImageQaValidationContract,
  checks: readonly QaAutomatedCheckResult[],
  request: {
    disposition: QaDisposition;
    reviewer?: QaReviewerAuthorization;
    reviewerNotes?: string;
    attemptedPublish?: boolean;
    recordedAt?: string;
  },
): QaDispositionValidation {
  const readiness = evaluateQaReadiness(checks);
  const recordedAt = request.recordedAt ?? new Date(0).toISOString();

  if (request.attemptedPublish === true && contract.policy.directPublishForbidden) {
    return {
      ok: false,
      error: "direct_publish_forbidden",
      message: "Customer-visible publication is forbidden until governed QA approval is recorded.",
    };
  }

  if (request.disposition === "approved") {
    if (!readiness.ok) {
      const hasPreservationUncertainty = checks.some(
        (check) => check.id === "preservation_provenance" && check.status === "uncertain",
      );
      if (hasPreservationUncertainty) {
        return {
          ok: false,
          error: "preservation_uncertain",
          message:
            "Cannot approve while packaging/text/logo preservation is uncertain — human visual confirmation required.",
        };
      }

      const hasFailures = checks.some(
        (check) => check.mandatory && check.status === "fail",
      );
      return {
        ok: false,
        error: hasFailures ? "automated_checks_failed" : "automated_checks_incomplete",
        message: readiness.message,
      };
    }

    if (!request.reviewer) {
      return {
        ok: false,
        error: "reviewer_missing",
        message: "Governed reviewer authorization is required to approve media.",
      };
    }

    const auth = validateQaReviewerAuthorization(request.reviewer, "approved");
    if (!auth.ok) {
      return auth;
    }

    if (contract.policy.autoApproveForbidden && !request.reviewer) {
      return {
        ok: false,
        error: "auto_approve_forbidden",
        message: "Automated checks cannot auto-approve — governed reviewer disposition required.",
      };
    }
  }

  if (request.disposition === "rejected" || request.disposition === "hold") {
    if (!request.reviewer) {
      return {
        ok: false,
        error: "reviewer_missing",
        message: "Governed reviewer authorization is required to record reject/hold disposition.",
      };
    }

    const auth = validateQaReviewerAuthorization(request.reviewer, request.disposition);
    if (!auth.ok) {
      return auth;
    }
  }

  const sourceBinding = checks.find((check) => check.id === "source_binding");
  if (sourceBinding?.status === "fail") {
    return {
      ok: false,
      error: "source_binding_broken",
      message: "Cannot record disposition while source binding is broken.",
    };
  }

  return {
    ok: true,
    audit: {
      schema: "point46_audit_v1",
      candidateMediaRef: contract.candidate.mediaRef,
      productId: contract.candidate.productId,
      readinessSlot: contract.candidate.readinessSlot,
      origin: contract.candidate.origin,
      disposition: request.disposition,
      automatedChecks: checks,
      reviewer: request.reviewer,
      reviewerNotes: request.reviewerNotes,
      recordedAt,
    },
  };
}

/** Programme census of image/media QA surfaces (read-only evidence). */
export function buildImageQaValidationCensus(
  baselineSha: string,
  predecessorSha: string,
): ImageQaValidationCensus {
  return {
    schema: "point46_census_v1",
    baselineSha,
    predecessorSha,
    mandatoryCheckCount: MANDATORY_CHECKS.length,
    surfaces: {
      point42Families: "src/features/mediaReadiness/controlledPhotographyFamilies.ts",
      point43BenchmarkGovernance: "src/features/mediaReadiness/benchmarkPhotographyGovernance.ts",
      point44GuidedCapture: "src/features/mediaReadiness/guidedMobileCameraCapture.ts",
      point45Enhancement: "src/features/mediaReadiness/exactProductEnhancement.ts",
      mediaAuthorityContract:
        "src/features/mediaReadiness/mediaAuthorityContract.ts — approved-only authority; QA disposition gates approval",
      mediaReadinessEngine:
        "src/features/mediaReadiness/mediaReadinessEngine.ts — slot readiness; pending rows never satisfy",
      productMediaPersistence:
        "src/features/productAuthority/productMediaPersistence.ts — writes product_media rows; no QA disposition gate yet",
      productMediaUploader:
        "src/components/ProductMediaUploader.tsx — direct upload; no QA review surface wired",
      catalogueProductStudio:
        "src/pages/CatalogueProductStudio.tsx — Media tab; no operator QA review UI yet",
      catalogueMediaSlots: "src/features/catalogueAiStudio/catalogueMediaSlots.ts",
      mediaLibraryPage: "src/pages/Media.tsx — placeholder UI; no QA disposition workflow",
    },
    riskyPaths: [
      "ProductMediaUploader can persist media without Point 46 QA disposition or audit record",
      "productMediaPersistence insertProductMediaRow has no QA disposition validation gate",
      "mediaAuthorityContract approved rows could be written without Point 46 reviewer audit",
      "No operator QA review surface in Catalogue Studio Media tab",
      "Automated QA scores could be misinterpreted as approval without human fidelity review",
      "Enhancement candidates from Point 45 can remain pending_review indefinitely without QA workflow",
      "Direct customer-visible publication possible if media_status set to approved outside QA lane",
    ],
    gaps: [
      "No live operator QA review UI — contract + mock checks only",
      "product_media schema has no qa_audit_ref column — audit carried in contract layer only",
      "No integration with productMediaPersistence status transitions",
      "Real-image human QA UAT not performed — fixtures/mocks only",
      "Point 47 derivative encoding not implemented",
    ],
    downstreamPoints: {
      point47: "Photography output formats / derivative encoding — separate",
    },
  };
}
