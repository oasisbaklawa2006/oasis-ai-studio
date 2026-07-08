/** Shared field-presence guards for catalogue draft content/prompt generation and readiness scoring. */

export function hasText(value: string | null | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

export function hasNumber(value: number | null | undefined): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
