/**
 * Guided pack logic: five plain-language answers mapped onto the existing raw fields
 * (primary_uom / pcs_per_pack / carton_qty / moq_*), so the operator answers
 * "what is the selling unit / what's inside a pack / how many packs per carton"
 * instead of decoding UOM jargon. Pure mapping — no new fields invented.
 */

export interface PackAnswers {
  /** e.g. "box", "pouch", "jar", "tray" */
  sellingUnit: string;
  /** e.g. 6 (pcs inside one pack) */
  qtyPerPack: number | null;
  /** How B2B buys: by single pack or by carton. */
  b2bSoldBy: "pack" | "carton" | null;
  /** e.g. 30 (packs inside one carton) */
  packsPerCarton: number | null;
  masterCartonUsed: boolean;
}

export interface DerivedPackFields {
  primary_uom: string;
  retail_uom: string;
  b2b_uom: string;
  pcs_per_pack: number | null;
  carton_qty: number | null;
  fixed_carton_required: boolean;
  moq_rule_type: string | null;
  moq_value: number | null;
  moq_uom: string | null;
}

export function derivePackFields(answers: PackAnswers): DerivedPackFields {
  const unit = answers.sellingUnit.trim().toLowerCase() || "pack";
  const byCarton = answers.b2bSoldBy === "carton" && !!answers.packsPerCarton;

  return {
    primary_uom: unit,
    retail_uom: unit,
    b2b_uom: byCarton ? "carton" : unit,
    pcs_per_pack: answers.qtyPerPack && answers.qtyPerPack > 0 ? answers.qtyPerPack : null,
    carton_qty: answers.packsPerCarton && answers.packsPerCarton > 0 ? answers.packsPerCarton : null,
    fixed_carton_required: byCarton,
    moq_rule_type: byCarton ? "carton_based" : "fixed_min",
    moq_value: 1,
    moq_uom: byCarton ? "carton" : unit,
  };
}

/** "6 pcs box" style label starter derived from pack data — never invents quantities. */
export function labelStarterFromPack(
  qtyPerPack: number | null,
  sellingUnit: string,
  packagingLabel?: string | null,
): string | null {
  const unit = sellingUnit.trim().toLowerCase();
  if (!unit) return null;
  const packing = packagingLabel?.trim();
  if (qtyPerPack && qtyPerPack > 0) {
    return packing ? `${qtyPerPack} pcs ${unit} · ${packing}` : `${qtyPerPack} pcs ${unit}`;
  }
  return packing ? `${unit} · ${packing}` : null;
}

const KG_UNITS = new Set(["kg", "g", "gram", "grams", "kilogram", "loose"]);

const PACK_UNITS = new Set([
  "box",
  "pack",
  "pc",
  "pcs",
  "piece",
  "pieces",
  "tray",
  "jar",
  "tin",
  "pouch",
  "bag",
  "carton",
]);

/** True when the product sells loose / by weight — the only case pieces-per-kg applies. */
export function isWeightBasedSelling(primaryUom: string | null | undefined): boolean {
  return KG_UNITS.has(String(primaryUom ?? "").trim().toLowerCase());
}

/**
 * True only for an explicit pack unit (box/pack/jar/…). Null/unknown UOMs return false
 * so legacy weight-based products keep their original readiness rules.
 */
export function isPackBasedSelling(primaryUom: string | null | undefined): boolean {
  return PACK_UNITS.has(String(primaryUom ?? "").trim().toLowerCase());
}
