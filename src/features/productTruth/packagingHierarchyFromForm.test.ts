import { describe, expect, it } from "vitest";
import { packagingHierarchyFromForm } from "./packagingHierarchyFromForm";
import { convertOrderedQtyToBaseQty } from "./uomPackagingEngine";

describe("packagingHierarchyFromForm", () => {
  it("maps carton and pack fields without hardcoded defaults", () => {
    const hierarchy = packagingHierarchyFromForm({
      approximate_piece_weight_g: 25,
      pieces_per_kg: 40,
      pcs_per_pack: 6,
      pcs_per_carton: 24,
      carton_qty: 4,
      master_carton_qty: 8,
    });

    expect(hierarchy.piecesPerKg).toBe(40);
    expect(hierarchy.packsPerCarton).toBe(4);
    expect(hierarchy.traysPerMasterCarton).toBe(8);
    expect(hierarchy.kgPerTray).toBeNull();
  });

  it("uses carton fields in conversion engine", () => {
    const hierarchy = packagingHierarchyFromForm({
      approximate_piece_weight_g: 25,
      pcs_per_pack: 10,
      pcs_per_carton: 20,
    });
    expect(hierarchy.packsPerCarton).toBe(2);
    const kg = convertOrderedQtyToBaseQty(1, "carton", hierarchy);
    expect(kg).toBe(2);
  });

  it("does not invent piecesPerKg when weight fields absent", () => {
    const hierarchy = packagingHierarchyFromForm({});
    expect(hierarchy.piecesPerKg).toBeNull();
    expect(hierarchy.kgPerTray).toBeNull();
  });
});
