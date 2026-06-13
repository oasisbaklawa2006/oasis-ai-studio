export type PieceWeightAuthority = {
  gramsPerPiece?: number | null;
  piecesPerKg?: number | null;
};

export const CONVERSION_UNAVAILABLE = "Conversion unavailable";

/** Resolve pcs/kg from grams/piece or explicit pcs_per_kg — never defaults to 0. */
export function resolvePiecesPerKg(auth: PieceWeightAuthority): number | null {
  const explicit = auth.piecesPerKg;
  if (explicit != null && explicit > 0 && Number.isFinite(explicit)) {
    return explicit;
  }
  const grams = auth.gramsPerPiece;
  if (grams != null && grams > 0 && Number.isFinite(grams)) {
    return round4(1000 / grams);
  }
  return null;
}

export function resolveGramsPerPiece(auth: PieceWeightAuthority): number | null {
  const explicit = auth.gramsPerPiece;
  if (explicit != null && explicit > 0 && Number.isFinite(explicit)) {
    return explicit;
  }
  const ppk = auth.piecesPerKg;
  if (ppk != null && ppk > 0 && Number.isFinite(ppk)) {
    return round4(1000 / ppk);
  }
  return null;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Convert price per kg → price per piece. Returns null when conversion not possible. */
export function convertPricePerKgToPiece(
  pricePerKg: number,
  auth: PieceWeightAuthority,
): number | null {
  if (!Number.isFinite(pricePerKg) || pricePerKg <= 0) return null;
  const ppk = resolvePiecesPerKg(auth);
  if (ppk == null || ppk <= 0) return null;
  return round2(pricePerKg / ppk);
}

/** Convert price per piece → price per kg. Returns null when conversion not possible. */
export function convertPricePerPieceToKg(
  pricePerPiece: number,
  auth: PieceWeightAuthority,
): number | null {
  if (!Number.isFinite(pricePerPiece) || pricePerPiece <= 0) return null;
  const ppk = resolvePiecesPerKg(auth);
  if (ppk == null || ppk <= 0) return null;
  return round2(pricePerPiece * ppk);
}

export type PriceWithAlternateUom = {
  primaryUom: string;
  primaryPrice: number;
  alternateUom: string | null;
  alternatePrice: number | null;
  alternateLabel: string;
};

/**
 * Given a channel price and its stored UOM, compute equivalent in the other unit.
 */
export function priceWithAlternateUom(
  price: number,
  storedUom: string | null | undefined,
  auth: PieceWeightAuthority,
): PriceWithAlternateUom {
  const uom = String(storedUom ?? "kg").toLowerCase();
  const isKg = uom === "kg" || uom === "kilogram";
  const isPiece = uom === "pcs" || uom === "pc" || uom === "piece" || uom === "pieces";

  if (isKg) {
    const perPiece = convertPricePerKgToPiece(price, auth);
    return {
      primaryUom: "kg",
      primaryPrice: price,
      alternateUom: perPiece != null ? "pcs" : null,
      alternatePrice: perPiece,
      alternateLabel: perPiece != null ? `≈ ₹${perPiece}/piece` : CONVERSION_UNAVAILABLE,
    };
  }

  if (isPiece) {
    const perKg = convertPricePerPieceToKg(price, auth);
    return {
      primaryUom: "pcs",
      primaryPrice: price,
      alternateUom: perKg != null ? "kg" : null,
      alternatePrice: perKg,
      alternateLabel: perKg != null ? `≈ ₹${perKg}/kg` : CONVERSION_UNAVAILABLE,
    };
  }

  return {
    primaryUom: uom,
    primaryPrice: price,
    alternateUom: null,
    alternatePrice: null,
    alternateLabel: CONVERSION_UNAVAILABLE,
  };
}
