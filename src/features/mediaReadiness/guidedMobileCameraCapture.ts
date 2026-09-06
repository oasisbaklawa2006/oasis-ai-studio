/**
 * Point 44 — Guided mobile camera capture canonical contract.
 * Resolves Point 42 family + slot binding and presents Point 43 benchmark constraints
 * before accepting media. Fail-closed on unknown slot, denied camera capability, mismatched
 * capture target, or unresolved product identity. File-upload fallback is allowed only as an
 * explicit governed alternative — never a silent bypass. Preserves original pixels/metadata for
 * downstream fidelity/QA; does not generate, retouch, or approve images.
 */
import {
  type BenchmarkPhotographyGovernanceContract,
  benchmarkSlotRequirements,
  resolveBenchmarkPhotographyGovernance,
} from "./benchmarkPhotographyGovernance";
import {
  type ControlledPhotographyFamilyKey,
  mapUploaderTypeToReadinessSlot,
  resolveControlledPhotographyFamily,
} from "./controlledPhotographyFamilies";
import type { MediaAssetType, ProductMediaContext } from "./types";

export type CapturePermissionState = "granted" | "denied" | "prompt" | "unknown";

/** Injectable environment for deterministic capability/permission tests — no live browser required. */
export type CaptureEnvironment = {
  userAgent: string;
  viewportWidth: number;
  viewportHeight: number;
  isSecureContext: boolean;
  hasMediaDevices: boolean;
  hasGetUserMedia: boolean;
  permissionState?: CapturePermissionState;
};

export type CaptureCapabilityAssessment = {
  isMobileViewport: boolean;
  isMobileUserAgent: boolean;
  cameraApiAvailable: boolean;
  secureContext: boolean;
  /** Guided camera capture is the preferred path when true. */
  guidedCameraEligible: boolean;
};

export type CaptureViewportGuidance = {
  aspectRatio: "1:1" | "3:4" | "4:3" | "any";
  preferredOrientation: "portrait" | "landscape" | "any";
  cropHint: string;
  frameOccupancy: "low" | "medium" | "high";
};

export type CaptureSlotBinding = {
  uploaderType: string;
  readinessSlot: MediaAssetType;
  familyKey: ControlledPhotographyFamilyKey;
  slotLabel: string;
  requiredForCatalogue: boolean;
};

export type GuidedCaptureConstraint = {
  domain: string;
  rule: string;
};

export type GuidedCaptureGuidance = {
  slotLabel: string;
  readinessSlot: MediaAssetType;
  viewport: CaptureViewportGuidance;
  benchmarkConstraints: GuidedCaptureConstraint[];
  operatorChecklist: readonly string[];
};

export type CaptureFallbackPolicy = {
  /** Gallery/file picker allowed only when operator explicitly acknowledges fallback. */
  governedGalleryFallback: boolean;
  /** Desktop without camera API may use gallery without guided camera. */
  desktopGalleryWithoutAck: boolean;
  /** Silent bypass of guided capture is never permitted on mobile when camera is eligible. */
  silentBypassForbidden: true;
};

export type CaptureHandoffPolicy = {
  preserveOriginalPixels: true;
  preserveExifOrientation: true;
  /** Metadata carried forward for Point 46 QA — no mutation in this lane. */
  metadataForDownstreamQa: readonly string[];
};

export type GuidedMobileCaptureContract = {
  schema: "point44_v1";
  familyKey: ControlledPhotographyFamilyKey;
  binding: CaptureSlotBinding;
  guidance: GuidedCaptureGuidance;
  capability: CaptureCapabilityAssessment;
  permission: CapturePermissionState;
  fallbackPolicy: CaptureFallbackPolicy;
  handoffPolicy: CaptureHandoffPolicy;
  upstreamAuthority: {
    photographyFamilies: "point42";
    benchmarkGovernance: "point43";
  };
  downstreamAuthority: {
    enhancement: "point45";
    qa: "point46";
    outputs: "point47";
  };
};

export type GuidedMobileCaptureResolution =
  | {
      ok: true;
      contract: GuidedMobileCaptureContract;
      governance: BenchmarkPhotographyGovernanceContract;
    }
  | {
      ok: false;
      error:
        | "product_identity_unresolved"
        | "unknown_uploader_type"
        | "unknown_slot"
        | "family_resolution_failed"
        | "camera_capability_unsupported"
        | "camera_permission_denied"
        | "capture_target_mismatch";
      message: string;
    };

export type CaptureHandoffSource =
  | "guided_camera"
  | "governed_gallery_fallback"
  | "desktop_gallery";

export type CaptureHandoffValidation =
  | { ok: true; binding: CaptureSlotBinding; source: CaptureHandoffSource }
  | {
      ok: false;
      error:
        | "capture_target_mismatch"
        | "silent_fallback_forbidden"
        | "unsupported_media_type"
        | "invalid_handoff";
      message: string;
    };

export type GuidedMobileCaptureCensus = {
  schema: "point44_census_v1";
  baselineSha: string;
  predecessorSha: string;
  viewportGuidanceSlotCount: number;
  surfaces: {
    point42Families: string;
    point43BenchmarkGovernance: string;
    productMediaUploader: string;
    mediaLibraryPage: string;
    fastCreateHeroUpload: string;
    catalogueMediaSlots: string;
  };
  gaps: readonly string[];
  downstreamPoints: Record<string, string>;
};

const MOBILE_UA_PATTERN = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;

const IMAGE_MIME_PREFIX = "image/";

/** Viewport/crop guidance per readiness slot — software guidance only, not physical camera QA. */
export const CAPTURE_VIEWPORT_GUIDANCE: Partial<Record<MediaAssetType, CaptureViewportGuidance>> = {
  primary_image: {
    aspectRatio: "3:4",
    preferredOrientation: "portrait",
    cropHint: "Center the product; keep full product visible within frame margins",
    frameOccupancy: "high",
  },
  catalogue_image: {
    aspectRatio: "1:1",
    preferredOrientation: "any",
    cropHint: "Square 1:1 centred crop with product fully inside safe margins",
    frameOccupancy: "medium",
  },
  close_up_image: {
    aspectRatio: "4:3",
    preferredOrientation: "any",
    cropHint: "Macro texture detail — product identity must remain recognizable",
    frameOccupancy: "high",
  },
  pack_front_image: {
    aspectRatio: "3:4",
    preferredOrientation: "portrait",
    cropHint: "Closed pack front-facing and centred; all label text legible",
    frameOccupancy: "high",
  },
  open_pack_image: {
    aspectRatio: "4:3",
    preferredOrientation: "landscape",
    cropHint: "Open pack showing contents arrangement without clipping edges",
    frameOccupancy: "high",
  },
  label_front_image: {
    aspectRatio: "3:4",
    preferredOrientation: "portrait",
    cropHint: "Label front flat and legible — avoid glare on regulatory text",
    frameOccupancy: "high",
  },
  packaging_reference: {
    aspectRatio: "4:3",
    preferredOrientation: "any",
    cropHint: "Full retail pack reference — all export label fields visible",
    frameOccupancy: "medium",
  },
  master_carton_image: {
    aspectRatio: "4:3",
    preferredOrientation: "landscape",
    cropHint: "Master carton front with shipping marks and barcodes unmodified",
    frameOccupancy: "medium",
  },
  hamper_arrangement_image: {
    aspectRatio: "4:3",
    preferredOrientation: "landscape",
    cropHint: "Full hamper arrangement with contents visible; avoid clipping basket edge",
    frameOccupancy: "high",
  },
};

const DEFAULT_VIEWPORT: CaptureViewportGuidance = {
  aspectRatio: "any",
  preferredOrientation: "any",
  cropHint: "Center the product with clear visual hierarchy",
  frameOccupancy: "medium",
};

const OPERATOR_CHECKLIST_BASE: readonly string[] = [
  "Confirm the correct product and media slot before capturing",
  "Use soft even lighting — avoid colour casts that alter product appearance",
  "Do not add text overlays, watermarks, or promotional graphics",
  "Preserve all existing packaging and label text legibly",
];

const HANDOFF_METADATA_FIELDS: readonly string[] = [
  "originalFileName",
  "mimeType",
  "captureTimestamp",
  "uploaderType",
  "readinessSlot",
  "familyKey",
  "captureSource",
  "exifOrientation",
];

export function isMobileUserAgent(userAgent: string): boolean {
  return MOBILE_UA_PATTERN.test(userAgent);
}

export function isMobileViewport(width: number): boolean {
  return width < 768;
}

/** Deterministic capability assessment — inject CaptureEnvironment in tests. */
export function assessCaptureCapability(env: CaptureEnvironment): CaptureCapabilityAssessment {
  const isMobileUserAgentFlag = isMobileUserAgent(env.userAgent);
  const isMobileViewportFlag = isMobileViewport(env.viewportWidth);
  const cameraApiAvailable = env.isSecureContext && env.hasMediaDevices && env.hasGetUserMedia;
  const guidedCameraEligible =
    (isMobileUserAgentFlag || isMobileViewportFlag) && cameraApiAvailable;

  return {
    isMobileViewport: isMobileViewportFlag,
    isMobileUserAgent: isMobileUserAgentFlag,
    cameraApiAvailable,
    secureContext: env.isSecureContext,
    guidedCameraEligible,
  };
}

export function assessCapturePermission(env: CaptureEnvironment): CapturePermissionState {
  return env.permissionState ?? "unknown";
}

export function captureViewportGuidance(slot: MediaAssetType): CaptureViewportGuidance {
  return CAPTURE_VIEWPORT_GUIDANCE[slot] ?? DEFAULT_VIEWPORT;
}

function buildOperatorChecklist(
  viewport: CaptureViewportGuidance,
  benchmarkConstraints: GuidedCaptureConstraint[],
): readonly string[] {
  const slotSpecific: string[] = [];
  if (viewport.aspectRatio === "1:1") {
    slotSpecific.push("Frame a square 1:1 composition before capture");
  }
  if (viewport.preferredOrientation === "portrait") {
    slotSpecific.push("Hold the device upright (portrait) for this slot");
  }
  if (benchmarkConstraints.some((c) => c.domain === "packaging_text_preservation")) {
    slotSpecific.push("Ensure all label and packaging text stays sharp and unmodified");
  }
  return [...OPERATOR_CHECKLIST_BASE, ...slotSpecific];
}

function benchmarkConstraintsForSlot(
  familyKey: ControlledPhotographyFamilyKey,
  readinessSlot: MediaAssetType,
): GuidedCaptureConstraint[] {
  const overlay = benchmarkSlotRequirements(familyKey, readinessSlot);
  const constraints: GuidedCaptureConstraint[] = [];
  if (overlay?.composition) {
    constraints.push({ domain: "composition", rule: overlay.composition });
  }
  if (overlay?.lighting) {
    constraints.push({ domain: "lighting", rule: overlay.lighting });
  }
  if (overlay?.background) {
    constraints.push({ domain: "background", rule: overlay.background });
  }
  if (overlay?.cropOccupancy) {
    constraints.push({ domain: "crop_occupancy", rule: overlay.cropOccupancy });
  }
  if (overlay?.packagingText) {
    constraints.push({ domain: "packaging_text_preservation", rule: overlay.packagingText });
  }
  return constraints;
}

export function bindCaptureSlot(
  product: ProductMediaContext,
  uploaderType: string,
  targetReadinessSlot?: MediaAssetType,
):
  | { ok: true; binding: CaptureSlotBinding; familyKey: ControlledPhotographyFamilyKey }
  | {
      ok: false;
      error:
        | "unknown_uploader_type"
        | "unknown_slot"
        | "ambiguous_slot"
        | "family_resolution_failed";
      message: string;
    } {
  const normalized = uploaderType.trim().toLowerCase();

  const familyResolved = resolveControlledPhotographyFamily(product);
  if (!familyResolved.ok) {
    return {
      ok: false,
      error: "family_resolution_failed",
      message: familyResolved.message,
    };
  }

  const allSlots = [
    ...familyResolved.contract.requiredSlots,
    ...familyResolved.contract.optionalSlots,
  ];
  const matchingSlots = allSlots.filter((s) => s.uploaderTypes.includes(normalized));

  if (!matchingSlots.length) {
    const mapped = mapUploaderTypeToReadinessSlot(uploaderType);
    if (!mapped.ok) return mapped;
    return {
      ok: false,
      error: "unknown_slot",
      message: `Uploader type ${uploaderType} is not applicable to family ${familyResolved.profile}`,
    };
  }

  let slotContract = matchingSlots[0];
  if (matchingSlots.length > 1) {
    if (!targetReadinessSlot) {
      return {
        ok: false,
        error: "ambiguous_slot",
        message: `Uploader type ${uploaderType} maps to multiple slots for family ${familyResolved.profile} — specify target readiness slot.`,
      };
    }
    const explicit = matchingSlots.find((s) => s.readinessSlot === targetReadinessSlot);
    if (!explicit) {
      return {
        ok: false,
        error: "unknown_slot",
        message: `Readiness slot ${targetReadinessSlot} does not bind to uploader type ${uploaderType} for family ${familyResolved.profile}`,
      };
    }
    slotContract = explicit;
  }

  return {
    ok: true,
    familyKey: familyResolved.profile,
    binding: {
      uploaderType: normalized,
      readinessSlot: slotContract.readinessSlot,
      familyKey: familyResolved.profile,
      slotLabel: slotContract.label,
      requiredForCatalogue: slotContract.requiredForCatalogue,
    },
  };
}

export function buildCaptureGuidance(
  familyKey: ControlledPhotographyFamilyKey,
  binding: CaptureSlotBinding,
): GuidedCaptureGuidance {
  const viewport = captureViewportGuidance(binding.readinessSlot);
  const benchmarkConstraints = benchmarkConstraintsForSlot(familyKey, binding.readinessSlot);

  return {
    slotLabel: binding.slotLabel,
    readinessSlot: binding.readinessSlot,
    viewport,
    benchmarkConstraints,
    operatorChecklist: buildOperatorChecklist(viewport, benchmarkConstraints),
  };
}

export function defaultCaptureEnvironment(): CaptureEnvironment {
  if (typeof navigator === "undefined" || typeof window === "undefined") {
    return {
      userAgent: "",
      viewportWidth: 1440,
      viewportHeight: 900,
      isSecureContext: false,
      hasMediaDevices: false,
      hasGetUserMedia: false,
      permissionState: "unknown",
    };
  }

  const mediaDevices = navigator.mediaDevices;
  return {
    userAgent: navigator.userAgent,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    isSecureContext: window.isSecureContext,
    hasMediaDevices: !!mediaDevices,
    hasGetUserMedia: !!(mediaDevices && typeof mediaDevices.getUserMedia === "function"),
    permissionState: "unknown",
  };
}

/**
 * Resolve the full guided mobile capture contract for a product + uploader slot.
 * Fail-closed when product identity, family, slot binding, or camera permission blocks capture.
 */
export function resolveGuidedMobileCapture(
  product: ProductMediaContext,
  uploaderType: string,
  env: CaptureEnvironment = defaultCaptureEnvironment(),
  targetReadinessSlot?: MediaAssetType,
): GuidedMobileCaptureResolution {
  if (!product.productId?.trim()) {
    return {
      ok: false,
      error: "product_identity_unresolved",
      message: "Product identity is required before guided capture can bind a slot.",
    };
  }

  const bound = bindCaptureSlot(product, uploaderType, targetReadinessSlot);
  if (!bound.ok) {
    const error =
      bound.error === "family_resolution_failed"
        ? "family_resolution_failed"
        : bound.error === "ambiguous_slot"
          ? "unknown_slot"
          : bound.error;
    return {
      ok: false,
      error,
      message: bound.message,
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

  const capability = assessCaptureCapability(env);
  const permission = assessCapturePermission(env);

  if (capability.guidedCameraEligible && permission === "denied") {
    return {
      ok: false,
      error: "camera_permission_denied",
      message:
        "Camera permission denied — guided capture cannot proceed without permission or an explicit governed gallery fallback.",
    };
  }

  if (
    capability.guidedCameraEligible &&
    !capability.cameraApiAvailable &&
    capability.secureContext === false
  ) {
    return {
      ok: false,
      error: "camera_capability_unsupported",
      message: "Camera API unavailable outside a secure context.",
    };
  }

  const guidance = buildCaptureGuidance(bound.familyKey, bound.binding);

  return {
    ok: true,
    governance: governanceResolved.contract,
    contract: {
      schema: "point44_v1",
      familyKey: bound.familyKey,
      binding: bound.binding,
      guidance,
      capability,
      permission,
      fallbackPolicy: {
        governedGalleryFallback: true,
        desktopGalleryWithoutAck: true,
        silentBypassForbidden: true,
      },
      handoffPolicy: {
        preserveOriginalPixels: true,
        preserveExifOrientation: true,
        metadataForDownstreamQa: HANDOFF_METADATA_FIELDS,
      },
      upstreamAuthority: {
        photographyFamilies: "point42",
        benchmarkGovernance: "point43",
      },
      downstreamAuthority: {
        enhancement: "point45",
        qa: "point46",
        outputs: "point47",
      },
    },
  };
}

/** Fail-closed when the capture target uploader type does not match the bound slot. */
export function validateCaptureTargetMatch(
  expectedUploaderType: string,
  actualUploaderType: string,
): CaptureHandoffValidation | { ok: true } {
  const expected = expectedUploaderType.trim().toLowerCase();
  const actual = actualUploaderType.trim().toLowerCase();
  if (expected !== actual) {
    return {
      ok: false,
      error: "capture_target_mismatch",
      message: `Capture target mismatch: expected ${expected}, received ${actual}.`,
    };
  }
  return { ok: true };
}

/**
 * Validate media handoff before persistence — enforces slot binding, fallback policy, and image MIME.
 * Does not mutate or approve the file; preserves original bytes for downstream QA.
 */
export function validateCaptureHandoff(
  contract: GuidedMobileCaptureContract,
  handoff: {
    uploaderType: string;
    mimeType: string;
    source: CaptureHandoffSource;
    explicitFallbackAcknowledged?: boolean;
  },
): CaptureHandoffValidation {
  const targetMatch = validateCaptureTargetMatch(
    contract.binding.uploaderType,
    handoff.uploaderType,
  );
  if (!targetMatch.ok) return targetMatch;

  if (!handoff.mimeType.startsWith(IMAGE_MIME_PREFIX)) {
    return {
      ok: false,
      error: "unsupported_media_type",
      message: `Guided capture accepts image media only — received ${handoff.mimeType}.`,
    };
  }

  const { capability, fallbackPolicy } = contract;

  if (
    capability.guidedCameraEligible &&
    handoff.source !== "guided_camera" &&
    !handoff.explicitFallbackAcknowledged &&
    !(handoff.source === "desktop_gallery" && fallbackPolicy.desktopGalleryWithoutAck)
  ) {
    return {
      ok: false,
      error: "silent_fallback_forbidden",
      message:
        "Gallery/file-upload fallback requires explicit operator acknowledgement on mobile when guided camera is eligible.",
    };
  }

  if (handoff.source === "governed_gallery_fallback" && !fallbackPolicy.governedGalleryFallback) {
    return {
      ok: false,
      error: "invalid_handoff",
      message: "Governed gallery fallback is not permitted for this capture policy.",
    };
  }

  return {
    ok: true,
    binding: contract.binding,
    source: handoff.source,
  };
}

/** Programme census of mobile camera / file-upload surfaces (read-only evidence). */
export function buildGuidedMobileCaptureCensus(
  baselineSha: string,
  predecessorSha: string,
): GuidedMobileCaptureCensus {
  return {
    schema: "point44_census_v1",
    baselineSha,
    predecessorSha,
    viewportGuidanceSlotCount: Object.keys(CAPTURE_VIEWPORT_GUIDANCE).length,
    surfaces: {
      point42Families: "src/features/mediaReadiness/controlledPhotographyFamilies.ts",
      point43BenchmarkGovernance: "src/features/mediaReadiness/benchmarkPhotographyGovernance.ts",
      productMediaUploader:
        "src/components/ProductMediaUploader.tsx — gallery/camera/video inputs; capture=environment on camera; no slot-bound guided flow yet",
      mediaLibraryPage:
        "src/pages/Media.tsx — gallery/camera inputs; generic type selector; no family/slot binding",
      fastCreateHeroUpload:
        "src/pages/FastCreateProduct.tsx — generic image/* file picker only; no camera capture attribute",
      catalogueMediaSlots: "src/features/catalogueAiStudio/catalogueMediaSlots.ts",
    },
    gaps: [
      "ProductMediaUploader camera path uses generic capture=environment without Point 44 slot-bound guidance presentation",
      "Media library upload dialog has no product-family or benchmark constraint surfacing",
      "Fast Create hero upload has no guided mobile capture entry point",
      "Required-slot upload buttons in ProductMediaUploader use gallery file picker only (no camera guidance)",
      "No client-side EXIF orientation normalization in capture lane — original orientation preserved for Point 46 QA",
      "Desktop-only assumptions: camera and gallery buttons shown equally without capability gating",
    ],
    downstreamPoints: {
      point45: "Photo enhancement — separate",
      point46: "Photography QA scoring — separate",
      point47: "Photography output formats — separate",
    },
  };
}
