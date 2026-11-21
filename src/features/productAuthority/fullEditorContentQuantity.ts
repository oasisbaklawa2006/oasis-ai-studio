/** Reviewed Core #505 packing.content_quantity contract; no packaging conversion inference. */
export type FullEditorContentQuantity = { value: number; unit: "pcs" | "g" | "kg" };
type QuantityResult =
  | { ok: true; quantity: FullEditorContentQuantity | null }
  | { ok: false; message: string };

/** Strict, linear-time decimal grammar without regex backtracking.
 * Allow digits[.digits] and .digits; reject empty, exponent, signs and trailing dots.
 * The length bound protects parsing/number conversion from oversized untrusted input.
 */
function isPlainDecimalQuantity(text: string): boolean {
  if (text.length === 0 || text.length > 128) return false;
  let seenDot = false;
  let digitsBeforeDot = 0;
  let digitsAfterDot = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    if (char >= 48 && char <= 57) {
      if (seenDot) digitsAfterDot++;
      else digitsBeforeDot++;
      continue;
    }
    if (char === 46 && !seenDot) {
      seenDot = true;
      continue;
    }
    return false;
  }
  return seenDot ? digitsAfterDot > 0 : digitsBeforeDot > 0;
}

/** Preserve explicit content on contributor drafts or retain input when Core cannot persist it. */
export function fullEditorContentQuantity(form: Record<string, unknown>): QuantityResult {
  const hasValue = (value: unknown) => value != null && String(value).trim() !== "";
  const explicitQuantity = hasValue(form.qty_per_pack);
  const raw = explicitQuantity
    ? form.qty_per_pack
    : form.qty_content_uom && form.qty_content_uom !== "pcs"
      ? null
      : form.pcs_per_pack;
  if (!hasValue(raw)) return { ok: true, quantity: null };
  const unit = explicitQuantity ? form.qty_content_uom : "pcs";
  const normalizedUnit = unit === "grams" ? "g" : unit;
  if (normalizedUnit !== "pcs" && normalizedUnit !== "g" && normalizedUnit !== "kg") {
    return {
      ok: false,
      message: "Cannot save pack content: select an explicit supported unit (pcs, grams or kg).",
    };
  }
  const text = typeof raw === "string" ? raw.trim() : null;
  const numericInput =
    typeof raw === "number" || (text != null && isPlainDecimalQuantity(text));
  const value = numericInput ? Number(raw) : Number.NaN;
  if (
    !Number.isFinite(value) ||
    value <= 0 ||
    (normalizedUnit === "pcs" && !Number.isSafeInteger(value)) ||
    (normalizedUnit === "kg" && !Number.isFinite(value * 1000))
  ) {
    return {
      ok: false,
      message:
        "Cannot save pack content: enter a positive quantity; pieces must be a safe whole number.",
    };
  }
  return { ok: true, quantity: { value, unit: normalizedUnit } };
}

/** Keep quantity controls unit-aware without interpreting a mass as a piece count. */
export function fullEditorQuantityPatch(
  form: Record<string, unknown>,
  value: string,
): Record<string, unknown> {
  const patch: Record<string, unknown> = { qty_per_pack: value };
  if (form.qty_content_uom === "pcs") patch.pcs_per_pack = value;
  else if (["g", "grams", "kg"].includes(String(form.qty_content_uom))) {
    const number = Number(value);
    patch.net_weight_g =
      value.trim() && Number.isFinite(number)
        ? number * (form.qty_content_uom === "kg" ? 1000 : 1)
        : "";
  }
  return patch;
}

/** Editing net grams also updates an active weight-content input in its explicit unit. */
export function fullEditorWeightPatch(
  form: Record<string, unknown>,
  value: string,
): Record<string, unknown> {
  const patch: Record<string, unknown> = { net_weight_g: value };
  if (["g", "grams", "kg"].includes(String(form.qty_content_uom))) {
    const number = Number(value);
    patch.qty_per_pack =
      value.trim() && Number.isFinite(number)
        ? number / (form.qty_content_uom === "kg" ? 1000 : 1)
        : "";
  }
  return patch;
}

/** The legacy pair carries the same evidence as typed content, never a cross-unit fallback. */
export function fullEditorDraftContentPacking(quantity: FullEditorContentQuantity | null) {
  return quantity
    ? {
        qty_per_pack: quantity.value,
        qty_content_uom: quantity.unit,
        content_quantity: quantity,
      }
    : {};
}
