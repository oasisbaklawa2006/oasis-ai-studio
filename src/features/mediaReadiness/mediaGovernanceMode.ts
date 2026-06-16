import type { ProductMediaContext, ProductMediaProfile } from "./types";
import {
  MEDIA_UPLOADER_TO_READINESS,
  optionalProfileSlots,
  profileSlots,
  requiredProfileSlots,
  type ReadinessProfileSlot,
} from "@/features/productTruth/readinessProfiles";
import { detectProductMediaProfile } from "./mediaProfileDetection";

export type MediaGovernanceMode = "testing" | "pilot" | "production";

/** Uploader `product_media.type` values required per governance mode (non-production). */
export const GOVERNANCE_REQUIRED_UPLOADER_TYPES: Record<
  Exclude<MediaGovernanceMode, "production">,
  readonly string[]
> = {
  testing: ["hero_image"],
  pilot: ["hero_image", "white_background"],
};

/** Shown as recommended only — never block readiness in testing/pilot. */
export const RECOMMENDED_UPLOADER_TYPES = [
  "white_background",
  "square_image",
  "closeup",
  "detail_image",
  "lifestyle",
  "lifestyle_image",
  "side_angle",
  "top_angle",
  "45_angle",
  "hamper_open",
  "hamper_closed",
  "master_carton_image",
  "pack_front_image",
  "open_pack_image",
  "label_image",
  "raw_photo",
] as const;

export function getMediaGovernanceMode(): MediaGovernanceMode {
  const raw = String(import.meta.env.VITE_MEDIA_GOVERNANCE_MODE ?? "testing")
    .trim()
    .toLowerCase();
  if (raw === "pilot" || raw === "production") return raw;
  return "testing";
}

export function isProductionMediaGovernance(): boolean {
  return getMediaGovernanceMode() === "production";
}

export function governedRequiredUploaderTypes(
  mode: MediaGovernanceMode = getMediaGovernanceMode(),
): readonly string[] | null {
  if (mode === "production") return null;
  return GOVERNANCE_REQUIRED_UPLOADER_TYPES[mode];
}

function slotForUploader(uploaderType: string, profile: ProductMediaProfile): ReadinessProfileSlot | null {
  const slotType = MEDIA_UPLOADER_TO_READINESS[uploaderType];
  if (!slotType) return null;

  const fromProfile = profileSlots(profile).find((s) => s.type === slotType);
  if (fromProfile) return fromProfile;

  const heroFallback = profileSlots("general").find((s) => s.type === slotType);
  if (heroFallback) return heroFallback;

  return {
    type: slotType,
    label: uploaderType.replace(/_/g, " "),
    requiredForCatalogue: false,
    requiredForCentralSync: false,
    uploaderTypes: [uploaderType],
  };
}

function uniqueSlots(slots: ReadinessProfileSlot[]): ReadinessProfileSlot[] {
  const seen = new Set<string>();
  const out: ReadinessProfileSlot[] = [];
  for (const slot of slots) {
    if (seen.has(slot.type)) continue;
    seen.add(slot.type);
    out.push(slot);
  }
  return out;
}

/** Required readiness slots after applying VITE_MEDIA_GOVERNANCE_MODE. */
export function governedRequiredProfileSlots(
  product: ProductMediaContext,
  mode: MediaGovernanceMode = getMediaGovernanceMode(),
): ReadinessProfileSlot[] {
  const profile = detectProductMediaProfile(product);

  if (mode === "production") {
    return requiredProfileSlots(profile);
  }

  const governedUploaderTypes = GOVERNANCE_REQUIRED_UPLOADER_TYPES[mode];
  const slots = governedUploaderTypes
    .map((uploaderType) => slotForUploader(uploaderType, profile))
    .filter((slot): slot is ReadinessProfileSlot => !!slot)
    .map((slot) => ({
      ...slot,
      requiredForCatalogue: true,
      requiredForCentralSync: true,
    }));

  return uniqueSlots(slots);
}

/** Recommended slots — demoted profile requirements + catalogue extras (testing/pilot). */
export function governedRecommendedProfileSlots(
  product: ProductMediaContext,
  mode: MediaGovernanceMode = getMediaGovernanceMode(),
): ReadinessProfileSlot[] {
  const profile = detectProductMediaProfile(product);

  if (mode === "production") {
    return optionalProfileSlots(profile);
  }

  const requiredTypes = new Set(
    governedRequiredProfileSlots(product, mode).map((s) => s.type),
  );

  const demotedRequired = requiredProfileSlots(profile).filter(
    (slot) => !requiredTypes.has(slot.type),
  );

  const recommendedFromUploaders = RECOMMENDED_UPLOADER_TYPES.map((uploaderType) =>
    slotForUploader(uploaderType, profile),
  ).filter((slot): slot is ReadinessProfileSlot => !!slot);

  const optional = optionalProfileSlots(profile);

  return uniqueSlots(
    [...demotedRequired, ...recommendedFromUploaders, ...optional]
      .filter((slot) => !requiredTypes.has(slot.type))
      .map((slot) => ({
        ...slot,
        requiredForCatalogue: false,
        requiredForCentralSync: false,
      })),
  );
}

export function mediaGovernanceModeLabel(mode: MediaGovernanceMode = getMediaGovernanceMode()): string {
  switch (mode) {
    case "testing":
      return "Testing (hero only)";
    case "pilot":
      return "Pilot (hero + white background)";
    case "production":
      return "Production (category profile)";
    default:
      return mode;
  }
}
