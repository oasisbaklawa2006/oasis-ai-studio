import { describe, expect, it } from "vitest";
import {
  assertPackNotVariantHierarchy,
  assertVariantHierarchySaveAllowed,
  buildCanonicalProductVariantHierarchy,
  hasVariantParentageFields,
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
  it("models each products row as a self-rooted sellable SKU (product_sku scope) when no basis product is set", () => {
    const h = buildCanonicalProductVariantHierarchy(baseForm);
    expect(h.scope).toBe("product_sku");
    expect(h.nodes[0].level).toBe("basis_product");
    expect(h.nodes[0].parentProductId).toBeNull();
    expect(h.nodes[1].level).toBe("sellable_sku");
    expect(h.nodes[2].persistence).toBe("product_variants_row");
    expect(h.nodes[2].present).toBe(false);
    expect(h.point33PackHierarchyAuthority).toBe(true);
  });

  it("models explicit_variant_graph scope when basis_product_id/variant_key are present (Core PR #310 live columns)", () => {
    const h = buildCanonicalProductVariantHierarchy({
      ...baseForm,
      basis_product_id: "prod-basis",
      variant_key: "500g",
    });
    expect(h.scope).toBe("explicit_variant_graph");
    expect(h.nodes[2].present).toBe(true);
    expect(h.nodes[2].parentProductId).toBe("prod-basis");
    expect(h.nodes[2].variantKey).toBe("500g");
    expect(h.validation.valid).toBe(true);
  });

  it("fails closed when a product declares itself as its own basis product", () => {
    const h = buildCanonicalProductVariantHierarchy({
      ...baseForm,
      basis_product_id: "prod-1",
    });
    expect(h.validation.valid).toBe(false);
    expect(h.validation.errors[0]).toMatch(/own basis product/);
    expect(hasVariantParentageFields({ basis_product_id: "x" })).toBe(true);
    expect(hasVariantParentageFields({})).toBe(false);
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
    expect(resolution.validation.errors.some((e) => e.includes("Duplicate variant key"))).toBe(
      true,
    );
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

  it("allows a structurally valid set_parent mutation now that Core schema is live", () => {
    const result = validateVariantHierarchyMutation({
      kind: "set_parent",
      productId: "child",
      parentProductId: "parent",
    });
    expect(result.allowed).toBe(true);
  });

  it("rejects a set_parent mutation that would make a product its own basis product", () => {
    const result = validateVariantHierarchyMutation({
      kind: "set_parent",
      productId: "x",
      parentProductId: "x",
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/own basis product/);
  });

  it("rejects a set_parent mutation that would introduce a duplicate variant key", () => {
    const result = validateVariantHierarchyMutation(
      { kind: "set_parent", productId: "b", parentProductId: "basis", variantKey: "250g" },
      [{ productId: "a", parentProductId: "basis", variantKey: "250g", sku: "SKU-A" }],
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/Duplicate variant key/);
  });

  it("allows unlink_parent unconditionally (Core's ON DELETE RESTRICT/immutability guard is the real gate)", () => {
    const result = validateVariantHierarchyMutation({ kind: "unlink_parent", productId: "x" });
    expect(result.allowed).toBe(true);
  });

  it("binds Point 31 identity tab to Point 32 with parentage mutation now enabled (Core-gated)", () => {
    const binding = resolveEditorVariantBinding(baseForm);
    expect(binding.tab).toBe("identity");
    expect(binding.owner).toBe("Point32");
    expect(binding.canMutateParentage).toBe(true);
    expect(binding.sku).toBe("OAS-AS-BKL-CAS-RBOX-0001");
  });

  it("serializes snapshot schema point32_v1 with product_variants_row persistence", () => {
    const snap = serializeProductVariantHierarchyForSnapshot({
      ...baseForm,
      basis_product_id: "prod-basis",
      variant_key: "500g",
    });
    expect(snap.schema).toBe("point32_v1");
    expect(snap.scope).toBe("explicit_variant_graph");
    expect(snap.variant_graph.persistence).toBe("product_variants_row");
    expect(snap.variant_graph.explicit_edges[0]?.parentProductId).toBe("prod-basis");
    expect(snap.variant_graph.explicit_edges[0]?.variantKey).toBe("500g");
    expect(snap.pack_variant_separation.pack_hierarchy_owner).toBe("point33");
    expect(snap.composition_semantics.bom_parent_ref).toBe("product_bom_items.parent_product_id");
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

  it("allows save when hierarchy is valid", () => {
    expect(assertVariantHierarchySaveAllowed(baseForm)).toEqual({ ok: true });
  });

  it("allows save with an explicit, structurally valid basis product", () => {
    expect(
      assertVariantHierarchySaveAllowed({
        ...baseForm,
        basis_product_id: "prod-basis",
        variant_key: "500g",
      }),
    ).toEqual({ ok: true });
  });

  it("blocks save when a product declares itself as its own basis product", () => {
    const result = assertVariantHierarchySaveAllowed({
      ...baseForm,
      basis_product_id: "prod-1",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/own basis product/);
    }
  });
});
