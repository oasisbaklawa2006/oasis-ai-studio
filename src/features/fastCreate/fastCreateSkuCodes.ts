import type { FastCreateCategoryKey } from "@/features/productDefaults/categoryDefaults";

export type FastCreateSkuCodeSet = {
  division_code: string;
  category_code: string;
  subcategory_code: string;
  packaging_code: string;
};

/** Pilot mapping from Fast Create category preset → SKU taxonomy codes. */
export const FAST_CREATE_SKU_CODE_MAP: Record<FastCreateCategoryKey, FastCreateSkuCodeSet> = {
  baklawa: {
    division_code: "AS",
    category_code: "BKL",
    subcategory_code: "ASS",
    packaging_code: "LOOSE",
  },
  dragees: {
    division_code: "CH",
    category_code: "DRG",
    subcategory_code: "MIX",
    packaging_code: "LOOSE",
  },
  dates_chocolate: {
    division_code: "CH",
    category_code: "DAT",
    subcategory_code: "PST",
    packaging_code: "LOOSE",
  },
  fusion_sweets: {
    division_code: "FS",
    category_code: "FUS",
    subcategory_code: "MIX",
    packaging_code: "LOOSE",
  },
  nuts: {
    division_code: "SN",
    category_code: "NUT",
    subcategory_code: "MIX",
    packaging_code: "LOOSE",
  },
  ready_packs: {
    division_code: "AS",
    category_code: "BKL",
    subcategory_code: "ASS",
    packaging_code: "RBOX",
  },
  gift_hampers: {
    division_code: "GF",
    category_code: "HMP",
    subcategory_code: "ASS",
    packaging_code: "RBOX",
  },
  packaging: {
    division_code: "PK",
    category_code: "RAW",
    subcategory_code: "ASS",
    packaging_code: "LOOSE",
  },
  bakery: {
    division_code: "FR",
    category_code: "CKE",
    subcategory_code: "ASS",
    packaging_code: "FROZEN",
  },
  other: {
    division_code: "AS",
    category_code: "BKL",
    subcategory_code: "ASS",
    packaging_code: "LOOSE",
  },
};

export function resolveFastCreateSkuCodes(categoryKey: FastCreateCategoryKey): FastCreateSkuCodeSet {
  return FAST_CREATE_SKU_CODE_MAP[categoryKey] ?? FAST_CREATE_SKU_CODE_MAP.other;
}
