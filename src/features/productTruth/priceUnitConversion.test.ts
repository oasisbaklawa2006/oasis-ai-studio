import { describe, expect, it } from "vitest";
import {
  convertPricePerKgToPiece,
  convertPricePerPieceToKg,
  CONVERSION_UNAVAILABLE,
  priceWithAlternateUom,
  resolvePiecesPerKg,
} from "./priceUnitConversion";

describe("priceUnitConversion", () => {
  const auth = { gramsPerPiece: 15, piecesPerKg: null };

  it("derives pcs_per_kg from grams_per_piece", () => {
    expect(resolvePiecesPerKg({ gramsPerPiece: 15 })).toBeCloseTo(66.6667, 3);
  });

  it("converts MRP per kg to per piece", () => {
    const perPiece = convertPricePerKgToPiece(3600, { gramsPerPiece: 15 });
    expect(perPiece).toBeCloseTo(54, 0);
  });

  it("converts B2B per kg to per piece", () => {
    const perPiece = convertPricePerKgToPiece(2800, { piecesPerKg: 66.67 });
    expect(perPiece).toBeCloseTo(42, 0);
  });

  it("converts per piece back to per kg", () => {
    const perKg = convertPricePerPieceToKg(54, { gramsPerPiece: 15 });
    expect(perKg).toBeCloseTo(3600, 0);
  });

  it("missing grams/pcs shows conversion unavailable not 0", () => {
    expect(convertPricePerKgToPiece(3600, {})).toBeNull();
    const alt = priceWithAlternateUom(3600, "kg", {});
    expect(alt.alternatePrice).toBeNull();
    expect(alt.alternateLabel).toBe(CONVERSION_UNAVAILABLE);
  });
});
