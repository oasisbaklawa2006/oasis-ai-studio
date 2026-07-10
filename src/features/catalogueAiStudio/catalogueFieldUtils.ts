/** Shared field-presence guards for catalogue draft content/prompt generation and readiness scoring. */

export function hasText(value: string | null | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

/** Strict typeof check — only true for an already-numeric, finite, positive value. */
export function hasNumber(value: number | null | undefined): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * Safely coerce a field that may arrive as a raw form-bound string (e.g. "500" from an
 * `<input type="number">`, which always yields a string via `e.target.value`) or as an
 * already-numeric value. Returns null for blank/whitespace strings, non-numeric text,
 * NaN, Infinity, and non-positive values — never a global truthiness check.
 */
export function parsePositiveNumericInput(value: number | string | null | undefined): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

/** True when `parsePositiveNumericInput` would resolve a real, positive number. */
export function hasNumericInput(value: number | string | null | undefined): boolean {
  return parsePositiveNumericInput(value) !== null;
}
