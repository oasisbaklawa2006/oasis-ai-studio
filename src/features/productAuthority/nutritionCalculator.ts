/**
 * Pure per-100g → per-serving / per-piece nutrition math. Never invents a value — every
 * function here only scales a number the user already entered; it never fabricates
 * nutrition data, daily-value percentages (no verified RDA reference table exists here),
 * or FSSAI approval. Callers must still show NUTRITION_DRAFT_NOTICE wherever these numbers
 * appear, since none of this has been through compliance review.
 */

export const NUTRITION_DRAFT_NOTICE = "Draft nutrition data — requires compliance review.";

export type NutritionBasis = "per_100g" | "per_serving" | "per_piece";

/** Scales a per-100g nutrient value to a serving of the given weight in grams. */
export function nutrientPerServing(per100g: number, servingSizeGrams: number): number | null {
  if (!Number.isFinite(per100g) || !Number.isFinite(servingSizeGrams) || servingSizeGrams <= 0) return null;
  return Math.round(((per100g * servingSizeGrams) / 100) * 100) / 100;
}

/** Scales a per-100g nutrient value to a single piece of the given weight in grams. */
export function nutrientPerPiece(per100g: number, pieceWeightGrams: number): number | null {
  return nutrientPerServing(per100g, pieceWeightGrams);
}

export type NutritionPanelDraft = {
  basis: NutritionBasis;
  servingSizeGrams: number | null;
  energyKcal: number | null;
  proteinG: number | null;
  carbohydrateG: number | null;
  totalSugarG: number | null;
  addedSugarG: number | null;
  totalFatG: number | null;
  saturatedFatG: number | null;
  transFatG: number | null;
  sodiumMg: number | null;
  cholesterolMg: number | null;
  fibreG: number | null;
};

const SCALABLE_FIELDS = [
  "energyKcal",
  "proteinG",
  "carbohydrateG",
  "totalSugarG",
  "addedSugarG",
  "totalFatG",
  "saturatedFatG",
  "transFatG",
  "sodiumMg",
  "cholesterolMg",
  "fibreG",
] as const satisfies readonly (keyof NutritionPanelDraft)[];

/** Derives a per-serving or per-piece panel from a per-100g draft. Returns null fields it can't compute — never guesses. */
export function derivePanelForWeight(
  per100g: NutritionPanelDraft,
  targetWeightGrams: number | null,
  targetBasis: Exclude<NutritionBasis, "per_100g">,
): NutritionPanelDraft {
  const derived: NutritionPanelDraft = { ...per100g, basis: targetBasis, servingSizeGrams: targetWeightGrams };
  if (!targetWeightGrams || targetWeightGrams <= 0) {
    for (const field of SCALABLE_FIELDS) derived[field] = null;
    return derived;
  }
  for (const field of SCALABLE_FIELDS) {
    const value = per100g[field];
    derived[field] = value == null ? null : nutrientPerServing(value, targetWeightGrams);
  }
  return derived;
}
