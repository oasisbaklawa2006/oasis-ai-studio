/**
 * Point 47 — Governed derivative/output formats canonical contract.
 * WebP/WebM/print/UHD derivative generation requires an approved Point 46 QA media identity and
 * preserves source hash, product id, readiness slot, and QA audit linkage. Fail-closed on
 * unapproved source, unknown profile, unsupported codec/tooling, source overwrite risk, or missing
 * provenance. Mock/local transforms only — no real encoding or production mutation.
 */
import { sanitizeMediaFileName } from "@/features/catalogueDrafts/mediaDraftBoundary";
import {
  type ControlledPhotographyFamilyKey,
  mapUploaderTypeToReadinessSlot,
  resolveControlledPhotographyFamily,
} from "./controlledPhotographyFamilies";
import type { QaAuditRecord } from "./imageQaValidation";
import type { MediaAssetType, ProductMediaContext } from "./types";

export type DerivativeOutputProfileId =
  | "web_catalogue_webp"
  | "web_hero_webp"
  | "print_ready_jpeg"
  | "uhd_archive_jpeg"
  | "web_motion_webm";

export type DerivativeMimeType = "image/webp" | "image/jpeg" | "video/webm";

export type DerivativeOutputProfile = {
  id: DerivativeOutputProfileId;
  label: string;
  mimeType: DerivativeMimeType;
  fileExtension: "webp" | "jpeg" | "webm";
  /** Long-edge pixel target for mock transform metadata — not real encoding. */
  maxLongEdgePx: number;
  /** Minimum long-edge for print profile eligibility checks. */
  minLongEdgePx?: number;
  aspectRatioHint?: "1:1" | "3:4" | "4:3" | "any";
  /** Existing catalogue/customer consumption surfaces this profile serves. */
  consumptionSurfaces: readonly string[];
  /** Mock tooling id — no external provider deployment in this lane. */
  mockToolingId: string;
};

export type ApprovedQaSourceBinding = {
  approvedMediaId: string;
  approvedMediaRef: string;
  sourceMediaId: string;
  sourceContentHash: string;
  productId: string;
  readinessSlot: MediaAssetType;
  uploaderType: string;
  familyKey: ControlledPhotographyFamilyKey;
  qaAuditRef: string;
};

export type DerivativeOutputPolicy = {
  /** Only Point 46 approved disposition may enter derivative generation. */
  approvedSourceOnly: true;
  /** Derivatives must never overwrite raw/source storage paths. */
  sourceOverwriteForbidden: true;
  /** Success requires canonical persistence acknowledgement — no upload/publish claims without it. */
  persistenceRequiredForSuccess: true;
};

export type DerivativeOutputContract = {
  schema: "point47_v1";
  familyKey: ControlledPhotographyFamilyKey;
  productContext: ProductMediaContext;
  approvedSource: ApprovedQaSourceBinding;
  profile: DerivativeOutputProfile;
  policy: DerivativeOutputPolicy;
  upstreamAuthority: {
    photographyFamilies: "point42";
    benchmarkGovernance: "point43";
    mobileCapture: "point44";
    enhancement: "point45";
    imageQa: "point46";
  };
};

export type DerivativeOutputResolution =
  | { ok: true; contract: DerivativeOutputContract }
  | {
      ok: false;
      error:
        | "product_identity_unresolved"
        | "qa_source_unapproved"
        | "qa_audit_missing"
        | "qa_audit_mismatch"
        | "source_hash_missing"
        | "source_media_unbound"
        | "unknown_output_profile"
        | "profile_slot_incompatible"
        | "profile_codec_unsupported"
        | "unknown_uploader_type"
        | "unknown_slot"
        | "family_resolution_failed"
        | "source_product_mismatch";
      message: string;
    };

export type DerivativeTransformProvenance = {
  schema: "point47_provenance_v1";
  profileId: DerivativeOutputProfileId;
  mimeType: DerivativeMimeType;
  sourceContentHash: string;
  sourceMediaId: string;
  approvedMediaId: string;
  productId: string;
  readinessSlot: MediaAssetType;
  qaAuditRef: string;
  mockToolingId: string;
  executedAt: string;
};

export type DerivativeTransformOutput = {
  derivativeMediaRef: string;
  storagePath: string;
  mimeType: DerivativeMimeType;
  provenance: DerivativeTransformProvenance;
  manifest: DerivativeManifestMetadata;
};

export type DerivativeManifestMetadata = {
  schema: "point47_manifest_v1";
  profileId: DerivativeOutputProfileId;
  productId: string;
  readinessSlot: MediaAssetType;
  sourceContentHash: string;
  qaAuditRef: string;
  mimeType: DerivativeMimeType;
  storagePath: string;
  /** Mock transform dimensions — fixtures only. */
  widthPx: number;
  heightPx: number;
  consumptionSurfaces: readonly string[];
};

export type DerivativeProvenanceValidation =
  | { ok: true; provenance: DerivativeTransformProvenance }
  | {
      ok: false;
      error:
        | "provenance_missing"
        | "source_hash_mismatch"
        | "source_media_mismatch"
        | "product_mismatch"
        | "slot_mismatch"
        | "qa_audit_mismatch"
        | "profile_mismatch"
        | "policy_schema_mismatch";
      message: string;
    };

export type DerivativePersistenceHandoff = {
  attemptedPublish?: boolean;
  attemptedStatus?: string;
  /** Original source storage path — derivative output must not equal or target raw/ namespace. */
  sourceStoragePath?: string;
  persistenceResult?: { ok: true; storagePath: string } | { ok: false; message: string };
};

export type DerivativeHandoffValidation =
  | { ok: true; output: DerivativeTransformOutput; persisted: true }
  | {
      ok: false;
      error:
        | "provenance_invalid"
        | "source_overwrite_risk"
        | "direct_publish_forbidden"
        | "persistence_missing"
        | "persistence_failed"
        | "success_claim_without_persistence";
      message: string;
    };

export type DerivativeOutputCensus = {
  schema: "point47_census_v1";
  baselineSha: string;
  predecessorSha: string;
  profileCount: number;
  surfaces: Record<string, string>;
  riskyPaths: readonly string[];
  gaps: readonly string[];
};

const DERIVATIVE_OUTPUT_PROFILES: Record<DerivativeOutputProfileId, DerivativeOutputProfile> = {
  web_catalogue_webp: {
    id: "web_catalogue_webp",
    label: "Web catalogue grid (WebP)",
    mimeType: "image/webp",
    fileExtension: "webp",
    maxLongEdgePx: 1200,
    aspectRatioHint: "1:1",
    consumptionSurfaces: [
      "catalogueMediaSummary",
      "catalogue_builder_card_image",
      "whatsapp_square_crop",
      "central_sync_catalogue_image",
    ],
    mockToolingId: "mock_webp_encoder_v1",
  },
  web_hero_webp: {
    id: "web_hero_webp",
    label: "Web hero/list thumbnail (WebP)",
    mimeType: "image/webp",
    fileExtension: "webp",
    maxLongEdgePx: 1200,
    aspectRatioHint: "3:4",
    consumptionSurfaces: [
      "resolveProductCardHeroUrl",
      "product_master_list_thumbnail",
      "catalogue_studio_media_tab",
    ],
    mockToolingId: "mock_webp_encoder_v1",
  },
  print_ready_jpeg: {
    id: "print_ready_jpeg",
    label: "Print-ready JPEG",
    mimeType: "image/jpeg",
    fileExtension: "jpeg",
    maxLongEdgePx: 3000,
    minLongEdgePx: 2400,
    aspectRatioHint: "any",
    consumptionSurfaces: ["trace_print_queue_planned", "label_app_pdf_fallback_planned"],
    mockToolingId: "mock_print_jpeg_encoder_v1",
  },
  uhd_archive_jpeg: {
    id: "uhd_archive_jpeg",
    label: "UHD archive master (JPEG)",
    mimeType: "image/jpeg",
    fileExtension: "jpeg",
    maxLongEdgePx: 3840,
    aspectRatioHint: "any",
    consumptionSurfaces: ["uhd_display_archive", "future_buyer_portal_uhd"],
    mockToolingId: "mock_uhd_jpeg_encoder_v1",
  },
  web_motion_webm: {
    id: "web_motion_webm",
    label: "Web motion delivery (WebM)",
    mimeType: "video/webm",
    fileExtension: "webm",
    maxLongEdgePx: 1920,
    aspectRatioHint: "any",
    consumptionSurfaces: ["whatsapp_rich_media_planned", "catalogue_video_slot"],
    mockToolingId: "mock_webm_encoder_v1",
  },
};

const IMAGE_PROFILES: readonly DerivativeOutputProfileId[] = [
  "web_catalogue_webp",
  "web_hero_webp",
  "print_ready_jpeg",
  "uhd_archive_jpeg",
];

const VIDEO_UPLOADER_TYPES = new Set(["video"]);

const SLOT_PROFILE_APPLICABILITY: Partial<
  Record<MediaAssetType, readonly DerivativeOutputProfileId[]>
> = {
  primary_image: ["web_hero_webp", "print_ready_jpeg", "uhd_archive_jpeg"],
  catalogue_image: ["web_catalogue_webp", "print_ready_jpeg", "uhd_archive_jpeg"],
  close_up_image: ["web_catalogue_webp", "print_ready_jpeg", "uhd_archive_jpeg"],
  pack_front_image: ["web_hero_webp", "print_ready_jpeg", "uhd_archive_jpeg"],
  open_pack_image: ["web_hero_webp", "print_ready_jpeg", "uhd_archive_jpeg"],
  label_front_image: ["print_ready_jpeg", "uhd_archive_jpeg"],
  packaging_reference: ["print_ready_jpeg", "uhd_archive_jpeg"],
  master_carton_image: ["print_ready_jpeg", "uhd_archive_jpeg"],
  hamper_arrangement_image: ["web_hero_webp", "print_ready_jpeg", "uhd_archive_jpeg"],
  pairing_image: ["web_catalogue_webp", "print_ready_jpeg", "uhd_archive_jpeg"],
  secondary_angle: ["web_catalogue_webp", "print_ready_jpeg", "uhd_archive_jpeg"],
  secondary_image: ["print_ready_jpeg", "uhd_archive_jpeg"],
  lifestyle_variant: ["web_hero_webp", "print_ready_jpeg", "uhd_archive_jpeg"],
  source_reference: ["print_ready_jpeg", "uhd_archive_jpeg"],
  export_pack_image: ["print_ready_jpeg", "uhd_archive_jpeg"],
  label_back_image: ["print_ready_jpeg", "uhd_archive_jpeg"],
};

const DEFAULT_IMAGE_PROFILES: readonly DerivativeOutputProfileId[] = [
  "print_ready_jpeg",
  "uhd_archive_jpeg",
];

export function listDerivativeOutputProfiles(): readonly DerivativeOutputProfile[] {
  return Object.values(DERIVATIVE_OUTPUT_PROFILES);
}

export function getDerivativeOutputProfile(
  profileId: string,
): DerivativeOutputProfile | undefined {
  return DERIVATIVE_OUTPUT_PROFILES[profileId as DerivativeOutputProfileId];
}

/** Resolve applicable profiles for a readiness slot — fail-closed when profile unknown. */
export function resolveProfilesForSlot(
  readinessSlot: MediaAssetType,
  uploaderType: string,
): readonly DerivativeOutputProfileId[] {
  if (VIDEO_UPLOADER_TYPES.has(uploaderType.trim().toLowerCase())) {
    return ["web_motion_webm"];
  }
  return SLOT_PROFILE_APPLICABILITY[readinessSlot] ?? DEFAULT_IMAGE_PROFILES;
}

/** Deterministic derivative storage path — never targets raw/ source paths. */
export function buildDerivativeStoragePath(input: {
  productId: string;
  profileId: DerivativeOutputProfileId;
  sourceContentHash: string;
  fileExtension: DerivativeOutputProfile["fileExtension"];
}): string {
  const folder = sanitizeMediaFileName(input.productId.trim());
  const hashPrefix = sanitizeMediaFileName(input.sourceContentHash.trim()).slice(0, 16);
  const profileSegment = sanitizeMediaFileName(input.profileId);
  const ext = sanitizeMediaFileName(input.fileExtension);
  return `products/${folder}/derivatives/${profileSegment}/${hashPrefix}.${ext}`;
}

/** Fail-closed when storage path would overwrite source/raw bytes. */
export function assessSourceOverwriteRisk(
  storagePath: string,
  sourceStoragePath?: string,
): { ok: true } | { ok: false; message: string } {
  const normalized = storagePath.trim().toLowerCase();
  if (normalized.includes("/raw/")) {
    return {
      ok: false,
      message: "Derivative storage path must not target raw/ source namespace.",
    };
  }
  if (normalized.includes("/submissions/")) {
    return {
      ok: false,
      message: "Derivative storage path must not target submissions/ staging namespace.",
    };
  }
  if (sourceStoragePath && storagePath.trim() === sourceStoragePath.trim()) {
    return {
      ok: false,
      message: "Derivative storage path must not equal source storage path.",
    };
  }
  return { ok: true };
}

function buildQaAuditRef(audit: QaAuditRecord): string {
  return `${audit.schema}:${audit.candidateMediaRef}:${audit.recordedAt}`;
}

/** Validate Point 46 QA audit authorizes derivative generation. */
export function validateApprovedQaSource(
  audit: QaAuditRecord,
  source: Omit<ApprovedQaSourceBinding, "qaAuditRef">,
): { ok: true; qaAuditRef: string } | { ok: false; error: DerivativeOutputResolution["error"]; message: string } {
  if (audit.disposition !== "approved") {
    return {
      ok: false,
      error: "qa_source_unapproved",
      message: `Derivative generation requires Point 46 approved disposition — received ${audit.disposition}.`,
    };
  }

  if (audit.productId.trim() !== source.productId.trim()) {
    return {
      ok: false,
      error: "qa_audit_mismatch",
      message: "QA audit product id does not match approved source binding.",
    };
  }

  if (audit.readinessSlot !== source.readinessSlot) {
    return {
      ok: false,
      error: "qa_audit_mismatch",
      message: "QA audit readiness slot does not match approved source binding.",
    };
  }

  if (audit.candidateMediaRef.trim() !== source.approvedMediaRef.trim()) {
    return {
      ok: false,
      error: "qa_audit_mismatch",
      message: "QA audit candidate media ref does not match approved source media ref.",
    };
  }

  return { ok: true, qaAuditRef: buildQaAuditRef(audit) };
}

/** Resolve Point 47 derivative contract — fail-closed via Point 42 chain and Point 46 QA approval. */
export function resolveDerivativeOutputContract(
  product: ProductMediaContext,
  approvedSource: Omit<ApprovedQaSourceBinding, "qaAuditRef">,
  qaAudit: QaAuditRecord,
  profileId: string,
): DerivativeOutputResolution {
  const productId = product.productId?.trim();
  if (!productId) {
    return {
      ok: false,
      error: "product_identity_unresolved",
      message: "Product identity is required before derivative generation can begin.",
    };
  }

  if (approvedSource.productId.trim() !== productId) {
    return {
      ok: false,
      error: "source_product_mismatch",
      message: "Approved source product id does not match resolved product context.",
    };
  }

  const sourceContentHash = approvedSource.sourceContentHash.trim();
  if (!sourceContentHash) {
    return {
      ok: false,
      error: "source_hash_missing",
      message: "Source content hash is required for derivative provenance binding.",
    };
  }

  if (!approvedSource.sourceMediaId.trim()) {
    return {
      ok: false,
      error: "source_media_unbound",
      message: "Source media id is required for derivative provenance binding.",
    };
  }

  if (!approvedSource.approvedMediaId.trim() || !approvedSource.approvedMediaRef.trim()) {
    return {
      ok: false,
      error: "qa_audit_missing",
      message: "Approved QA media identity (id + ref) is required for derivative generation.",
    };
  }

  const qaValidation = validateApprovedQaSource(qaAudit, approvedSource);
  if (!qaValidation.ok) {
    return qaValidation;
  }

  const profile = getDerivativeOutputProfile(profileId);
  if (!profile) {
    return {
      ok: false,
      error: "unknown_output_profile",
      message: `Unknown derivative output profile: ${profileId}`,
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

  if (approvedSource.familyKey !== familyResolved.contract.familyKey) {
    return {
      ok: false,
      error: "source_product_mismatch",
      message: "Approved source family key does not match resolved product family.",
    };
  }

  const normalizedUploader = approvedSource.uploaderType.trim().toLowerCase();
  const mappedSlot = VIDEO_UPLOADER_TYPES.has(normalizedUploader)
    ? ({ ok: true as const, slot: approvedSource.readinessSlot })
    : mapUploaderTypeToReadinessSlot(approvedSource.uploaderType);
  if (!mappedSlot.ok) {
    return {
      ok: false,
      error: "unknown_uploader_type",
      message: mappedSlot.message,
    };
  }

  if (approvedSource.readinessSlot !== mappedSlot.slot) {
    return {
      ok: false,
      error: "unknown_slot",
      message: "Approved source readiness slot does not match Point 42 uploader mapping.",
    };
  }

  const applicableProfiles = resolveProfilesForSlot(
    approvedSource.readinessSlot,
    approvedSource.uploaderType,
  );
  if (!applicableProfiles.includes(profile.id)) {
    return {
      ok: false,
      error: "profile_slot_incompatible",
      message: `Profile ${profile.id} is not supported for readiness slot ${approvedSource.readinessSlot}.`,
    };
  }

  if (profile.id === "web_motion_webm" && !VIDEO_UPLOADER_TYPES.has(approvedSource.uploaderType)) {
    return {
      ok: false,
      error: "profile_codec_unsupported",
      message: "WebM motion profile requires video source uploader type.",
    };
  }

  if (
    profile.mimeType.startsWith("image/") &&
    VIDEO_UPLOADER_TYPES.has(approvedSource.uploaderType.trim().toLowerCase())
  ) {
    return {
      ok: false,
      error: "profile_codec_unsupported",
      message: "Image derivative profiles cannot be generated from video source uploader type.",
    };
  }

  return {
    ok: true,
    contract: {
      schema: "point47_v1",
      familyKey: familyResolved.contract.familyKey,
      productContext: { ...product, productId },
      approvedSource: {
        ...approvedSource,
        productId,
        sourceContentHash,
        qaAuditRef: qaValidation.qaAuditRef,
      },
      profile,
      policy: {
        approvedSourceOnly: true,
        sourceOverwriteForbidden: true,
        persistenceRequiredForSuccess: true,
      },
      upstreamAuthority: {
        photographyFamilies: "point42",
        benchmarkGovernance: "point43",
        mobileCapture: "point44",
        enhancement: "point45",
        imageQa: "point46",
      },
    },
  };
}

function mockDimensionsForProfile(
  profile: DerivativeOutputProfile,
  source?: { widthPx?: number; heightPx?: number },
): { widthPx: number; heightPx: number } {
  const sourceLong = Math.max(source?.widthPx ?? profile.maxLongEdgePx, source?.heightPx ?? profile.maxLongEdgePx);
  const longEdge = Math.min(sourceLong, profile.maxLongEdgePx);
  if (profile.aspectRatioHint === "1:1") {
    return { widthPx: longEdge, heightPx: longEdge };
  }
  if (profile.aspectRatioHint === "3:4") {
    return { widthPx: Math.round(longEdge * 0.75), heightPx: longEdge };
  }
  if (profile.aspectRatioHint === "4:3") {
    return { widthPx: longEdge, heightPx: Math.round(longEdge * 0.75) };
  }
  return { widthPx: longEdge, heightPx: longEdge };
}

/**
 * Mock derivative transform for deterministic tests — no real image/video encoding.
 * Returns fixture output with provenance bound to approved QA source.
 */
export function executeMockDerivativeTransform(
  contract: DerivativeOutputContract,
  sourceMetadata?: { widthPx?: number; heightPx?: number; sourceStoragePath?: string },
): DerivativeTransformOutput | { ok: false; error: string } {
  const { approvedSource, profile } = contract;
  const storagePath = buildDerivativeStoragePath({
    productId: approvedSource.productId,
    profileId: profile.id,
    sourceContentHash: approvedSource.sourceContentHash,
    fileExtension: profile.fileExtension,
  });

  const overwriteRisk = assessSourceOverwriteRisk(storagePath, sourceMetadata?.sourceStoragePath);
  if (!overwriteRisk.ok) {
    return { ok: false, error: overwriteRisk.message };
  }

  const dimensions = mockDimensionsForProfile(profile, sourceMetadata);
  if (profile.minLongEdgePx && Math.max(dimensions.widthPx, dimensions.heightPx) < profile.minLongEdgePx) {
    return {
      ok: false,
      error: `Mock source dimensions below print profile minimum long edge (${profile.minLongEdgePx}px).`,
    };
  }

  const executedAt = new Date(0).toISOString();
  const provenance: DerivativeTransformProvenance = {
    schema: "point47_provenance_v1",
    profileId: profile.id,
    mimeType: profile.mimeType,
    sourceContentHash: approvedSource.sourceContentHash,
    sourceMediaId: approvedSource.sourceMediaId,
    approvedMediaId: approvedSource.approvedMediaId,
    productId: approvedSource.productId,
    readinessSlot: approvedSource.readinessSlot,
    qaAuditRef: approvedSource.qaAuditRef,
    mockToolingId: profile.mockToolingId,
    executedAt,
  };

  return {
    derivativeMediaRef: `mock://derivative/${profile.id}/${approvedSource.approvedMediaId}`,
    storagePath,
    mimeType: profile.mimeType,
    provenance,
    manifest: {
      schema: "point47_manifest_v1",
      profileId: profile.id,
      productId: approvedSource.productId,
      readinessSlot: approvedSource.readinessSlot,
      sourceContentHash: approvedSource.sourceContentHash,
      qaAuditRef: approvedSource.qaAuditRef,
      mimeType: profile.mimeType,
      storagePath,
      widthPx: dimensions.widthPx,
      heightPx: dimensions.heightPx,
      consumptionSurfaces: profile.consumptionSurfaces,
    },
  };
}

/** Fail-closed when mock/provider output lacks provenance or QA/source binding breaks. */
export function validateDerivativeTransformOutput(
  contract: DerivativeOutputContract,
  output: DerivativeTransformOutput,
): DerivativeProvenanceValidation {
  const { provenance } = output;
  if (!provenance) {
    return {
      ok: false,
      error: "provenance_missing",
      message: "Derivative output must include provenance metadata.",
    };
  }

  if (provenance.schema !== "point47_provenance_v1") {
    return {
      ok: false,
      error: "policy_schema_mismatch",
      message: `Expected provenance schema point47_provenance_v1, received ${provenance.schema}.`,
    };
  }

  const { approvedSource } = contract;

  if (provenance.sourceContentHash !== approvedSource.sourceContentHash) {
    return {
      ok: false,
      error: "source_hash_mismatch",
      message: "Derivative output source hash does not match approved QA source.",
    };
  }

  if (provenance.sourceMediaId !== approvedSource.sourceMediaId) {
    return {
      ok: false,
      error: "source_media_mismatch",
      message: "Derivative output source media id does not match approved QA source.",
    };
  }

  if (provenance.approvedMediaId !== approvedSource.approvedMediaId) {
    return {
      ok: false,
      error: "qa_audit_mismatch",
      message: "Derivative output approved media id does not match Point 46 QA source.",
    };
  }

  if (provenance.productId !== approvedSource.productId) {
    return {
      ok: false,
      error: "product_mismatch",
      message: "Derivative output product id does not match approved QA source.",
    };
  }

  if (provenance.readinessSlot !== approvedSource.readinessSlot) {
    return {
      ok: false,
      error: "slot_mismatch",
      message: "Derivative output readiness slot does not match approved QA source.",
    };
  }

  if (provenance.qaAuditRef !== approvedSource.qaAuditRef) {
    return {
      ok: false,
      error: "qa_audit_mismatch",
      message: "Derivative output QA audit ref does not match approved Point 46 audit linkage.",
    };
  }

  if (provenance.profileId !== contract.profile.id) {
    return {
      ok: false,
      error: "profile_mismatch",
      message: "Derivative output profile id does not match resolved contract profile.",
    };
  }

  if (output.mimeType !== contract.profile.mimeType) {
    return {
      ok: false,
      error: "profile_mismatch",
      message: "Derivative output MIME type does not match profile contract.",
    };
  }

  return { ok: true, provenance };
}

/**
 * Validate derivative persistence handoff — fail-closed on source overwrite, direct publish,
 * or success claims without canonical persistence result.
 */
export function validateDerivativePersistenceHandoff(
  contract: DerivativeOutputContract,
  output: DerivativeTransformOutput,
  handoff: DerivativePersistenceHandoff,
): DerivativeHandoffValidation {
  const provenanceCheck = validateDerivativeTransformOutput(contract, output);
  if (!provenanceCheck.ok) {
    return {
      ok: false,
      error: "provenance_invalid",
      message: provenanceCheck.message,
    };
  }

  const overwriteRisk = assessSourceOverwriteRisk(
    output.storagePath,
    handoff.sourceStoragePath,
  );
  if (!overwriteRisk.ok) {
    return {
      ok: false,
      error: "source_overwrite_risk",
      message: overwriteRisk.message,
    };
  }

  if (handoff.attemptedPublish === true) {
    return {
      ok: false,
      error: "direct_publish_forbidden",
      message: "Derivative outputs cannot be published directly — persistence handoff required.",
    };
  }

  if (!handoff.persistenceResult) {
    return {
      ok: false,
      error: "persistence_missing",
      message: "Derivative generation cannot claim success without a persistence result.",
    };
  }

  if (!handoff.persistenceResult.ok) {
    return {
      ok: false,
      error: "persistence_failed",
      message: handoff.persistenceResult.message,
    };
  }

  if (handoff.attemptedStatus === "uploaded" || handoff.attemptedStatus === "published") {
    if (handoff.persistenceResult.ok !== true) {
      return {
        ok: false,
        error: "success_claim_without_persistence",
        message: "Upload/publish success cannot be claimed without canonical persistence acknowledgement.",
      };
    }
  }

  if (handoff.persistenceResult.storagePath !== output.storagePath) {
    return {
      ok: false,
      error: "persistence_failed",
      message: "Persistence storage path does not match derivative contract output path.",
    };
  }

  return { ok: true, output, persisted: true };
}

/** Programme census of derivative/export surfaces (read-only evidence). */
export function buildDerivativeOutputCensus(
  baselineSha: string,
  predecessorSha: string,
): DerivativeOutputCensus {
  return {
    schema: "point47_census_v1",
    baselineSha,
    predecessorSha,
    profileCount: Object.keys(DERIVATIVE_OUTPUT_PROFILES).length,
    surfaces: {
      point42Families: "src/features/mediaReadiness/controlledPhotographyFamilies.ts",
      point43BenchmarkGovernance: "src/features/mediaReadiness/benchmarkPhotographyGovernance.ts",
      point44GuidedCapture: "src/features/mediaReadiness/guidedMobileCameraCapture.ts",
      point45Enhancement: "src/features/mediaReadiness/exactProductEnhancement.ts",
      point46ImageQa: "src/features/mediaReadiness/imageQaValidation.ts — approved disposition required",
      derivativeOutputContract: "src/features/mediaReadiness/derivativeOutputContract.ts — authoritative",
      mediaDraftBoundary:
        "src/features/catalogueDrafts/mediaDraftBoundary.ts — MIME allowlist + raw/submissions path builders",
      productMediaPersistence:
        "src/features/productAuthority/productMediaPersistence.ts — writes product_media rows; no derivative gate yet",
      productMediaUploader:
        "src/components/ProductMediaUploader.tsx — direct upload only; no derivative generation lane",
      catalogueProductStudio:
        "src/pages/CatalogueProductStudio.tsx — Media tab; no derivative export UI yet",
      catalogueMediaSlots: "src/features/catalogueAiStudio/catalogueMediaSlots.ts",
      catalogueSnapshot:
        "src/features/catalogueSnapshot/snapshotGenerator.ts — consumes approved hero URLs; no derivative manifest yet",
      mediaLibraryPage: "src/pages/Media.tsx — placeholder UI; no derivative workflow",
      unifiedMediaArchitecture: "docs/UNIFIED_PRODUCT_MEDIA_ARCHITECTURE.md — role/slot consumption map",
    },
    riskyPaths: [
      "ProductMediaUploader can persist raw uploads without Point 47 derivative provenance",
      "productMediaPersistence insertProductMediaRow has no derivative profile validation gate",
      "No live WebP/WebM/print/UHD encoder — contract + mock transforms only",
      "Catalogue snapshot could reference unapproved URLs if derivative publish bypasses QA chain",
      "Direct raw/ path reuse would overwrite source bytes — blocked at contract layer only until persistence wired",
      "Generated derivative state could claim upload success without persistence — blocked by handoff validator",
    ],
    gaps: [
      "No live encoder/provider adapter — mock transforms only",
      "product_media schema has no derivative_manifest_ref column — manifest carried in contract layer only",
      "No Catalogue Studio derivative export UI",
      "Real export/print/UHD/video UAT not performed — fixtures/mocks only",
      "Persistence integration with product-media bucket deferred",
    ],
  };
}

export { IMAGE_PROFILES, DERIVATIVE_OUTPUT_PROFILES };
