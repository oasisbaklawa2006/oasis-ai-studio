export const MEDIA_ASSET_TYPES = [
  "primary_image",
  "secondary_image",
  "transparent_cutout",
  "pack_front_image",
  "pack_back_image",
  "label_front_image",
  "label_back_image",
  "master_carton_image",
  "open_pack_image",
  "close_up_image",
  "pairing_image",
  "export_pack_image",
  "hamper_arrangement_image",
  "lifestyle_image",
] as const;

export type MediaAssetType = (typeof MEDIA_ASSET_TYPES)[number];

export type MediaAssetStatus = "draft" | "pending_approval" | "approved" | "rejected";

export type MediaAssetSource = "manual" | "ai_generated" | "import";

export type MediaAsset = {
  type: MediaAssetType;
  url: string | null;
  status: MediaAssetStatus;
  source?: MediaAssetSource;
  label?: string;
};

export type ProductMediaContext = {
  productId?: string | null;
  productName?: string | null;
  category?: string | null;
  subcategory?: string | null;
  productClass?: string | null;
  productType?: string | null;
  isLegacy?: boolean;
};

export type ProductMediaProfile =
  | "baklawa_small_sweets"
  | "gift_box"
  | "export_pack"
  | "hamper"
  | "general";

export type MediaAssetRequirement = {
  type: MediaAssetType;
  label: string;
  requiredForCatalogue: boolean;
  requiredForCentralSync: boolean;
};

export type MediaAssetSlotStatus = {
  type: MediaAssetType;
  label: string;
  required: boolean;
  requiredForCentralSync: boolean;
  present: boolean;
  approved: boolean;
  url: string | null;
  status: MediaAssetStatus | "missing";
};

export type MediaReadinessResult = {
  profile: ProductMediaProfile;
  score: number;
  maxScore: number;
  requiredAssets: MediaAssetType[];
  slots: MediaAssetSlotStatus[];
  missingAssets: MediaAssetType[];
  blockers: string[];
  canPublishMedia: boolean;
  canSyncMediaToCentral: boolean;
  approvedImageUrls: string[];
  isLegacy: boolean;
};
