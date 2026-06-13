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

function toStr(v: unknown): string | null {
  if (v === "" || v == null) return null;
  return String(v);
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
  const gramsPerPiece =
    toNum(form.approximate_piece_weight_g) ??
    toNum(form.grams_per_piece) ??
    toNum(form.weight_per_pc_grams);
  const piecesPerKg =
    toNum(form.pieces_per_kg) ??
    toNum(form.pcs_per_kg) ??
    (gramsPerPiece && gramsPerPiece > 0 ? Number((1000 / gramsPerPiece).toFixed(4)) : null);

  const fixedCartonRequired = toBool(form.fixed_carton_required, false);

  return {
    gramsPerPiece,
    piecesPerKg,
    kgPerTray: toNum(form.kg_per_tray) ?? toNum(form.primary_pack_weight_kg),
    traysPerMasterCarton:
      toNum(form.master_carton_qty) ?? toNum(form.packs_per_master_carton),
    packsPerCarton:
      toNum(form.pcs_per_carton) ??
      toNum(form.packs_per_carton) ??
      toNum(form.carton_qty),
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

export type PackagingFieldSummary = {
  moq: ProductMoqSummary;
  pcsPerPack: number | null;
  pcsPerCarton: number | null;
  packsPerCarton: number | null;
  pcsPerMasterCarton: number | null;
  packsPerMasterCarton: number | null;
  cartonType: string | null;
  gramsPerPiece: number | null;
  piecesPerKg: number | null;
  primaryPackWeightKg: number | null;
};

/** Product-level MOQ from products row (UOM tab) — separate from channel MOQ rules. */
export function productMoqFromForm(form: Record<string, unknown>): ProductMoqSummary {
  return {
    moqValue: toNum(form.moq_value),
    moqUom: toStr(form.moq_uom),
    incrementValue: toNum(form.increment_value),
    incrementUom: toStr(form.increment_uom),
    moqRuleType: toStr(form.moq_rule_type),
  };
}

/** Extended packaging fields for Product Truth display — all from form, no inference. */
export function packagingFieldsFromForm(form: Record<string, unknown>): PackagingFieldSummary {
  const hierarchy = packagingHierarchyFromForm(form);
  return {
    moq: productMoqFromForm(form),
    pcsPerPack: toNum(form.pcs_per_pack) ?? toNum(form.qty_per_pack),
    pcsPerCarton: toNum(form.pcs_per_carton),
    packsPerCarton: toNum(form.packs_per_carton) ?? toNum(form.carton_qty),
    pcsPerMasterCarton: toNum(form.pcs_per_master_carton),
    packsPerMasterCarton: toNum(form.packs_per_master_carton) ?? toNum(form.master_carton_qty),
    cartonType: toStr(form.carton_type) ?? toStr(form.carton_uom),
    gramsPerPiece: hierarchy.gramsPerPiece ?? null,
    piecesPerKg: hierarchy.piecesPerKg ?? null,
    primaryPackWeightKg: toNum(form.primary_pack_weight_kg) ?? toNum(form.kg_per_tray),
  };
}
