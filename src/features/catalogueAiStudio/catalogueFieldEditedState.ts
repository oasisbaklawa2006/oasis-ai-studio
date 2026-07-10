/**
 * Distinguishes an untouched, freshly-generated draft field from one an operator has edited.
 * Pure string comparison only — never mutates, never persists. Used purely for the "Edited"
 * badge in the Catalogue Studio content/prompt editors so generated text is never presented
 * as approved or as an operator's own words.
 */
export function isFieldEdited(currentValue: string, generatedValue: string): boolean {
  return currentValue !== generatedValue;
}
