/** Reviewed Core #505 packing.content_quantity contract; no packaging conversion inference. */
export type FullEditorContentQuantity = { value: number; unit: "pcs" | "g" | "kg" };
type QuantityResult =
  | { ok: true; quantity: FullEditorContentQuantity | null }
  | { ok: false; message: string };

/** Preserve explicit content on contributor drafts or retain input when Core cannot persist it. */
export function fullEditorContentQuantity(form: Record<string, unknown>): QuantityResult {
  const hasValue = (value: unknown) => value != null && String(value).trim() !== "";
  const explicitQuantity = hasValue(form.qty_per_pack);
  const raw = explicitQuantity ? form.qty_per_pack : form.pcs_per_pack;
  if (!hasValue(raw)) return { ok: true, quantity: null };
  const unit = explicitQuantity ? form.qty_content_uom : "pcs";
  const normalizedUnit = unit === "grams" ? "g" : unit;
  if (normalizedUnit !== "pcs" && normalizedUnit !== "g" && normalizedUnit !== "kg") {
    return {
      ok: false,
      message:
        "Draft not submitted: pack content needs an explicit supported unit (pcs, grams or kg).",
    };
  }
  const text = typeof raw === "string" ? raw.trim() : null;
  const numericInput =
    typeof raw === "number" || (text != null && /^[0-9]+(?:\.[0-9]+)?$/.test(text));
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
        "Draft not submitted: enter positive pack content; pieces must be a safe whole number.",
    };
  }
  return { ok: true, quantity: { value, unit: normalizedUnit } };
}
