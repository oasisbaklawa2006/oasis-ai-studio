import { describe, expect, it } from "vitest";
import {
  calculateDispatchPackagingQty,
  convertOrderedQtyToBaseQty,
  convertBaseKgToUom,
  validateConversionRule,
  applyRoundingRule,
} from "./uomPackagingEngine";
import type { PackagingHierarchy } from "./types";

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
    expect(convertBaseKgToUom(kg!, "tray", standardHierarchy)).toBe(3);
  });

  it("master carton rounding blocks partial when disabled", () => {
    const trays = calculateDispatchPackagingQty(7.2, "master_carton", standardHierarchy);
    expect(trays).toBe(1);
  });

  it("validates conversion rule factor", () => {
    expect(validateConversionRule({ fromUom: "pcs", toUom: "kg", factor: 40 }).valid).toBe(true);
    expect(validateConversionRule({ fromUom: "pcs", toUom: "kg", factor: 0 }).valid).toBe(false);
  });

  it("applyRoundingRule nearest", () => {
    expect(applyRoundingRule(1.23456, "nearest", 2)).toBe(1.23);
  });
});
