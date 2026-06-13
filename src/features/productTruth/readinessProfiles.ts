import type { MediaAssetType, ProductMediaProfile } from "@/features/mediaReadiness/types";

export type ReadinessProfileSlot = {
  type: MediaAssetType;
  label: string;
  requiredForCatalogue: boolean;
  requiredForCentralSync: boolean;
  /** Uploader `product_media.type` values that satisfy this slot. */
  uploaderTypes: string[];
};

export type ReadinessProfileConfig = {
  required: ReadinessProfileSlot[];
  optional: ReadinessProfileSlot[];
};

/**
 * Authoritative uploader type → readiness slot mapping.
 * Single source for mediaAssetsFromForm and readiness evaluation.
 */
export const MEDIA_UPLOADER_TO_READINESS: Record<string, MediaAssetType> = {
  hero_image: "primary_image",
  white_background: "catalogue_image",
  square_image: "catalogue_image",
  closeup: "close_up_image",
  detail_image: "close_up_image",
  lifestyle: "lifestyle_image",
  lifestyle_image: "lifestyle_image",
  side_angle: "secondary_angle",
  top_angle: "secondary_angle",
  "45_angle": "secondary_angle",
  hamper_open: "lifestyle_variant",
  hamper_closed: "lifestyle_variant",
  label_image: "packaging_reference",
  source_pdf_page: "source_reference",
  raw_photo: "secondary_image",
  pack_front_image: "pack_front_image",
  open_pack_image: "open_pack_image",
  label_front_image: "label_front_image",
  label_back_image: "label_back_image",
  master_carton_image: "master_carton_image",
  hamper_arrangement_image: "hamper_arrangement_image",
  pairing_image: "pairing_image",
  export_pack_image: "export_pack_image",
};

export const READINESS_PROFILES: Record<ProductMediaProfile, ReadinessProfileConfig> = {
  baklawa_small_sweets: {
    required: [
      {
        type: "primary_image",
        label: "Hero image",
        requiredForCatalogue: true,
        requiredForCentralSync: true,
        uploaderTypes: ["hero_image"],
      },
      {
        type: "catalogue_image",
        label: "White background",
        requiredForCatalogue: true,
        requiredForCentralSync: true,
        uploaderTypes: ["white_background", "square_image"],
      },
      {
        type: "close_up_image",
        label: "Close-up",
        requiredForCatalogue: true,
        requiredForCentralSync: true,
        uploaderTypes: ["closeup", "detail_image"],
      },
    ],
    optional: [
      {
        type: "lifestyle_image",
        label: "Lifestyle",
        requiredForCatalogue: false,
        requiredForCentralSync: false,
        uploaderTypes: ["lifestyle", "lifestyle_image"],
      },
      {
        type: "secondary_angle",
        label: "Angle shot",
        requiredForCatalogue: false,
        requiredForCentralSync: false,
        uploaderTypes: ["side_angle", "top_angle", "45_angle"],
      },
    ],
  },
  gift_box: {
    required: [
      {
        type: "pack_front_image",
        label: "Closed pack (front)",
        requiredForCatalogue: true,
        requiredForCentralSync: true,
        uploaderTypes: ["hamper_closed"],
      },
      {
        type: "open_pack_image",
        label: "Open pack",
        requiredForCatalogue: true,
        requiredForCentralSync: true,
        uploaderTypes: ["hamper_open"],
      },
      {
        type: "primary_image",
        label: "Primary image",
        requiredForCatalogue: true,
        requiredForCentralSync: true,
        uploaderTypes: ["hero_image"],
      },
    ],
    optional: [],
  },
  export_pack: {
    required: [
      {
        type: "label_front_image",
        label: "Front label",
        requiredForCatalogue: true,
        requiredForCentralSync: true,
        uploaderTypes: ["label_image"],
      },
      {
        type: "packaging_reference",
        label: "Packaging reference",
        requiredForCatalogue: true,
        requiredForCentralSync: true,
        uploaderTypes: ["label_image"],
      },
      {
        type: "master_carton_image",
        label: "Master carton",
        requiredForCatalogue: true,
        requiredForCentralSync: true,
        uploaderTypes: ["master_carton_image"],
      },
    ],
    optional: [],
  },
  hamper: {
    required: [
      {
        type: "hamper_arrangement_image",
        label: "Full arrangement",
        requiredForCatalogue: true,
        requiredForCentralSync: true,
        uploaderTypes: ["hamper_open", "hamper_closed"],
      },
      {
        type: "close_up_image",
        label: "Close-up",
        requiredForCatalogue: true,
        requiredForCentralSync: true,
        uploaderTypes: ["closeup"],
      },
      {
        type: "primary_image",
        label: "Pack / hero image",
        requiredForCatalogue: true,
        requiredForCentralSync: true,
        uploaderTypes: ["hero_image"],
      },
    ],
    optional: [],
  },
  general: {
    required: [
      {
        type: "primary_image",
        label: "Primary image",
        requiredForCatalogue: true,
        requiredForCentralSync: true,
        uploaderTypes: ["hero_image"],
      },
    ],
    optional: [],
  },
};

export function profileSlots(profile: ProductMediaProfile): ReadinessProfileSlot[] {
  const config = READINESS_PROFILES[profile];
  return [...config.required, ...config.optional];
}

export function requiredProfileSlots(profile: ProductMediaProfile): ReadinessProfileSlot[] {
  return READINESS_PROFILES[profile].required;
}

export function optionalProfileSlots(profile: ProductMediaProfile): ReadinessProfileSlot[] {
  return READINESS_PROFILES[profile].optional;
}
