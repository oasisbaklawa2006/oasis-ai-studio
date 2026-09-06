import { describe, expect, it } from "vitest";
import {
  assertPackNotVariantHierarchy,
  assertVariantHierarchySaveAllowed,
  buildCanonicalProductVariantHierarchy,
  hasUnsupportedVariantParentageFields,
  resolveEditorVariantBinding,
  resolveVariantGraph,
  serializeProductVariantHierarchyForSnapshot,
  validateVariantHierarchyMutation,
} from "./productVariantHierarchyCanonical";

const baseForm: Record<string, unknown> = {
  id: "prod-1",
  sku: "OAS-AS-BKL-CAS-RBOX-0001",
  product_name: "Cashew Pyramid Baklawa",
  packaging_code: "RBOX",
  short_name: "Cashew Pyramid",
};

describe("productVariantHierarchyCanonical", () => {
  it("models each products row as a self-rooted sellable SKU (product_sku scope)", () => {
    const h = buildCanonicalProductVariantHierarchy(baseForm);
    expect(h.scope).toBe("product_sku");
    expect(h.nodes[0].level).toBe("basis_product");
    expect(h.nodes[0].parentProductId).toBeNull();
    expect(h.nodes[1].level).toBe("sellable_sku");
    expect(h.nodes[2].persistence).toBe("core_blocked");
    expect(h.point33PackHierarchyAuthority).toBe(true);
    expect(h.coreDependencies.length).toBeGreaterThan(0);
  });

  it("fails closed on unsupported variant parentage fields in form", () => {
    const h = buildCanonicalProductVariantHierarchy({
      ...baseForm,
      parent_product_id: "prod-parent",
    });
    expect(h.validation.valid).toBe(false);
    expect(h.validation.errors[0]).toMatch(/Core schema is not deployed/);
    expect(hasUnsupportedVariantParentageFields({ parent_product_id: "x" })).toBe(true);
  });

  it("warns that packaging_code is SKU identity, not variant hierarchy", () => {
    const h = buildCanonicalProductVariantHierarchy(baseForm);
    expect(h.validation.warnings.some((w) => w.includes("packaging_code"))).toBe(true);
  });

  it("detects cyclic parentage in explicit variant graph", () => {
    const resolution = resolveVariantGraph([
      { productId: "a", parentProductId: "b", variantKey: "v1", sku: "SKU-A" },
      { productId: "b", parentProductId: "a", variantKey: "v2", sku: "SKU-B" },
    ]);
    expect(resolution.validation.valid).toBe(false);
    expect(resolution.validation.errors.some((e) => e.includes("Cyclic"))).toBe(true);
  });

  it("detects duplicate variant keys across products", () => {
    const resolution = resolveVariantGraph([
      { productId: "a", parentProductId: null, variantKey: "250g", sku: "SKU-A" },
      { productId: "b", parentProductId: null, variantKey: "250g", sku: "SKU-B" },
    ]);
    expect(resolution.validation.valid).toBe(false);
    expect(resolution.validation.errors.some((e) => e.includes("Duplicate variant key"))).toBe(true);
  });

  it("detects ambiguous base product (multiple parents)", () => {
    const resolution = resolveVariantGraph([
      { productId: "child", parentProductId: "parent-a", variantKey: null, sku: "SKU-C" },
      { productId: "child", parentProductId: "parent-b", variantKey: null, sku: "SKU-C" },
    ]);
    expect(resolution.validation.valid).toBe(false);
    expect(resolution.validation.errors.some((e) => e.includes("Ambiguous base product"))).toBe(
      true,
    );
  });

  it("blocks variant parentage mutations until Core schema ships", () => {
    const result = validateVariantHierarchyMutation({
      kind: "set_parent",
      productId: "child",
      parentProductId: "parent",
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/Core-blocked/);
  });

  it("binds Point 31 identity tab to Point 32 without parentage mutation", () => {
    const binding = resolveEditorVariantBinding(baseForm);
    expect(binding.tab).toBe("identity");
    expect(binding.owner).toBe("Point32");
    expect(binding.canMutateParentage).toBe(false);
    expect(binding.sku).toBe("OAS-AS-BKL-CAS-RBOX-0001");
  });

  it("serializes snapshot schema point32_v1 with core_blocked variant graph", () => {
    const snap = serializeProductVariantHierarchyForSnapshot(baseForm);
    expect(snap.schema).toBe("point32_v1");
    expect(snap.scope).toBe("product_sku");
    expect(snap.variant_graph.persistence).toBe("core_blocked");
    expect(snap.pack_variant_separation.pack_hierarchy_owner).toBe("point33");
    expect(snap.composition_semantics.bom_parent_ref).toBe(
      "product_bom_items.parent_product_id",
    );
  });

  it("separates pack hierarchy from variant hierarchy", () => {
    const ok = assertPackNotVariantHierarchy({
      packagingCode: "RBOX",
      packHierarchyVariantScope: "product_sku",
    });
    expect(ok.valid).toBe(true);

    const bad = assertPackNotVariantHierarchy({
      packagingCode: "variant",
      packHierarchyVariantScope: "product_sku",
    });
    expect(bad.valid).toBe(false);
  });

  it("allows save when hierarchy is valid and no shadow parentage fields", () => {
    expect(assertVariantHierarchySaveAllowed(baseForm)).toEqual({ ok: true });
  });

  it("blocks save when unsupported parentage fields are present", () => {
    const result = assertVariantHierarchySaveAllowed({
      ...baseForm,
      basis_sku: "BASIS-001",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/Core schema/);
    }
  });
});
