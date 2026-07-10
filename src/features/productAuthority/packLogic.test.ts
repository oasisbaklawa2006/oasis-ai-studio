import { describe, expect, it } from "vitest";
import { derivePackFields, isPackBasedSelling, isWeightBasedSelling, labelStarterFromPack } from "./packLogic";

describe("derivePackFields", () => {
  it("maps the Misr 15 guided answers onto existing fields", () => {
    const fields = derivePackFields({
      sellingUnit: "box",
      qtyPerPack: 6,
      b2bSoldBy: "carton",
      packsPerCarton: 30,
      masterCartonUsed: false,
    });
    expect(fields.primary_uom).toBe("box");
    expect(fields.retail_uom).toBe("box");
    expect(fields.b2b_uom).toBe("carton");
    expect(fields.pcs_per_pack).toBe(6);
    expect(fields.carton_qty).toBe(30);
    expect(fields.moq_rule_type).toBe("carton_based");
    expect(fields.fixed_carton_required).toBe(true);
  });

  it("pack-only selling keeps pack UOM for B2B and fixed_min MOQ", () => {
    const fields = derivePackFields({
      sellingUnit: "jar",
      qtyPerPack: null,
      b2bSoldBy: "pack",
      packsPerCarton: null,
      masterCartonUsed: false,
    });
    expect(fields.b2b_uom).toBe("jar");
    expect(fields.moq_rule_type).toBe("fixed_min");
    expect(fields.fixed_carton_required).toBe(false);
  });
});

describe("labelStarterFromPack", () => {
  it("derives '6 pcs box' from pack data", () => {
    expect(labelStarterFromPack(6, "box")).toBe("6 pcs box");
  });

  it("appends packaging label when available", () => {
    expect(labelStarterFromPack(6, "box", "Printed Paper Box")).toBe("6 pcs box · Printed Paper Box");
  });

  it("never invents a quantity", () => {
    expect(labelStarterFromPack(null, "box")).toBeNull();
    expect(labelStarterFromPack(null, "box", "Rigid / Gift Box")).toBe("box · Rigid / Gift Box");
  });
});

describe("selling-basis detection", () => {
  it("classifies kg/loose as weight-based, box/jar as pack-based", () => {
    expect(isWeightBasedSelling("kg")).toBe(true);
    expect(isPackBasedSelling("kg")).toBe(false);
    expect(isPackBasedSelling("box")).toBe(true);
    expect(isPackBasedSelling("jar")).toBe(true);
  });

  it("unknown/blank UOM is neither — legacy rules stay untouched", () => {
    expect(isWeightBasedSelling(null)).toBe(false);
    expect(isPackBasedSelling(null)).toBe(false);
    expect(isPackBasedSelling("")).toBe(false);
  });
});
