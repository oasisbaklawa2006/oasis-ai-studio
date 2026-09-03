import type { FastCreateDraftSnapshot } from "@/features/fastCreate/fastCreateDraft";
import { lookupBarcodeInCatalog, toDuplicateHit } from "./barcodeLookup";
import { normalizeBarcodeInput } from "./normalizeBarcode";
import type { ProductIntakeFieldSuggestion, ProductIntakeResult } from "./types";

function fieldSuggestion(
  field: ProductIntakeFieldSuggestion["field"],
  value: string | null,
  confidence: ProductIntakeFieldSuggestion["confidence"],
  source: string,
): ProductIntakeFieldSuggestion {
  return { field, value, confidence, source };
}

/**
 * Barcode intake: typed or scanned barcode -> reviewable draft lookup with duplicate fail-safe.
 */
export async function intakeFromBarcode(raw: string): Promise<ProductIntakeResult> {
  const normalized = normalizeBarcodeInput(raw);
  if (!normalized.ok) {
    return {
      mode: "barcode",
      status: "unsupported",
      message: normalized.reason,
      draftPatch: {},
      suggestions: [],
      reviewRequired: true,
      rawInput: raw,
    };
  }

  const hit = await lookupBarcodeInCatalog(normalized.barcode);
  if (hit) {
    const duplicateHit = toDuplicateHit(hit);
    return {
      mode: "barcode",
      status: "duplicate_barcode",
      message: `Barcode ${normalized.barcode} already belongs to ${duplicateHit.label}. Open the existing product or use a different barcode.`,
      draftPatch: {},
      suggestions: [
        fieldSuggestion("barcode", normalized.barcode, "high", "barcode_scan"),
        fieldSuggestion("productName", hit.productName, "high", "catalog_lookup"),
        fieldSuggestion("sku", hit.sku, hit.sku ? "high" : "unresolved", "catalog_lookup"),
      ],
      barcode: normalized.barcode,
      duplicateHit,
      reviewRequired: true,
      rawInput: raw,
    };
  }

  const draftPatch: Partial<FastCreateDraftSnapshot> = {};
  const suggestions: ProductIntakeFieldSuggestion[] = [
    fieldSuggestion("barcode", normalized.barcode, "high", "barcode_scan"),
  ];

  return {
    mode: "barcode",
    status: "ok",
    message: "New barcode captured — enter the product name and review before create.",
    draftPatch,
    suggestions,
    barcode: normalized.barcode,
    duplicateHit: null,
    reviewRequired: true,
    rawInput: raw,
  };
}
