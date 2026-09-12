/**
 * Point 42 — Controlled photography families canonical contract.
 * Single deterministic source for family → required media slots → uploader types → SOP prompt keys.
 * Derives slot requirements from existing readinessProfiles authority — no parallel taxonomy.
 * Fail-closed on unknown family keys or unmapped uploader types. No image generation here.
 */
import type { CatalogueDraftPromptKey } from "@/features/catalogueAiStudio/catalogueDraftTypes";
import {
  MEDIA_UPLOADER_TO_READINESS,
  optionalProfileSlots,
  type ReadinessProfileSlot,
  requiredProfileSlots,
} from "@/features/productTruth/readinessProfiles";
import {
  getMediaGovernanceMode,
  governedRequiredProfileSlots,
  type MediaGovernanceMode,
} from "./mediaGovernanceMode";
import { detectProductMediaProfile } from "./mediaProfileDetection";
import type { MediaAssetType, ProductMediaContext, ProductMediaProfile } from "./types";

/** Canonical controlled photography family keys — 1:1 with ProductMediaProfile detection. */
export const CONTROLLED_PHOTOGRAPHY_FAMILY_KEYS = [
  "baklawa_small_sweets",
  "gift_box",
  "export_pack",
  "hamper",
  "general",
] as const;

export type ControlledPhotographyFamilyKey = (typeof CONTROLLED_PHOTOGRAPHY_FAMILY_KEYS)[number];

export type PhotographyFamilyResolutionError =
  | "unknown_family"
  | "unknown_uploader_type"
  | "requirements_unresolved";

export type PhotographyFamilySlotContract = {
  readinessSlot: MediaAssetType;
  label: string;
  uploaderTypes: readonly string[];
  requiredForCatalogue: boolean;
  requiredForCentralSync: boolean;
  /** Governed local SOP prompt key when a per-slot template exists — never generates images. */
  sopPromptKey: CatalogueDraftPromptKey | null;
};

export type ControlledPhotographyFamilyContract = {
  schema: "point42_v1";
  familyKey: ControlledPhotographyFamilyKey;
  label: string;
  detectionSignals: readonly string[];
  requiredSlots: PhotographyFamilySlotContract[];
  optionalSlots: PhotographyFamilySlotContract[];
  /** Downstream programme boundaries — not implemented in Point 42. */
  downstreamAuthority: {
    bateelGovernance: "point43";
    mobileCamera: "point44";
    enhancement: "point45";
    qa: "point46";
    outputs: "point47";
  };
};

export type PhotographyFamilyResolution =
  | { ok: true; contract: ControlledPhotographyFamilyContract; profile: ProductMediaProfile }
  | { ok: false; error: PhotographyFamilyResolutionError; message: string };

export type PhotographyFamilyRequirements = {
  familyKey: ControlledPhotographyFamilyKey;
  governanceMode: MediaGovernanceMode;
  requiredSlots: PhotographyFamilySlotContract[];
  optionalSlots: PhotographyFamilySlotContract[];
};

export type PhotographyFamilyCensus = {
  schema: "point42_census_v1";
  baselineSha: string;
  families: ControlledPhotographyFamilyKey[];
  surfaces: {
    profileDetection: string;
    readinessProfiles: string;
    uploaderToReadiness: string;
    mediaGovernanceMode: string;
    mediaReadinessEngine: string;
    mediaAuthorityContract: string;
    productMediaRoles: string;
    productMediaUploader: string;
    catalogueMediaSlots: string;
    catalogueMediaSummary: string;
    catalogueImagePrompts: string;
    mediaCompleteness: string;
  };
  bateelOverlap: string;
  downstreamPoints: Record<string, string>;
};

const FAMILY_LABELS: Record<ControlledPhotographyFamilyKey, string> = {
  baklawa_small_sweets: "Baklawa / small sweets",
  gift_box: "Gift box / ready pack",
  export_pack: "Export pack",
  hamper: "Gift hamper",
  general: "General product",
};

const FAMILY_DETECTION_SIGNALS: Record<ControlledPhotographyFamilyKey, readonly string[]> = {
  hamper: [
    "productClass contains gift_hamper",
    "category contains hamper",
    "productType contains hamper",
  ],
  export_pack: [
    "productClass contains export",
    "category contains export",
    "productType contains export",
  ],
  gift_box: [
    "productClass contains gift or ready_pack",
    "subcategory contains box or acrylic",
    "productType contains box or pack",
  ],
  baklawa_small_sweets: [
    "category contains baklawa",
    "subcategory contains pyramid, roll, or baklawa",
    "productType contains baklawa",
  ],
  general: ["Default when no higher-priority family signal matches"],
};

/** Readiness slot → governed catalogue image-prompt SOP key (local text templates only). */
const READINESS_SLOT_TO_SOP_PROMPT: Partial<
  Record<MediaAssetType, CatalogueDraftPromptKey | null>
> = {
  primary_image: "hero_image_prompt",
  catalogue_image: "square_image_prompt",
  close_up_image: "closeup_image_prompt",
  pack_front_image: "packaging_image_prompt",
  open_pack_image: "packaging_image_prompt",
  label_front_image: "packaging_image_prompt",
  label_back_image: "packaging_image_prompt",
  packaging_reference: "packaging_image_prompt",
  master_carton_image: "packaging_image_prompt",
  export_pack_image: "packaging_image_prompt",
  hamper_arrangement_image: "lifestyle_image_prompt",
  pairing_image: "lifestyle_image_prompt",
  lifestyle_variant: "lifestyle_image_prompt",
  lifestyle_image: "lifestyle_image_prompt",
  secondary_angle: null,
  secondary_image: null,
  source_reference: null,
  transparent_cutout: null,
  pack_back_image: null,
};

export function isControlledPhotographyFamilyKey(
  key: string,
): key is ControlledPhotographyFamilyKey {
  return (CONTROLLED_PHOTOGRAPHY_FAMILY_KEYS as readonly string[]).includes(key);
}

function slotToContract(slot: ReadinessProfileSlot): PhotographyFamilySlotContract {
  return {
    readinessSlot: slot.type,
    label: slot.label,
    uploaderTypes: slot.uploaderTypes,
    requiredForCatalogue: slot.requiredForCatalogue,
    requiredForCentralSync: slot.requiredForCentralSync,
    sopPromptKey: READINESS_SLOT_TO_SOP_PROMPT[slot.type] ?? null,
  };
}

export function buildControlledPhotographyFamilyContract(
  familyKey: ControlledPhotographyFamilyKey,
): ControlledPhotographyFamilyContract {
  return {
    schema: "point42_v1",
    familyKey,
    label: FAMILY_LABELS[familyKey],
    detectionSignals: FAMILY_DETECTION_SIGNALS[familyKey],
    requiredSlots: requiredProfileSlots(familyKey).map(slotToContract),
    optionalSlots: optionalProfileSlots(familyKey).map(slotToContract),
    downstreamAuthority: {
      bateelGovernance: "point43",
      mobileCamera: "point44",
      enhancement: "point45",
      qa: "point46",
      outputs: "point47",
    },
  };
}

/** Fail-closed family resolution from product category signals. */
export function resolveControlledPhotographyFamily(
  product: ProductMediaContext,
): PhotographyFamilyResolution {
  const profile = detectProductMediaProfile(product);
  if (!isControlledPhotographyFamilyKey(profile)) {
    return {
      ok: false,
      error: "unknown_family",
      message: `Unknown controlled photography family profile: ${profile}`,
    };
  }
  return {
    ok: true,
    contract: buildControlledPhotographyFamilyContract(profile),
    profile,
  };
}

/** Fail-closed when an explicit family key is not in the canonical registry. */
export function requireControlledPhotographyFamilyKey(key: string): ControlledPhotographyFamilyKey {
  if (!isControlledPhotographyFamilyKey(key)) {
    throw new Error(`Unknown controlled photography family: ${key}`);
  }
  return key;
}

/** Map uploader `product_media.type` to readiness slot — fail-closed when unmapped. */
export function mapUploaderTypeToReadinessSlot(
  uploaderType: string,
):
  | { ok: true; slot: MediaAssetType }
  | { ok: false; error: "unknown_uploader_type"; message: string } {
  const normalized = uploaderType.trim().toLowerCase();
  const mapped = MEDIA_UPLOADER_TO_READINESS[normalized];
  if (!mapped) {
    return {
      ok: false,
      error: "unknown_uploader_type",
      message: `Unknown uploader type for controlled photography mapping: ${uploaderType}`,
    };
  }
  return { ok: true, slot: mapped };
}

/**
 * Deterministic required/optional slots after applying VITE_MEDIA_GOVERNANCE_MODE.
 * Production mode uses full profile requirements; testing/pilot use governed subsets.
 */
export function getPhotographyFamilyRequirements(
  product: ProductMediaContext,
  mode: MediaGovernanceMode = getMediaGovernanceMode(),
):
  | PhotographyFamilyRequirements
  | { ok: false; error: PhotographyFamilyResolutionError; message: string } {
  const resolved = resolveControlledPhotographyFamily(product);
  if (!resolved.ok) return resolved;

  const requiredRaw =
    mode === "production"
      ? requiredProfileSlots(resolved.profile)
      : governedRequiredProfileSlots(product, mode);

  if (!requiredRaw.length && mode === "production") {
    return {
      ok: false,
      error: "requirements_unresolved",
      message: `No required photography slots resolved for family ${resolved.profile} in ${mode} mode`,
    };
  }

  const requiredTypes = new Set(requiredRaw.map((s) => s.type));
  const optionalRaw =
    mode === "production"
      ? optionalProfileSlots(resolved.profile)
      : optionalProfileSlots(resolved.profile).filter((s) => !requiredTypes.has(s.type));

  return {
    familyKey: resolved.profile,
    governanceMode: mode,
    requiredSlots: requiredRaw.map(slotToContract),
    optionalSlots: optionalRaw.map(slotToContract),
  };
}

/** Programme census of photography family / taxonomy / template / SOP surfaces (read-only evidence). */
export function buildPhotographyFamilyCensus(baselineSha: string): PhotographyFamilyCensus {
  return {
    schema: "point42_census_v1",
    baselineSha,
    families: [...CONTROLLED_PHOTOGRAPHY_FAMILY_KEYS],
    surfaces: {
      profileDetection: "src/features/mediaReadiness/mediaProfileDetection.ts",
      readinessProfiles: "src/features/productTruth/readinessProfiles.ts",
      uploaderToReadiness:
        "src/features/productTruth/readinessProfiles.ts (MEDIA_UPLOADER_TO_READINESS)",
      mediaGovernanceMode: "src/features/mediaReadiness/mediaGovernanceMode.ts",
      mediaReadinessEngine: "src/features/mediaReadiness/mediaReadinessEngine.ts",
      mediaAuthorityContract: "src/features/mediaReadiness/mediaAuthorityContract.ts",
      productMediaRoles: "src/lib/productImage.ts (PRODUCT_MEDIA_ROLES)",
      productMediaUploader: "src/components/ProductMediaUploader.tsx",
      catalogueMediaSlots: "src/features/catalogueAiStudio/catalogueMediaSlots.ts",
      catalogueMediaSummary: "src/features/catalogueAiStudio/catalogueMediaSummary.ts",
      catalogueImagePrompts:
        "src/features/catalogueAiStudio/catalogueContentGenerators.ts (IMAGE_PROMPT_BLOCK_META)",
      mediaCompleteness: "src/features/mediaReadiness/mediaCompleteness.ts",
    },
    bateelOverlap:
      "CSS luxury catalogue styling in src/index.css — no photo-governance overlap; Point 43 owns benchmark photography governance",
    downstreamPoints: {
      point43: "src/features/mediaReadiness/benchmarkPhotographyGovernance.ts",
      point44: "Mobile camera capture — separate",
      point45: "Photo enhancement — separate",
      point46: "Photography QA — separate",
      point47: "Photography outputs — separate",
    },
  };
}
