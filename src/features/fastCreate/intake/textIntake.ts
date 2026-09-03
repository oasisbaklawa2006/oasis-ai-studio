import { parsedFieldsToDraft, parsedFieldsToSuggestions } from "./parsedFieldsMapping";
import { parseProductText } from "./parseProductText";
import type { ProductIntakeFieldSuggestion, ProductIntakeResult } from "./types";

function confidenceStatus(
  suggestions: ProductIntakeFieldSuggestion[],
): ProductIntakeResult["status"] {
  if (suggestions.length === 0) return "empty";
  const hasName = suggestions.some((s) => s.field === "productName" && s.value);
  return hasName ? "ok" : "ambiguous";
}

function textIntakeMessage(status: ProductIntakeResult["status"]): string {
  if (status === "ambiguous") {
    return "Parsed some fields but product name is unclear — review before applying.";
  }
  if (status === "empty") {
    return "No product fields detected — try including a product name, MRP, or pack size.";
  }
  return "Parsed text suggestions — review and edit before applying to the draft.";
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
    message: textIntakeMessage(status),
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
