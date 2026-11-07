/**
 * Core Point33 optional pallet metadata. No hidden default: pallet counts and
 * UOM must be explicit operator-supplied values, never carton-size inference.
 */
export type PalletMetadata = {
  cartons_per_pallet: number | null;
  master_cartons_per_pallet: number | null;
  pallet_uom: string | null;
};
export type PalletValidation = { valid: boolean; errors: string[]; metadata: PalletMetadata };

function readCount(field: string, value: unknown, errors: string[]): number | null {
  if (value === null || value === undefined || value === "") return null;

  // HTML number inputs return strings, and hydrated Core values may be numbers.
  // Reject Number() coercions such as "0x10", "1e3", true or whitespace, which
  // were never explicit decimal whole-carton counts asserted by the operator.
  const isDecimalCount =
    (typeof value === "string" && /^[0-9]+$/.test(value)) ||
    (typeof value === "number" && Number.isSafeInteger(value));
  const n = isDecimalCount ? Number(value) : Number.NaN;
  if (!Number.isSafeInteger(n) || n < 1 || n > 10000) {
    errors.push(`${field} must be a positive whole number (1–10000)`);
    return null;
  }
  return n;
}

export function validatePalletMetadata(form: Record<string, unknown>): PalletValidation {
  const errors: string[] = [];
  const cartons = readCount("Cartons per pallet", form.cartons_per_pallet, errors);
  const masterCartons = readCount(
    "Master cartons per pallet",
    form.master_cartons_per_pallet,
    errors,
  );
  const uomValue = form.pallet_uom;
  if (uomValue != null && typeof uomValue !== "string") {
    errors.push("Pallet UOM must be text");
  }
  const rawUom = typeof uomValue === "string" ? uomValue : "";
  const uom = rawUom.trim() || null;
  if (rawUom && (rawUom.length > 64 || uom !== rawUom)) {
    errors.push("Pallet UOM must be trimmed and at most 64 characters");
  }
  if ((cartons != null || masterCartons != null) && !uom) {
    errors.push("Pallet UOM is required when pallet quantity is specified");
  }
  if (uom && cartons == null && masterCartons == null && errors.length === 0) {
    errors.push("At least one pallet quantity is required when Pallet UOM is specified");
  }
  return {
    valid: errors.length === 0,
    errors,
    metadata: {
      cartons_per_pallet: cartons,
      master_cartons_per_pallet: masterCartons,
      pallet_uom: uom,
    },
  };
}

export function palletMetadataProductsPayload(form: Record<string, unknown>): PalletMetadata {
  const checked = validatePalletMetadata(form);
  if (!checked.valid) throw new Error(checked.errors.join("; "));
  return checked.metadata;
}
