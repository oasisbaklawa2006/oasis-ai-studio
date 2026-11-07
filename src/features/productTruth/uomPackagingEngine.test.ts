import { describe, expect, it } from "vitest";
import type { PackagingHierarchy } from "./types";
import {
  applyRoundingRule,
  calculateDispatchPackagingQty,
  convertBaseKgToUom,
  convertOrderedQtyToBaseQty,
  validateConversionRule,
} from "./uomPackagingEngine";

const standardHierarchy: PackagingHierarchy = {
  piecesPerKg: 40,
  kgPerTray: 1,
  traysPerMasterCarton: 8,
  allowPartialCarton: false,
  allowPartialPack: false,
  roundingRule: "nearest",
  tolerancePercent: 0,
};

describe("uomPackagingEngine", () => {
  it("retail pcs to kg: 40 pcs = 1 kg", () => {
    expect(convertOrderedQtyToBaseQty(40, "pcs", standardHierarchy)).toBe(1);
  });

  it("kg to tray: 3 kg = 3 trays", () => {
    expect(convertBaseKgToUom(3, "tray", standardHierarchy)).toBe(3);
  });

  it("120 pcs = 3 kg = 3 trays", () => {
    const kg = convertOrderedQtyToBaseQty(120, "pcs", standardHierarchy);
    expect(kg).toBe(3);
    if (kg === null) throw new Error("Expected a verified piece-to-kg conversion");
    expect(convertBaseKgToUom(kg, "tray", standardHierarchy)).toBe(3);
  });

  it("master carton rounding blocks partial when disabled", () => {
    const trays = calculateDispatchPackagingQty(7.2, "master_carton", standardHierarchy);
    expect(trays).toBe(1);
  });

  it("does not invent kg/tray or trays/master carton from missing product facts", () => {
    const unverified: PackagingHierarchy = {};
    expect(convertOrderedQtyToBaseQty(2, "tray", unverified)).toBeNull();
    expect(convertOrderedQtyToBaseQty(2, "box", unverified)).toBeNull();
    expect(convertOrderedQtyToBaseQty(2, "carton", unverified)).toBeNull();
    expect(convertOrderedQtyToBaseQty(2, "pack", unverified)).toBeNull();
    expect(convertOrderedQtyToBaseQty(2, "master_carton", unverified)).toBeNull();
    expect(convertBaseKgToUom(3, "tray", unverified)).toBeNull();
    expect(convertBaseKgToUom(3, "master_carton", unverified)).toBeNull();
    expect(calculateDispatchPackagingQty(3, "master_carton", unverified)).toBeNull();
  });

  it("does not treat pack-per-carton counts as a pack mass conversion", () => {
    const mixedUnits: PackagingHierarchy = {
      kgPerTray: 0.5,
      packsPerCarton: 4,
      traysPerMasterCarton: 8,
    };
    expect(convertOrderedQtyToBaseQty(2, "carton", mixedUnits)).toBeNull();
    expect(convertOrderedQtyToBaseQty(2, "pack", mixedUnits)).toBeNull();
    expect(convertOrderedQtyToBaseQty(2, "box", mixedUnits)).toBeNull();
    // Master carton remains convertible because both factors explicitly use trays.
    expect(convertOrderedQtyToBaseQty(2, "master_carton", mixedUnits)).toBe(8);
  });

  it("requires both verified kg/tray and trays/master carton before a conversion", () => {
    const onlyTray = { kgPerTray: 0.5 };
    const onlyMaster = { traysPerMasterCarton: 6 };
    expect(convertBaseKgToUom(3, "master_carton", onlyTray)).toBeNull();
    expect(convertBaseKgToUom(3, "master_carton", onlyMaster)).toBeNull();
    expect(convertOrderedQtyToBaseQty(2, "master_carton", onlyTray)).toBeNull();
    expect(convertOrderedQtyToBaseQty(2, "master_carton", onlyMaster)).toBeNull();

    const confirmed: PackagingHierarchy = { kgPerTray: 0.5, traysPerMasterCarton: 6 };
    expect(convertOrderedQtyToBaseQty(2, "master_carton", confirmed)).toBe(6);
    expect(convertBaseKgToUom(3, "master_carton", confirmed)).toBe(1);
    expect(calculateDispatchPackagingQty(3, "master_carton", confirmed)).toBe(1);
  });

  it("rejects invalid or non-finite conversion factors instead of emitting 0 or infinity", () => {
    for (const kgPerTray of [0, -1, Infinity, NaN]) {
      expect(convertOrderedQtyToBaseQty(2, "tray", { kgPerTray })).toBeNull();
      expect(convertBaseKgToUom(3, "tray", { kgPerTray })).toBeNull();
    }
    for (const traysPerMasterCarton of [0, -4, Infinity, NaN]) {
      expect(
        convertOrderedQtyToBaseQty(1, "master_carton", {
          kgPerTray: 1,
          traysPerMasterCarton,
        }),
      ).toBeNull();
    }
    expect(convertBaseKgToUom(Infinity, "master_carton", standardHierarchy)).toBeNull();
    expect(calculateDispatchPackagingQty(NaN, "master_carton", standardHierarchy)).toBeNull();
    expect(convertOrderedQtyToBaseQty(12, "pcs", { piecesPerKg: Infinity })).toBeNull();
  });

  it("validates conversion rule factor", () => {
    expect(validateConversionRule({ fromUom: "pcs", toUom: "kg", factor: 40 }).valid).toBe(true);
    expect(validateConversionRule({ fromUom: "pcs", toUom: "kg", factor: 0 }).valid).toBe(false);
  });

  it("applyRoundingRule nearest", () => {
    expect(applyRoundingRule(1.23456, "nearest", 2)).toBe(1.23);
  });
});
