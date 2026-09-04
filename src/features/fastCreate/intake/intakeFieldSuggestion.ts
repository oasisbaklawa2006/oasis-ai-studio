import type {
  ProductIntakeConfidence,
  ProductIntakeFieldKey,
  ProductIntakeFieldSuggestion,
} from "./types";

export function intakeFieldSuggestion(
  field: ProductIntakeFieldKey,
  value: string | null,
  confidence: ProductIntakeConfidence,
  source: string,
): ProductIntakeFieldSuggestion {
  return { field, value, confidence, source };
}

export function suggestionListKey(suggestion: ProductIntakeFieldSuggestion): string {
  return `${suggestion.field}:${suggestion.source}:${suggestion.value ?? ""}`;
}
