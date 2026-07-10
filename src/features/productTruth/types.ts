import type { MediaAsset, ProductMediaContext } from "@/features/mediaReadiness/types";

/** Catalogue channels supported by the Product Truth MVP engines. */
export const PRODUCT_TRUTH_CHANNELS = [
  "retail",
  "b2b",
  "horeca",
  "wholesale",
  "franchise",
  "export",
  "corporate",
  "wedding",
  "internal",
] as const;

export type ProductTruthChannel = (typeof PRODUCT_TRUTH_CHANNELS)[number];

export const READINESS_DIMENSIONS = [
  "content_status",
  "media_status",
  "pricing_status",
  "uom_status",
  "packaging_status",
  "compliance_status",
  "production_mapping_status",
  "central_sync_status",
] as const;

export type ReadinessDimension = (typeof READINESS_DIMENSIONS)[number];

export type ReadinessBadge =
  | "draft"
  | "ai_generated"
  | "human_edited"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "locked"
  | "published"
  | "legacy_incomplete";

export type DimensionStatus = {
  dimension: ReadinessDimension;
  badge: ReadinessBadge;
  complete: boolean;
  note?: string;
};

export type UomCode =
  | "pcs"
  | "kg"
  | "grams"
  | "tray"
  | "carton"
  | "master_carton"
  | "pack"
  | "box";

export type RoundingRule = "ceil" | "floor" | "nearest" | "none";

export type PackagingHierarchy = {
  gramsPerPiece?: number | null;
  piecesPerKg?: number | null;
  kgPerTray?: number | null;
  traysPerMasterCarton?: number | null;
  packsPerCarton?: number | null;
  /** Pieces inside one retail pack (pack-based products). */
  pcsPerPack?: number | null;
  allowPartialPack?: boolean;
  allowPartialCarton?: boolean;
  roundingRule?: RoundingRule;
  tolerancePercent?: number;
};

export type ConversionRule = {
  fromUom: UomCode;
  toUom: UomCode;
  factor: number;
};

export type ChannelPriceRecord = {
  channel: ProductTruthChannel | string;
  priceType?: "mrp" | "selling" | "b2b_base" | "horeca" | "wholesale" | "franchise" | "export_exw" | "export_fob" | "corporate" | "wedding" | string;
  mrp?: number | null;
  sellingPrice?: number | null;
  currency?: string;
  uom?: string | null;
  priceStatus?: "draft" | "pending_approval" | "approved" | "archived";
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
};

export type ChannelMoqRule = {
  channel: ProductTruthChannel | string;
  moqValue?: number | null;
  moqUom?: UomCode | string | null;
  incrementValue?: number | null;
  incrementUom?: UomCode | string | null;
  moqApplicable?: boolean;
};

export type ProductTruthInput = {
  productId?: string | null;
  productName?: string | null;
  isLegacy?: boolean;
  heroImageUrl?: string | null;
  mediaStatus?: string | null;
  hsnCode?: string | null;
  gstRate?: string | number | null;
  ingredients?: string | null;
  complianceApproved?: boolean;
  complianceMetaPending?: boolean;
  primaryUom?: string | null;
  retailUom?: string | null;
  b2bUom?: string | null;
  packaging?: PackagingHierarchy;
  mainDepartment?: string | null;
  productionDepartment?: string | null;
  bomRequired?: boolean;
  prices?: ChannelPriceRecord[];
  moqRules?: ChannelMoqRule[];
  mediaAssets?: MediaAsset[];
  mediaContext?: ProductMediaContext;
  dimensionStatuses?: Partial<Record<ReadinessDimension, ReadinessBadge>>;
  /** Product-row prices (mrp / price_b2b / export) — legacy/Central-owned pricing read fallback. */
  fallbackPrices?: { mrp: number | null; b2bPrice: number | null; exportPrice: number | null };
  /** True when the product sells by pack/box (pcs_per_pack set or pack UOM) — pieces/kg not applicable. */
  packBasedSelling?: boolean;
};
