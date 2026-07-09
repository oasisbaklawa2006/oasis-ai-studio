/**
 * Detects when a generated content/prompt block is nothing but catalogueContentGenerators'
 * "Add missing field first: X." warning — as opposed to real copy that happens to mention
 * a missing field inline. Used to disable Copy and apply warning styling on those blocks only.
 */
const MISSING_FIELD_ONLY_PATTERN = /^Add missing field first: .+\.$/;

export function isMissingFieldOnlyMessage(text: string): boolean {
  return MISSING_FIELD_ONLY_PATTERN.test(text.trim());
}
