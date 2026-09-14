/**
 * Thin adapter over the existing media-readiness authority (mediaReadinessEngine.ts /
 * mediaAuthorityContract.ts) for the Catalogue Studio Media tab. Deliberately does not
 * reimplement slot applicability, required-vs-optional classification, or approval rules — those
 * all live in evaluateMediaReadiness()/authoritativeMediaAssets(), already used elsewhere in this
 * app (Product Truth, ProductEdit). This module only shapes their output for display here.
 */

import {
  type BenchmarkGovernanceResolution,
  type BenchmarkPhotographyGovernanceContract,
  resolveBenchmarkPhotographyGovernance,
  validateBenchmarkOperatorInstruction,
} from "@/features/mediaReadiness/benchmarkPhotographyGovernance";
import {
  type ControlledPhotographyFamilyContract,
  type PhotographyFamilyResolution,
  resolveControlledPhotographyFamily,
} from "@/features/mediaReadiness/controlledPhotographyFamilies";
import {
  type ExactProductEnhancementContract,
  type ExactProductEnhancementResolution,
  resolveExactProductEnhancement,
  validateEnhancementHandoff,
  validateEnhancementOperatorInstruction,
  validateEnhancementProviderOutput,
} from "@/features/mediaReadiness/exactProductEnhancement";
import {
  type ApprovedQaSourceBinding,
  type DerivativeOutputContract,
  type DerivativeOutputResolution,
  type DerivativeTransformOutput,
  executeMockDerivativeTransform,
  resolveDerivativeOutputContract,
  validateDerivativePersistenceHandoff,
  validateDerivativeTransformOutput,
} from "@/features/mediaReadiness/derivativeOutputContract";
import {
  type ImageQaCandidate,
  type ImageQaValidationContract,
  type ImageQaValidationResolution,
  type QaAuditRecord,
  evaluateQaReadiness,
  recordQaDisposition,
  resolveImageQaValidation,
  runAutomatedQaChecks,
} from "@/features/mediaReadiness/imageQaValidation";
import {
  type GuidedMobileCaptureContract,
  type GuidedMobileCaptureResolution,
  resolveGuidedMobileCapture,
  validateCaptureHandoff,
} from "@/features/mediaReadiness/guidedMobileCameraCapture";
import type { ProductMediaRow } from "@/features/mediaReadiness/mediaAssetsFromForm";
import { authoritativeMediaAssets } from "@/features/mediaReadiness/mediaAuthorityContract";
import { evaluateMediaReadiness } from "@/features/mediaReadiness/mediaReadinessEngine";
import type { MediaAssetType, ProductMediaContext } from "@/features/mediaReadiness/types";

export type CatalogueMediaSlotStatus = "satisfied" | "missing" | "not_applicable";

export interface CatalogueMediaSlot {
  type: string;
  label: string;
  status: CatalogueMediaSlotStatus;
}

/**
 * Missing required media slots always deep-link to this literal path — not through
 * catalogueStudioNavigation.ts's category-based fullEditorDeepLink(), which resolves to different
 * Full Editor sections per readiness category. Media has exactly one owner section regardless of
 * slot type, so the link is fixed.
 */
export function catalogueMediaTabDeepLink(productId: string): string {
  return `/products/${productId}?tab=media`;
}

/**
 * Required media slots for this product, with satisfied/missing status from the same approved-
 * media authority evaluateMediaReadiness() already uses (pending/draft/rejected rows never count
 * as satisfied — see buildSlot()'s `approved` check in mediaReadinessEngine.ts). "not_applicable"
 * is intentionally never emitted here: evaluateMediaReadiness()'s required-slot list already IS
 * the applicable set for this product's detected media profile — nothing outside it is surfaced.
 *
 * legacyHeroForm is passed straight through to authoritativeMediaAssets()'s own fallback (Bugbot-
 * caught: without it, a product with an approved legacy hero_image_url/media_status but zero
 * product_media rows showed "Hero present" in the anchor/media preview and "Missing" here, since
 * both read the same empty product_media fetch with no path to reconcile them).
 */
/** Point 42 family contract for the Catalogue Studio Media tab — fail-closed on unknown families. */
export function cataloguePhotographyFamily(
  product: ProductMediaContext,
): PhotographyFamilyResolution {
  return resolveControlledPhotographyFamily(product);
}

export type CataloguePhotographyFamilyView = {
  family: ControlledPhotographyFamilyContract | null;
  resolutionError: string | null;
};

/** Human-readable family label + contract when resolution succeeds; null family when fail-closed. */
export function cataloguePhotographyFamilyView(
  product: ProductMediaContext,
): CataloguePhotographyFamilyView {
  const resolved = resolveControlledPhotographyFamily(product);
  if (!resolved.ok) {
    return { family: null, resolutionError: resolved.message };
  }
  return { family: resolved.contract, resolutionError: null };
}

export function catalogueRequiredMediaSlots(
  product: ProductMediaContext,
  mediaRows: ProductMediaRow[],
  legacyHeroForm?: Record<string, unknown>,
): CatalogueMediaSlot[] {
  const assets = authoritativeMediaAssets(mediaRows, legacyHeroForm);
  const readiness = evaluateMediaReadiness(product, assets);
  return readiness.slots
    .filter((slot) => slot.required)
    .map((slot) => ({
      type: slot.type,
      label: slot.label,
      status: slot.present && slot.approved ? "satisfied" : "missing",
    }));
}

/** Point 43 benchmark governance contract — fail-closed via Point 42 family chain. */
export function catalogueBenchmarkGovernance(
  product: ProductMediaContext,
): BenchmarkGovernanceResolution {
  return resolveBenchmarkPhotographyGovernance(product);
}

export type CatalogueBenchmarkGovernanceView = {
  governance: BenchmarkPhotographyGovernanceContract | null;
  family: ControlledPhotographyFamilyContract | null;
  resolutionError: string | null;
};

/** Human-readable benchmark governance view for Catalogue Studio Media tab. */
export function catalogueBenchmarkGovernanceView(
  product: ProductMediaContext,
): CatalogueBenchmarkGovernanceView {
  const resolved = resolveBenchmarkPhotographyGovernance(product);
  if (!resolved.ok) {
    return { governance: null, family: null, resolutionError: resolved.message };
  }
  return {
    governance: resolved.contract,
    family: resolved.familyContract,
    resolutionError: null,
  };
}

/** Validate operator image-prompt instruction against Point 43 benchmark governance — fail-closed. */
export function catalogueValidateImagePromptInstruction(
  instruction: string,
  product: ProductMediaContext,
): ReturnType<typeof validateBenchmarkOperatorInstruction> {
  const resolved = resolveBenchmarkPhotographyGovernance(product);
  const familyKey = resolved.ok ? resolved.contract.familyKey : undefined;
  return validateBenchmarkOperatorInstruction(instruction, { familyKey });
}

/** Point 44 guided mobile capture contract — fail-closed via Point 42/43 chain + slot binding. */
export function catalogueGuidedMobileCapture(
  product: ProductMediaContext,
  uploaderType: string,
  targetReadinessSlot?: MediaAssetType,
): GuidedMobileCaptureResolution {
  return resolveGuidedMobileCapture(product, uploaderType, undefined, targetReadinessSlot);
}

export type CatalogueGuidedCaptureView = {
  contract: GuidedMobileCaptureContract | null;
  resolutionError: string | null;
};

/** Human-readable guided capture view for Catalogue Studio Media tab. */
export function catalogueGuidedCaptureView(
  product: ProductMediaContext,
  uploaderType: string,
  targetReadinessSlot?: MediaAssetType,
): CatalogueGuidedCaptureView {
  const resolved = resolveGuidedMobileCapture(
    product,
    uploaderType,
    undefined,
    targetReadinessSlot,
  );
  if (!resolved.ok) {
    return { contract: null, resolutionError: resolved.message };
  }
  return { contract: resolved.contract, resolutionError: null };
}

/** Validate capture handoff before media persistence — Point 44 fail-closed policy. */
export function catalogueValidateCaptureHandoff(
  contract: GuidedMobileCaptureContract,
  handoff: {
    uploaderType: string;
    mimeType: string;
    source: "guided_camera" | "governed_gallery_fallback" | "desktop_gallery";
    explicitFallbackAcknowledged?: boolean;
  },
): ReturnType<typeof validateCaptureHandoff> {
  return validateCaptureHandoff(contract, handoff);
}

/** Point 45 exact-product enhancement contract — fail-closed via Point 42/43/44 chain + source binding. */
export function catalogueExactProductEnhancement(
  product: ProductMediaContext,
  source: {
    sourceMediaId: string;
    contentHash: string;
    uploaderType: string;
    targetReadinessSlot?: MediaAssetType;
  },
): ExactProductEnhancementResolution {
  return resolveExactProductEnhancement(product, source);
}

export type CatalogueExactProductEnhancementView = {
  contract: ExactProductEnhancementContract | null;
  resolutionError: string | null;
};

/** Human-readable exact-product enhancement view for Catalogue Studio Media tab. */
export function catalogueExactProductEnhancementView(
  product: ProductMediaContext,
  source: {
    sourceMediaId: string;
    contentHash: string;
    uploaderType: string;
    targetReadinessSlot?: MediaAssetType;
  },
): CatalogueExactProductEnhancementView {
  const resolved = resolveExactProductEnhancement(product, source);
  if (!resolved.ok) {
    return { contract: null, resolutionError: resolved.message };
  }
  return { contract: resolved.contract, resolutionError: null };
}

/** Validate operator enhancement instruction against Point 45 policy — fail-closed. */
export function catalogueValidateEnhancementInstruction(
  instruction: string,
  product: ProductMediaContext,
): ReturnType<typeof validateEnhancementOperatorInstruction> {
  return validateEnhancementOperatorInstruction(instruction, product);
}

/** Validate enhancement provider output provenance — Point 45 fail-closed policy. */
export function catalogueValidateEnhancementProvenance(
  contract: ExactProductEnhancementContract,
  output: Parameters<typeof validateEnhancementProviderOutput>[1],
): ReturnType<typeof validateEnhancementProviderOutput> {
  return validateEnhancementProviderOutput(contract, output);
}

/** Validate enhancement handoff — output remains pending_review for Point 46 QA. */
export function catalogueValidateEnhancementHandoff(
  contract: ExactProductEnhancementContract,
  output: Parameters<typeof validateEnhancementHandoff>[1],
  handoff?: Parameters<typeof validateEnhancementHandoff>[2],
): ReturnType<typeof validateEnhancementHandoff> {
  return validateEnhancementHandoff(contract, output, handoff);
}

/** Point 46 image QA validation contract — fail-closed via Point 42/43/44/45 chain. */
export function catalogueImageQaValidation(
  product: ProductMediaContext,
  candidate: Omit<ImageQaCandidate, "familyKey"> & { familyKey?: ImageQaCandidate["familyKey"] },
): ImageQaValidationResolution {
  return resolveImageQaValidation(product, candidate);
}

export type CatalogueImageQaView = {
  contract: ImageQaValidationContract | null;
  resolutionError: string | null;
};

/** Human-readable image QA view for Catalogue Studio Media tab. */
export function catalogueImageQaView(
  product: ProductMediaContext,
  candidate: Omit<ImageQaCandidate, "familyKey"> & { familyKey?: ImageQaCandidate["familyKey"] },
): CatalogueImageQaView {
  const resolved = resolveImageQaValidation(product, candidate);
  if (!resolved.ok) {
    return { contract: null, resolutionError: resolved.message };
  }
  return { contract: resolved.contract, resolutionError: null };
}

/** Run automated QA checks through adapter — evidence/scores only, no auto-approve. */
export function catalogueRunAutomatedQaChecks(
  contract: ImageQaValidationContract,
): ReturnType<typeof runAutomatedQaChecks> {
  return runAutomatedQaChecks(contract);
}

/** Evaluate QA readiness — ready for human review when all mandatory checks pass. */
export function catalogueEvaluateQaReadiness(
  checks: Parameters<typeof evaluateQaReadiness>[0],
): ReturnType<typeof evaluateQaReadiness> {
  return evaluateQaReadiness(checks);
}

/** Record governed QA disposition with audit — fail-closed on auto-approve and unauthorized reviewer. */
export function catalogueRecordQaDisposition(
  contract: ImageQaValidationContract,
  checks: Parameters<typeof recordQaDisposition>[1],
  request: Parameters<typeof recordQaDisposition>[2],
): ReturnType<typeof recordQaDisposition> {
  return recordQaDisposition(contract, checks, request);
}

/** Point 47 derivative output contract — requires approved Point 46 QA source. */
export function catalogueDerivativeOutput(
  product: ProductMediaContext,
  approvedSource: Omit<ApprovedQaSourceBinding, "qaAuditRef">,
  qaAudit: QaAuditRecord,
  profileId: string,
): DerivativeOutputResolution {
  return resolveDerivativeOutputContract(product, approvedSource, qaAudit, profileId);
}

export type CatalogueDerivativeOutputView = {
  contract: DerivativeOutputContract | null;
  resolutionError: string | null;
};

/** Human-readable derivative output view for Catalogue Studio Media tab. */
export function catalogueDerivativeOutputView(
  product: ProductMediaContext,
  approvedSource: Omit<ApprovedQaSourceBinding, "qaAuditRef">,
  qaAudit: QaAuditRecord,
  profileId: string,
): CatalogueDerivativeOutputView {
  const resolved = resolveDerivativeOutputContract(product, approvedSource, qaAudit, profileId);
  if (!resolved.ok) {
    return { contract: null, resolutionError: resolved.message };
  }
  return { contract: resolved.contract, resolutionError: null };
}

/** Execute mock derivative transform through adapter — fixtures/local transforms only. */
export function catalogueExecuteMockDerivativeTransform(
  contract: DerivativeOutputContract,
  sourceMetadata?: Parameters<typeof executeMockDerivativeTransform>[1],
): ReturnType<typeof executeMockDerivativeTransform> {
  return executeMockDerivativeTransform(contract, sourceMetadata);
}

/** Validate derivative transform provenance through adapter. */
export function catalogueValidateDerivativeTransformOutput(
  contract: DerivativeOutputContract,
  output: DerivativeTransformOutput,
): ReturnType<typeof validateDerivativeTransformOutput> {
  return validateDerivativeTransformOutput(contract, output);
}

/** Validate derivative persistence handoff — no success without canonical persistence result. */
export function catalogueValidateDerivativePersistenceHandoff(
  contract: DerivativeOutputContract,
  output: DerivativeTransformOutput,
  handoff: Parameters<typeof validateDerivativePersistenceHandoff>[2],
): ReturnType<typeof validateDerivativePersistenceHandoff> {
  return validateDerivativePersistenceHandoff(contract, output, handoff);
}
