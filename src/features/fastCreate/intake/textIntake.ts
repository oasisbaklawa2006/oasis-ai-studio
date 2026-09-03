import type { FastCreateDraftSnapshot } from "@/features/fastCreate/fastCreateDraft";
import { parseProductText } from "./parseProductText";
import type { ProductIntakeFieldSuggestion, ProductIntakeResult } from "./types";

function fieldSuggestion(
  field: ProductIntakeFieldSuggestion["field"],
  value: string | null,
  confidence: ProductIntakeFieldSuggestion["confidence"],
  source: string,
): ProductIntakeFieldSuggestion {
  return { field, value, confidence, source };
}

function parsedFieldsToDraft(parsed: ReturnType<typeof parseProductText>): Partial<FastCreateDraftSnapshot> {
  const patch: Partial<FastCreateDraftSnapshot> = {};
  if (parsed.productName) patch.productName = parsed.productName;
  if (parsed.categoryKey) patch.categoryKey = parsed.categoryKey;
  if (parsed.mrp) patch.mrp = parsed.mrp;
  if (parsed.b2bPrice) patch.b2bPrice = parsed.b2bPrice;
  if (parsed.qtyPerPack) patch.qtyPerPack = parsed.qtyPerPack;
  if (parsed.sku) patch.resolvedSku = parsed.sku;
  return patch;
}

function parsedFieldsToSuggestions(parsed: ReturnType<typeof parseProductText>): ProductIntakeFieldSuggestion[] {
  const out: ProductIntakeFieldSuggestion[] = [];
  if (parsed.productName) out.push(fieldSuggestion("productName", parsed.productName, "medium", "text_parse"));
  if (parsed.categoryKey) out.push(fieldSuggestion("category", parsed.categoryKey, "low", "text_parse"));
  if (parsed.mrp) out.push(fieldSuggestion("mrp", parsed.mrp, "medium", "text_parse"));
  if (parsed.b2bPrice) out.push(fieldSuggestion("b2bPrice", parsed.b2bPrice, "medium", "text_parse"));
  if (parsed.qtyPerPack) out.push(fieldSuggestion("qtyPerPack", parsed.qtyPerPack, "medium", "text_parse"));
  if (parsed.sku) out.push(fieldSuggestion("sku", parsed.sku, "high", "text_parse"));
  if (parsed.barcode) out.push(fieldSuggestion("barcode", parsed.barcode, "medium", "text_parse"));
  if (parsed.notes) out.push(fieldSuggestion("notes", parsed.notes, "low", "text_parse"));
  return out;
}

function confidenceStatus(suggestions: ProductIntakeFieldSuggestion[]): ProductIntakeResult["status"] {
  if (suggestions.length === 0) return "empty";
  const hasName = suggestions.some((s) => s.field === "productName" && s.value);
  return hasName ? "ok" : "ambiguous";
}

/**
 * Free-text / paste intake — never silent publication; all values are review suggestions.
 */
export function intakeFromText(raw: string): ProductIntakeResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      mode: "text",
      status: "empty",
      message: "Paste or type product details to parse.",
      draftPatch: {},
      suggestions: [],
      reviewRequired: true,
      rawInput: raw,
    };
  }

  const parsed = parseProductText(trimmed);
  const suggestions = parsedFieldsToSuggestions(parsed);
  const status = confidenceStatus(suggestions);

  return {
    mode: "text",
    status,
    message:
      status === "ambiguous"
        ? "Parsed some fields but product name is unclear — review before applying."
        : status === "empty"
          ? "No product fields detected — try including a product name, MRP, or pack size."
          : "Parsed text suggestions — review and edit before applying to the draft.",
    draftPatch: parsedFieldsToDraft(parsed),
    suggestions,
    barcode: parsed.barcode,
    reviewRequired: true,
    rawInput: raw,
  };
}

/**
 * Voice transcript intake — same canonical parser as text, always review-required.
 */
export function intakeFromVoiceTranscript(transcript: string): ProductIntakeResult {
  const base = intakeFromText(transcript);
  return {
    ...base,
    mode: "voice",
    message:
      base.status === "empty"
        ? "No speech captured — try again or type the product details."
        : "Voice transcript parsed — review suggestions before applying.",
  };
}
