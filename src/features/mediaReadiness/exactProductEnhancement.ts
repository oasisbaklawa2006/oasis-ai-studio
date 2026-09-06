/**
 * Point 45 — Exact-product AI enhancement canonical contract.
 * Governs lighting/background/cleanliness improvements only — packaging text/logo/artwork and
 * product geometry/content remain source-bound. Requires immutable source-media identity, product
 * identity, Point 42 slot/family binding, and Point 43 benchmark preservation constraints.
 * Fail-closed when preservation cannot be proven or provider output lacks provenance.
 * Output is always a review candidate for Point 46 — never auto-approved or customer-visible.
 * No real image editing/generation in this lane; fixtures/mocks only.
 */
import {
  type BenchmarkGovernanceConstraint,
  type BenchmarkPhotographyGovernanceContract,
  resolveBenchmarkPhotographyGovernance,
  validateBenchmarkOperatorInstruction,
} from "./benchmarkPhotographyGovernance";
import {
  type ControlledPhotographyFamilyKey,
  resolveControlledPhotographyFamily,
} from "./controlledPhotographyFamilies";
import { bindCaptureSlot } from "./guidedMobileCameraCapture";
import type { MediaAssetType, ProductMediaContext } from "./types";

/** Governed enhancement operations — lighting/background/cleanliness only. */
export type EnhancementAllowedOperation =
  | "lighting_balance"
  | "background_cleanup"
  | "noise_reduction"
  | "color_cast_correction"
  | "exposure_normalization";

/** Operations that violate exact-product fidelity — always rejected. */
export type EnhancementForbiddenOperation =
  | "regenerate_packaging"
  | "alter_product_geometry"
  | "alter_piece_count"
  | "alter_product_color"
  | "add_remove_text"
  | "hallucinate_contents"
  | "replace_logo"
  | "inpaint_product"
  | "generative_fill"
  | "background_replacement_with_new_scene";

export type SourceMediaBinding = {
  sourceMediaId: string;
  /** Immutable content hash of the original capture bytes — required for provenance chain. */
  contentHash: string;
  productId: string;
  readinessSlot: MediaAssetType;
  uploaderType: string;
  familyKey: ControlledPhotographyFamilyKey;
};

export type EnhancementPreservationRequirement = {
  id: string;
  domain: "packaging_text" | "product_geometry" | "piece_count" | "logo_artwork" | "product_color";
  rule: string;
  /** Benchmark constraint ids from Point 43 that enforce this requirement. */
  benchmarkConstraintIds: readonly string[];
};

export type EnhancementPolicy = {
  allowedOperations: readonly EnhancementAllowedOperation[];
  forbiddenOperations: readonly EnhancementForbiddenOperation[];
  preservationRequirements: readonly EnhancementPreservationRequirement[];
  /** Operator instructions must pass Point 43 benchmark validation before enhancement. */
  benchmarkConstraints: readonly BenchmarkGovernanceConstraint[];
};

export type EnhancementOutputPolicy = {
  /** Enhanced output is always a review candidate — never auto-approved. */
  reviewCandidateOnly: true;
  /** Customer-visible or approved media cannot be written directly from enhancement. */
  directPublishForbidden: true;
  /** Downstream QA authority owns approval — Point 46. */
  qaAuthority: "point46";
  /** Derivative encoding is separate — Point 47. */
  outputsAuthority: "point47";
};

export type ExactProductEnhancementContract = {
  schema: "point45_v1";
  familyKey: ControlledPhotographyFamilyKey;
  sourceBinding: SourceMediaBinding;
  policy: EnhancementPolicy;
  outputPolicy: EnhancementOutputPolicy;
  upstreamAuthority: {
    photographyFamilies: "point42";
    benchmarkGovernance: "point43";
    mobileCapture: "point44";
  };
  downstreamAuthority: {
    qa: "point46";
    outputs: "point47";
  };
};

export type ExactProductEnhancementResolution =
  | {
      ok: true;
      contract: ExactProductEnhancementContract;
      governance: BenchmarkPhotographyGovernanceContract;
    }
  | {
      ok: false;
      error:
        | "product_identity_unresolved"
        | "source_media_unbound"
        | "source_hash_missing"
        | "unknown_uploader_type"
        | "unknown_slot"
        | "family_resolution_failed"
        | "source_product_mismatch";
      message: string;
    };

export type EnhancementInstructionValidation =
  | { ok: true; sanitizedInstruction: string }
  | {
      ok: false;
      error:
        | "forbidden_enhancement_operation"
        | "conflicts_with_preservation"
        | "conflicts_with_benchmark"
        | "empty_instruction";
      message: string;
    };

/** Provider output provenance — required for acceptance; fixtures/mocks only in this lane. */
export type EnhancementProviderProvenance = {
  providerName: string;
  policySchema: "point45_v1";
  sourceContentHash: string;
  sourceMediaId: string;
  productId: string;
  readinessSlot: MediaAssetType;
  requestedOperations: readonly EnhancementAllowedOperation[];
  preservationAttestation: {
    packagingTextPreserved: boolean;
    productGeometryPreserved: boolean;
    pieceCountPreserved: boolean;
    logoArtworkPreserved: boolean;
    productColorPreserved: boolean;
  };
  executedAt: string;
};

export type EnhancementProviderOutput = {
  candidateMediaRef: string;
  provenance: EnhancementProviderProvenance;
};

export type EnhancementProvenanceValidation =
  | { ok: true; provenance: EnhancementProviderProvenance }
  | {
      ok: false;
      error:
        | "provenance_missing"
        | "source_hash_mismatch"
        | "source_media_mismatch"
        | "product_mismatch"
        | "slot_mismatch"
        | "preservation_unproven"
        | "policy_schema_mismatch";
      message: string;
    };

/** Review candidate — never approved in Point 45 lane. */
export type EnhancementReviewCandidate = {
  status: "pending_review";
  contract: ExactProductEnhancementContract;
  providerOutput: EnhancementProviderOutput;
};

export type EnhancementHandoffValidation =
  | { ok: true; candidate: EnhancementReviewCandidate }
  | {
      ok: false;
      error:
        | "auto_approve_forbidden"
        | "direct_publish_forbidden"
        | "provenance_invalid"
        | "source_binding_broken";
      message: string;
    };

export type ExactProductEnhancementCensus = {
  schema: "point45_census_v1";
  baselineSha: string;
  predecessorSha: string;
  allowedOperationCount: number;
  forbiddenOperationCount: number;
  preservationRequirementCount: number;
  surfaces: {
    point42Families: string;
    point43BenchmarkGovernance: string;
    point44GuidedCapture: string;
    catalogueContentGenerators: string;
    catalogueAiGateway: string;
    catalogueProductStudio: string;
    productMediaUploader: string;
    productMediaPersistence: string;
    mediaAuthorityContract: string;
    mediaLibraryPage: string;
    dashboardPlaceholders: string;
    catalogueMediaSlots: string;
  };
  riskyPaths: readonly string[];
  gaps: readonly string[];
  downstreamPoints: Record<string, string>;
};

const FORBIDDEN_INSTRUCTION_PATTERNS: ReadonlyArray<{
  pattern: RegExp;
  operation: EnhancementForbiddenOperation;
}> = [
  { pattern: /\b(regenerat|recreat|redraw|repaint).{0,20}(packag|label|logo|text|artwork)\b/i, operation: "regenerate_packaging" },
  { pattern: /\b(change|alter|modify|reshape|morph).{0,20}(shape|geometry|form|count|pieces)\b/i, operation: "alter_product_geometry" },
  { pattern: /\b(add|remove|extra|fewer).{0,15}(piece|pcs|count|item)\b/i, operation: "alter_piece_count" },
  { pattern: /\b(change|shift|recolor|alter).{0,15}(color|colour|hue|tone)\b/i, operation: "alter_product_color" },
  { pattern: /\b(add|remove|replace).{0,15}(text|label|watermark|price|tag)\b/i, operation: "add_remove_text" },
  { pattern: /\b(hallucinat|invent|imagin|generat).{0,20}(content|product|filling|inside)\b/i, operation: "hallucinate_contents" },
  { pattern: /\b(replace|swap|new).{0,15}logo\b/i, operation: "replace_logo" },
  { pattern: /\binpaint\b/i, operation: "inpaint_product" },
  { pattern: /\b(generative\s+fill|content.?aware\s+fill)\b/i, operation: "generative_fill" },
  { pattern: /\b(new\s+background|replace\s+background|scene\s+swap)\b/i, operation: "background_replacement_with_new_scene" },
];

const ALLOWED_OPERATIONS: readonly EnhancementAllowedOperation[] = [
  "lighting_balance",
  "background_cleanup",
  "noise_reduction",
  "color_cast_correction",
  "exposure_normalization",
];

const FORBIDDEN_OPERATIONS: readonly EnhancementForbiddenOperation[] = [
  "regenerate_packaging",
  "alter_product_geometry",
  "alter_piece_count",
  "alter_product_color",
  "add_remove_text",
  "hallucinate_contents",
  "replace_logo",
  "inpaint_product",
  "generative_fill",
  "background_replacement_with_new_scene",
];

const PRESERVATION_REQUIREMENTS: readonly EnhancementPreservationRequirement[] = [
  {
    id: "packaging_text_preserved",
    domain: "packaging_text",
    rule: "All packaging, label, and carton text must remain legible and unmodified.",
    benchmarkConstraintIds: ["packaging_text_preserve", "no_text_overlay"],
  },
  {
    id: "product_geometry_preserved",
    domain: "product_geometry",
    rule: "Product shape, arrangement, and geometry must match the source capture exactly.",
    benchmarkConstraintIds: ["product_fidelity_exact"],
  },
  {
    id: "piece_count_preserved",
    domain: "piece_count",
    rule: "Visible piece count and arrangement must not change from the source.",
    benchmarkConstraintIds: ["product_fidelity_exact"],
  },
  {
    id: "logo_artwork_preserved",
    domain: "logo_artwork",
    rule: "Brand logos and packaging artwork must not be regenerated or replaced.",
    benchmarkConstraintIds: ["packaging_text_preserve", "no_text_overlay"],
  },
  {
    id: "product_color_preserved",
    domain: "product_color",
    rule: "Product colour must not be materially altered — only neutral cast correction allowed.",
    benchmarkConstraintIds: ["product_fidelity_exact", "lighting_soft_even"],
  },
];

/** Bind immutable source media to product + Point 42 slot before any enhancement request. */
export function bindEnhancementSourceMedia(
  product: ProductMediaContext,
  source: {
    sourceMediaId: string;
    contentHash: string;
    uploaderType: string;
    targetReadinessSlot?: MediaAssetType;
  },
): { ok: true; binding: SourceMediaBinding } | { ok: false; error: string; code: string } {
  const productId = product.productId?.trim();
  if (!productId) {
    return {
      ok: false,
      code: "product_identity_unresolved",
      error: "Product identity is required before source media can bind for enhancement.",
    };
  }

  const contentHash = source.contentHash.trim();
  if (!contentHash) {
    return {
      ok: false,
      code: "source_hash_missing",
      error: "Source media content hash is required for immutable provenance binding.",
    };
  }

  const sourceMediaId = source.sourceMediaId.trim();
  if (!sourceMediaId) {
    return {
      ok: false,
      code: "source_media_unbound",
      error: "Source media id is required for enhancement provenance.",
    };
  }

  const slotBound = bindCaptureSlot(product, source.uploaderType, source.targetReadinessSlot);
  if (!slotBound.ok) {
    const code =
      slotBound.error === "family_resolution_failed"
        ? "family_resolution_failed"
        : slotBound.error === "unknown_uploader_type"
          ? "unknown_uploader_type"
          : slotBound.error === "ambiguous_slot"
            ? "unknown_slot"
            : "unknown_slot";
    return { ok: false, code, error: slotBound.message };
  }

  return {
    ok: true,
    binding: {
      sourceMediaId,
      contentHash,
      productId,
      readinessSlot: slotBound.binding.readinessSlot,
      uploaderType: slotBound.binding.uploaderType,
      familyKey: slotBound.familyKey,
    },
  };
}

/** Build governed enhancement policy from Point 43 benchmark constraints. */
export function buildEnhancementPolicy(
  governance: BenchmarkPhotographyGovernanceContract,
): EnhancementPolicy {
  return {
    allowedOperations: ALLOWED_OPERATIONS,
    forbiddenOperations: FORBIDDEN_OPERATIONS,
    preservationRequirements: PRESERVATION_REQUIREMENTS,
    benchmarkConstraints: governance.universalConstraints,
  };
}

/** Validate operator enhancement instruction — fail-closed on forbidden operations and Point 43 conflicts. */
export function validateEnhancementOperatorInstruction(
  instruction: string,
  product: ProductMediaContext,
): EnhancementInstructionValidation {
  const trimmed = instruction.trim();
  if (!trimmed) {
    return { ok: false, error: "empty_instruction", message: "Enhancement instruction cannot be empty." };
  }

  for (const { pattern, operation } of FORBIDDEN_INSTRUCTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        ok: false,
        error: "forbidden_enhancement_operation",
        message: `Instruction requests forbidden operation: ${operation}.`,
      };
    }
  }

  const familyResolved = resolveControlledPhotographyFamily(product);
  const benchmarkCheck = validateBenchmarkOperatorInstruction(trimmed, {
    familyKey: familyResolved.ok ? familyResolved.contract.familyKey : undefined,
  });
  if (!benchmarkCheck.ok) {
    return {
      ok: false,
      error: "conflicts_with_benchmark",
      message: benchmarkCheck.message,
    };
  }

  return { ok: true, sanitizedInstruction: benchmarkCheck.sanitizedInstruction };
}

/** Resolve Point 45 exact-product enhancement contract — fail-closed via Point 42/43/44 chain. */
export function resolveExactProductEnhancement(
  product: ProductMediaContext,
  source: {
    sourceMediaId: string;
    contentHash: string;
    uploaderType: string;
    targetReadinessSlot?: MediaAssetType;
  },
): ExactProductEnhancementResolution {
  const bound = bindEnhancementSourceMedia(product, source);
  if (!bound.ok) {
    const error =
      bound.code === "product_identity_unresolved"
        ? "product_identity_unresolved"
        : bound.code === "source_hash_missing"
          ? "source_hash_missing"
          : bound.code === "source_media_unbound"
            ? "source_media_unbound"
            : bound.code === "family_resolution_failed"
              ? "family_resolution_failed"
              : bound.code === "unknown_uploader_type"
                ? "unknown_uploader_type"
                : "unknown_slot";
    return { ok: false, error, message: bound.error };
  }

  const governanceResolved = resolveBenchmarkPhotographyGovernance(product);
  if (!governanceResolved.ok) {
    return {
      ok: false,
      error: "family_resolution_failed",
      message: governanceResolved.message,
    };
  }

  if (governanceResolved.contract.familyKey !== bound.binding.familyKey) {
    return {
      ok: false,
      error: "source_product_mismatch",
      message: "Source media family binding does not match resolved product family.",
    };
  }

  const policy = buildEnhancementPolicy(governanceResolved.contract);

  return {
    ok: true,
    governance: governanceResolved.contract,
    contract: {
      schema: "point45_v1",
      familyKey: bound.binding.familyKey,
      sourceBinding: bound.binding,
      policy,
      outputPolicy: {
        reviewCandidateOnly: true,
        directPublishForbidden: true,
        qaAuthority: "point46",
        outputsAuthority: "point47",
      },
      upstreamAuthority: {
        photographyFamilies: "point42",
        benchmarkGovernance: "point43",
        mobileCapture: "point44",
      },
      downstreamAuthority: {
        qa: "point46",
        outputs: "point47",
      },
    },
  };
}

/** Fail-closed when provider output lacks provenance or preservation cannot be proven. */
export function validateEnhancementProviderOutput(
  contract: ExactProductEnhancementContract,
  output: EnhancementProviderOutput,
): EnhancementProvenanceValidation {
  const { provenance } = output;
  if (!provenance) {
    return {
      ok: false,
      error: "provenance_missing",
      message: "Provider output must include provenance metadata.",
    };
  }

  if (provenance.policySchema !== "point45_v1") {
    return {
      ok: false,
      error: "policy_schema_mismatch",
      message: `Expected policy schema point45_v1, received ${provenance.policySchema}.`,
    };
  }

  const { sourceBinding } = contract;

  if (provenance.sourceContentHash !== sourceBinding.contentHash) {
    return {
      ok: false,
      error: "source_hash_mismatch",
      message: "Provider output source hash does not match bound source media.",
    };
  }

  if (provenance.sourceMediaId !== sourceBinding.sourceMediaId) {
    return {
      ok: false,
      error: "source_media_mismatch",
      message: "Provider output source media id does not match bound source.",
    };
  }

  if (provenance.productId !== sourceBinding.productId) {
    return {
      ok: false,
      error: "product_mismatch",
      message: "Provider output product id does not match bound product.",
    };
  }

  if (provenance.readinessSlot !== sourceBinding.readinessSlot) {
    return {
      ok: false,
      error: "slot_mismatch",
      message: "Provider output readiness slot does not match bound slot.",
    };
  }

  const attestation = provenance.preservationAttestation;
  if (
    !attestation.packagingTextPreserved ||
    !attestation.productGeometryPreserved ||
    !attestation.pieceCountPreserved ||
    !attestation.logoArtworkPreserved ||
    !attestation.productColorPreserved
  ) {
    return {
      ok: false,
      error: "preservation_unproven",
      message: "Provider must attest all preservation requirements — enhancement rejected.",
    };
  }

  return { ok: true, provenance };
}

/**
 * Validate enhancement handoff — output remains pending_review; auto-approve and direct publish forbidden.
 * Does not persist media; persistence targets are governed separately by mediaAuthorityContract.
 */
export function validateEnhancementHandoff(
  contract: ExactProductEnhancementContract,
  output: EnhancementProviderOutput,
  handoff?: { attemptedStatus?: string; attemptedPublish?: boolean },
): EnhancementHandoffValidation {
  const provenanceCheck = validateEnhancementProviderOutput(contract, output);
  if (!provenanceCheck.ok) {
    return {
      ok: false,
      error: "provenance_invalid",
      message: provenanceCheck.message,
    };
  }

  if (handoff?.attemptedStatus === "approved") {
    return {
      ok: false,
      error: "auto_approve_forbidden",
      message: "Point 45 enhancement output cannot be auto-approved — Point 46 QA owns approval.",
    };
  }

  if (handoff?.attemptedPublish === true) {
    return {
      ok: false,
      error: "direct_publish_forbidden",
      message: "Enhanced media cannot be published directly — review candidate only until Point 46 QA.",
    };
  }

  return {
    ok: true,
    candidate: {
      status: "pending_review",
      contract,
      providerOutput: output,
    },
  };
}

/**
 * Mock provider execution for deterministic tests — no real image editing.
 * Returns a fixture candidate with provenance bound to the source hash.
 */
export function executeMockEnhancement(
  contract: ExactProductEnhancementContract,
  request: {
    operations: readonly EnhancementAllowedOperation[];
    instruction?: string;
  },
): EnhancementProviderOutput | { ok: false; error: string } {
  const invalidOp = request.operations.find(
    (op) => !contract.policy.allowedOperations.includes(op),
  );
  if (invalidOp) {
    return { ok: false, error: `Operation ${invalidOp} is not allowed by Point 45 policy.` };
  }

  if (request.instruction) {
    const instructionCheck = validateEnhancementOperatorInstruction(request.instruction, {
      productId: contract.sourceBinding.productId,
      category: contract.familyKey,
    });
    if (!instructionCheck.ok) {
      return { ok: false, error: instructionCheck.message };
    }
  }

  const { sourceBinding } = contract;
  const now = new Date(0).toISOString();

  return {
    candidateMediaRef: `mock://enhancement-candidate/${sourceBinding.sourceMediaId}`,
    provenance: {
      providerName: "mock_point45_provider",
      policySchema: "point45_v1",
      sourceContentHash: sourceBinding.contentHash,
      sourceMediaId: sourceBinding.sourceMediaId,
      productId: sourceBinding.productId,
      readinessSlot: sourceBinding.readinessSlot,
      requestedOperations: request.operations,
      preservationAttestation: {
        packagingTextPreserved: true,
        productGeometryPreserved: true,
        pieceCountPreserved: true,
        logoArtworkPreserved: true,
        productColorPreserved: true,
      },
      executedAt: now,
    },
  };
}

/** Programme census of enhancement/provider/source-binding surfaces (read-only evidence). */
export function buildExactProductEnhancementCensus(
  baselineSha: string,
  predecessorSha: string,
): ExactProductEnhancementCensus {
  return {
    schema: "point45_census_v1",
    baselineSha,
    predecessorSha,
    allowedOperationCount: ALLOWED_OPERATIONS.length,
    forbiddenOperationCount: FORBIDDEN_OPERATIONS.length,
    preservationRequirementCount: PRESERVATION_REQUIREMENTS.length,
    surfaces: {
      point42Families: "src/features/mediaReadiness/controlledPhotographyFamilies.ts",
      point43BenchmarkGovernance: "src/features/mediaReadiness/benchmarkPhotographyGovernance.ts",
      point44GuidedCapture: "src/features/mediaReadiness/guidedMobileCameraCapture.ts",
      catalogueContentGenerators:
        "src/features/catalogueAiStudio/catalogueContentGenerators.ts — IMAGE_PROMPT_BLOCK_META templates only; no provider calls",
      catalogueAiGateway:
        "src/features/catalogueAiStudio/catalogueAiGateway.ts — catalogue copy only; no image enhancement",
      catalogueProductStudio:
        "src/pages/CatalogueProductStudio.tsx — future AI connector placeholder; no live enhancement execution",
      productMediaUploader:
        "src/components/ProductMediaUploader.tsx — direct upload/persistence; no enhancement lane",
      productMediaPersistence:
        "src/features/productAuthority/productMediaPersistence.ts — writes product_media rows; no enhancement provenance gate yet",
      mediaAuthorityContract:
        "src/features/mediaReadiness/mediaAuthorityContract.ts — approved-only authority; enhancement candidates must stay pending",
      mediaLibraryPage:
        "src/pages/Media.tsx — placeholder 'Future AI: enhance' UI only; no provider adapter",
      dashboardPlaceholders: "src/pages/Dashboard.tsx — Photo Enhancement card placeholder only",
      catalogueMediaSlots: "src/features/catalogueAiStudio/catalogueMediaSlots.ts",
    },
    riskyPaths: [
      "ProductMediaUploader direct upload can persist media without Point 45 source-binding or provenance",
      "productMediaPersistence insertProductMediaRow has no enhancement provenance validation gate",
      "CatalogueProductStudio Media tab documents future generation/enhancement — no governed connector yet",
      "No provider adapter exists that enforces source-hash binding before accepting enhanced output",
      "mediaAuthorityContract.approved rows could be written if enhancement auto-approved — blocked by Point 45 outputPolicy",
      "catalogueContentGenerators IMAGE_PROMPT templates could be misused for generative fill if wired to an image provider without Point 45 policy",
    ],
    gaps: [
      "No live enhancement provider adapter — contract + mock execution only",
      "ProductMediaUploader has no enhancement entry point wired to Point 45 contract",
      "Catalogue Studio Media tab has no enhancement review-candidate UI",
      "product_media schema has no enhancement_provenance column — provenance carried in contract layer only",
      "Point 46 QA contract implemented in imageQaValidation.ts — persistence/UI integration still pending",
      "Point 47 derivative encoding not implemented — no resize/WebP pipeline",
    ],
    downstreamPoints: {
      point46: "Photography QA scoring/approval — separate",
      point47: "Photography output formats — separate",
    },
  };
}
