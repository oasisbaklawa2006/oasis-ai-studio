import { describe, expect, it } from "vitest";
import {
  buildCanonicalPackagingHierarchy,
  enrichPackFormFromDbRow,
  persistedPackFieldsFromHierarchy,
  serializePackagingHierarchyForSnapshot,
} from "./packagingHierarchyCanonical";
import { convertOrderedQtyToBaseQty } from "./uomPackagingEngine";

const packProductForm: Record<string, unknown> = {
  id: "prod-1",
  sku: "OB-TEST-001",
  product_name: "Test Baklava",
  primary_pack_type: "Box",
  primary_pack_uom: "box",
  qty_per_pack: 6,
  pcs_per_pack: 6,
  pcs_per_carton: 24,
  carton_qty: 4,
  carton_uom: "carton",
  master_carton_qty: 8,
  master_carton_uom: "master_carton",
  approximate_piece_weight_g: 25,
  pieces_per_kg: 40,
};

describe("packagingHierarchyCanonical", () => {
  it("maps product → sellable pack → case → master carton chain", () => {
    const h = buildCanonicalPackagingHierarchy(packProductForm);
    expect(h.variantScope).toBe("product_sku");
    expect(h.nodes.map((n) => n.level)).toEqual([
      "product",
      "sellable_pack",
      "case_carton",
      "master_carton",
      "pallet",
    ]);
    expect(h.nodes[1].qtyPerParent).toBe(6);
    expect(h.nodes[2].qtyPerParent).toBe(4);
    expect(h.nodes[3].present).toBe(true);
    expect(h.nodes[4].persistence).toBe("core_blocked");
    expect(h.coreDependencies.length).toBeGreaterThan(0);
    expect(h.point35DimensionAuthority).toBe(true);
  });

  it("rejects zero quantities", () => {
    const h = buildCanonicalPackagingHierarchy({
      ...packProductForm,
      carton_qty: 0,
      pcs_per_carton: 0,
    });
    expect(h.validation.valid).toBe(false);
    expect(h.validation.errors.some((e) => e.includes("zero"))).toBe(true);
  });

  it("warns on inconsistent carton nesting", () => {
    const h = buildCanonicalPackagingHierarchy({
      ...packProductForm,
      carton_qty: 10,
      pcs_per_carton: 24,
      pcs_per_pack: 6,
    });
    expect(h.validation.warnings.some((w) => w.includes("differs"))).toBe(true);
  });

  it("isolates hierarchy per product SKU (variant scope)", () => {
    const a = buildCanonicalPackagingHierarchy({ ...packProductForm, sku: "SKU-A" });
    const b = buildCanonicalPackagingHierarchy({
      ...packProductForm,
      sku: "SKU-B",
      pcs_per_carton: 12,
      carton_qty: 2,
    });
    expect(a.sku).toBe("SKU-A");
    expect(b.sku).toBe("SKU-B");
    expect(a.nodes[2].qtyPerParent).toBe(4);
    expect(b.nodes[2].qtyPerParent).toBe(2);
  });

  it("keeps pallet optional and core-blocked without inventing data", () => {
    const snap = serializePackagingHierarchyForSnapshot(packProductForm);
    expect(snap.pallet.persistence).toBe("core_blocked");
    expect(snap.pallet.optional).toBe(true);
    expect(snap.hierarchy_chain.find((n) => n.level === "pallet")?.qty_per_parent).toBeNull();
  });

  it("delegates dimensions/CBM to Point 35 authority refs only", () => {
    const snap = serializePackagingHierarchyForSnapshot({
      ...packProductForm,
      dimension_l_cm: 30,
      dimension_w_cm: 20,
      dimension_h_cm: 10,
      cbm: 0.006,
      carton_dimensions_cm: "40x30x25",
    });
    expect(snap.dimension_refs.authority).toBe("point35");
    expect(snap.dimension_refs.cbm).toBe(0.006);
    expect(snap.dimension_refs.carton_dimensions_cm).toBe("40x30x25");
  });

  it("round-trips persisted pack fields without pallet writes", () => {
    const persisted = persistedPackFieldsFromHierarchy(packProductForm);
    expect(persisted.pcs_per_pack).toBe(6);
    expect(persisted.carton_qty).toBe(4);
    expect(persisted.master_carton_qty).toBe(8);
    expect(persisted).not.toHaveProperty("pallets_per_carton");
    expect(persisted).not.toHaveProperty("cartons_per_pallet");
  });

  it("enriches UI pack fields from DB row without shadow columns", () => {
    const patch = enrichPackFormFromDbRow({
      pcs_per_pack: 12,
      primary_uom: "box",
      packaging_code: "RBOX",
    });
    expect(patch.qty_per_pack).toBe(12);
    expect(patch.primary_pack_uom).toBe("box");
    expect(patch.primary_pack_type).toBe("RBOX");
  });

  it("serializes snapshot schema point33_v1 with validation block", () => {
    const snap = serializePackagingHierarchyForSnapshot(packProductForm);
    expect(snap.schema).toBe("point33_v1");
    expect(snap.case_carton.packs_per_carton).toBe(4);
    expect(snap.validation.valid).toBe(true);
  });

  it("engine chain remains compatible with uomPackagingEngine", () => {
    const h = buildCanonicalPackagingHierarchy(packProductForm);
    const kg = convertOrderedQtyToBaseQty(1, "carton", h.engine);
    expect(kg).toBe(4);
  });

  it("handles incomplete optional pallet layer on weight-based product", () => {
    const h = buildCanonicalPackagingHierarchy({
      sku: "LOOSE-1",
      approximate_piece_weight_g: 50,
      pieces_per_kg: 20,
    });
    expect(h.nodes[4].present).toBe(false);
    expect(h.validation.valid).toBe(true);
    expect(h.engine.piecesPerKg).toBe(20);
  });
});
