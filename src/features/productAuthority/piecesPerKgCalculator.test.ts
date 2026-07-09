import { describe, expect, it } from "vitest";
import { pieceWeightGramsFromPiecesPerKg, piecesPerKgFromPieceWeightGrams } from "./piecesPerKgCalculator";

describe("piecesPerKgFromPieceWeightGrams", () => {
  it("computes pieces per kg from a piece weight", () => {
    expect(piecesPerKgFromPieceWeightGrams(20)).toBe(50);
    expect(piecesPerKgFromPieceWeightGrams(10)).toBe(100);
  });

  it("returns null for non-positive or non-finite input", () => {
    expect(piecesPerKgFromPieceWeightGrams(0)).toBeNull();
    expect(piecesPerKgFromPieceWeightGrams(-5)).toBeNull();
    expect(piecesPerKgFromPieceWeightGrams(NaN)).toBeNull();
  });
});

describe("pieceWeightGramsFromPiecesPerKg", () => {
  it("computes piece weight from pieces per kg", () => {
    expect(pieceWeightGramsFromPiecesPerKg(50)).toBe(20);
    expect(pieceWeightGramsFromPiecesPerKg(100)).toBe(10);
  });

  it("round-trips approximately for whole-number cases", () => {
    const piecesPerKg = 40;
    const weight = pieceWeightGramsFromPiecesPerKg(piecesPerKg);
    expect(weight).not.toBeNull();
    expect(piecesPerKgFromPieceWeightGrams(weight as number)).toBe(piecesPerKg);
  });

  it("returns null for non-positive or non-finite input", () => {
    expect(pieceWeightGramsFromPiecesPerKg(0)).toBeNull();
    expect(pieceWeightGramsFromPiecesPerKg(-1)).toBeNull();
    expect(pieceWeightGramsFromPiecesPerKg(Infinity)).toBeNull();
  });
});
