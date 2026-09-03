import type { FastCreateDraftSnapshot } from "@/features/fastCreate/fastCreateDraft";

export type ProductIntakeMode = "barcode" | "ocr" | "voice" | "text";

export type ProductIntakeConfidence = "high" | "medium" | "low" | "unresolved";

export type ProductIntakeStatus =
  | "ok"
  | "ambiguous"
  | "duplicate_barcode"
  | "empty"
  | "unsupported";

export type ProductIntakeFieldKey =
  | keyof FastCreateDraftSnapshot
  | "barcode"
  | "sku"
  | "category"
  | "notes";

export type ProductIntakeFieldSuggestion = {
  field: ProductIntakeFieldKey;
  value: string | null;
  confidence: ProductIntakeConfidence;
  source: string;
};

export type ProductIntakeDuplicateHit = {
  productId: string;
  label: string;
  barcode: string;
};

/**
 * Canonical reviewable intake result — all modes normalize into the same shape before
 * merging into the Fast Create draft. Extracted values are suggestions only.
 */
export type ProductIntakeResult = {
  mode: ProductIntakeMode;
  status: ProductIntakeStatus;
  message: string;
  draftPatch: Partial<FastCreateDraftSnapshot>;
  suggestions: ProductIntakeFieldSuggestion[];
  /** Barcode captured during intake (stored in formPatch metadata, not auto-saved). */
  barcode?: string | null;
  duplicateHit?: ProductIntakeDuplicateHit | null;
  reviewRequired: boolean;
  rawInput?: string;
};

export type ParsedProductTextFields = {
  productName: string | null;
  mrp: string | null;
  b2bPrice: string | null;
  qtyPerPack: string | null;
  sku: string | null;
  barcode: string | null;
  categoryKey: FastCreateCategoryKey | null;
  notes: string | null;
};
