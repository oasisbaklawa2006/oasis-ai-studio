import type { PackagingHierarchy } from "./types";

function toNum(v: unknown): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toBool(v: unknown, fallback = false): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === 1 || v === "1") return true;
  if (v === "false" || v === 0 || v === "0") return false;
  return fallback;
}

export const NOT_CONFIGURED = "Not configured";

/** Format nullable packaging value for Product Truth display — never infer defaults. */
export function formatPackagingValue(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return NOT_CONFIGURED;
  return String(value);
}

/**
 * Authoritative packaging hierarchy from Product Edit form / persisted products row.
 * No hardcoded tray/carton/pcs defaults — null means not configured.
 */
export function packagingHierarchyFromForm(form: Record<string, unknown>): PackagingHierarchy {
  const gramsPerPiece = toNum(form.approximate_piece_weight_g);
  const piecesPerKg =
    toNum(form.pieces_per_kg) ??
    (gramsPerPiece && gramsPerPiece > 0 ? Number((1000 / gramsPerPiece).toFixed(4)) : null);

  const fixedCartonRequired = toBool(form.fixed_carton_required, false);

  return {
    gramsPerPiece,
    piecesPerKg,
    kgPerTray: toNum(form.kg_per_tray),
    traysPerMasterCarton: toNum(form.master_carton_qty),
    packsPerCarton: toNum(form.pcs_per_carton) ?? toNum(form.carton_qty),
    allowPartialPack: !fixedCartonRequired,
    allowPartialCarton: !fixedCartonRequired,
    roundingRule: "nearest",
    tolerancePercent: 0,
  };
}

export type ProductMoqSummary = {
  moqValue: number | null;
  moqUom: string | null;
  incrementValue: number | null;
  incrementUom: string | null;
  moqRuleType: string | null;
};

/** Product-level MOQ from products row (UOM tab) — separate from channel MOQ rules. */
export function productMoqFromForm(form: Record<string, unknown>): ProductMoqSummary {
  return {
    moqValue: toNum(form.moq_value),
    moqUom: form.moq_uom ? String(form.moq_uom) : null,
    incrementValue: toNum(form.increment_value),
    incrementUom: form.increment_uom ? String(form.increment_uom) : null,
    moqRuleType: form.moq_rule_type ? String(form.moq_rule_type) : null,
  };
}
