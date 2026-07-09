/**
 * Two-way conversion between pieces-per-kg and approximate piece weight (grams).
 * Never overwrites a value the user typed directly — callers should only apply the
 * derived value to the *other* field, not the one currently being edited.
 */

const GRAMS_PER_KG = 1000;

export function piecesPerKgFromPieceWeightGrams(pieceWeightGrams: number): number | null {
  if (!Number.isFinite(pieceWeightGrams) || pieceWeightGrams <= 0) return null;
  return Math.round(GRAMS_PER_KG / pieceWeightGrams);
}

export function pieceWeightGramsFromPiecesPerKg(piecesPerKg: number): number | null {
  if (!Number.isFinite(piecesPerKg) || piecesPerKg <= 0) return null;
  return Math.round((GRAMS_PER_KG / piecesPerKg) * 100) / 100;
}
