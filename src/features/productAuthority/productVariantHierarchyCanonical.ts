/**
 * Point 32 — canonical product ↔ variant hierarchy contract.
 *
 * Core authority: `oasis-supabase-core` migration
 * `20260915240000_point32_product_variant_authority.sql` (Core PR #310) is live on Core `main`
 * — `products.basis_product_id`, the `product_variants` table, and their RLS/uniqueness/
 * fail-closed identity-lock triggers are real, deployed Core authority. This module binds to
 * that contract; it does not shadow it. No inferred parentage from fuzzy names/SKU tokens, and
 * no absorption of Point 33 pack/carton hierarchy or Point 28 duplicate detection.
 */

/** Explicit variant graph is now real Core authority (product_variants + basis_product_id). */
export type ProductVariantScope = "product_sku" | "explicit_variant_graph";

export type VariantPersistence = "products_row" | "composition_only" | "product_variants_row";

export type VariantHierarchyLevel =
  | "basis_product"
  | "sellable_sku"
  | "variant_option"
  | "composition_child";

export type VariantHierarchyNode = {
  level: VariantHierarchyLevel;
  label: string;
  productId: string | null;
  sku: string | null;
  /** Explicit parent product id — sourced from Core's `products.basis_product_id`, never inferred. */
  parentProductId: string | null;
  /** Explicit variant key — sourced from Core's `product_variants.variant_key`, never inferred. */
  variantKey: string | null;
  persistence: VariantPersistence;
  sourceFields: string[];
  present: boolean;
};

export type CanonicalProductVariantHierarchy = {
  productId: string | null;
  sku: string | null;
  scope: ProductVariantScope;
  nodes: VariantHierarchyNode[];
  validation: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
  /** Point 33 owns pack/carton/pallet logistics — referenced only, never modelled here. */
  point33PackHierarchyAuthority: true;
};

/** Documents the live Core contract this module binds to (Core PR #310). */
export const POINT_32_CORE_AUTHORITY = {
  migration: "20260915240000_point32_product_variant_authority.sql",
  variantTable: [
    "product_variants (id, product_id, basis_product_id, variant_key, basis_sku, sku) — live",
    "products.basis_product_id — live, self-referencing FK, immutable once a variant graph exists",
    "product_variants_basis_variant_key_unique (basis_product_id, variant_key) — deterministic Core uniqueness constraint",
  ],
  writeAuthority:
    "product_variants INSERT/UPDATE/DELETE is gated by Core RLS policy requiring public.is_admin(); AI Studio never bypasses this client-side.",
  compositionSemantics: [
    "product_bom_items.parent_product_id / child_product_id — BOM composition only",
    "hampers.parent_product_id — hamper shell only",
  ],
} as const;

/** Form/row keys that carry explicit (never inferred) variant parentage. */
export const VARIANT_PARENTAGE_FIELD_KEYS = ["basis_product_id", "variant_key"] as const;

/** Form/row keys that must never be treated as variant parentage, even now that Core ships it. */
export const FORBIDDEN_INFERRED_VARIANT_FIELDS = [
  "product_family",
  "product_type",
  "packaging_code",
  "pack_size",
  "short_name",
  "product_name",
] as const;

export type ExplicitVariantEdge = {
  productId: string;
  parentProductId: string | null;
  variantKey: string | null;
  sku: string | null;
};

export type VariantGraphResolution = {
  roots: string[];
  childrenByParent: Map<string, string[]>;
  parentByChild: Map<string, string>;
  variantKeyByProduct: Map<string, string>;
  validation: CanonicalProductVariantHierarchy["validation"];
};

export type VariantHierarchyMutation =
  | { kind: "set_parent"; productId: string; parentProductId: string; variantKey?: string | null }
  | { kind: "set_variant_key"; productId: string; variantKey: string }
  | { kind: "unlink_parent"; productId: string };

function str(v: unknown): string | null {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  return s || null;
}

/**
 * Resolve an explicit variant parent/child graph. Parentage must be supplied via deterministic
 * refs — never inferred from product name, SKU segment, or packaging_code. Mirrors the
 * structural guards Core's own triggers enforce server-side (self-parent, ambiguous base,
 * duplicate variant_key), so invalid graphs fail closed in the UI before a write is attempted.
 */
export function resolveVariantGraph(edges: ExplicitVariantEdge[]): VariantGraphResolution {
  const errors: string[] = [];
  const warnings: string[] = [];
  const childrenByParent = new Map<string, string[]>();
  const parentByChild = new Map<string, string>();
  const variantKeyByProduct = new Map<string, string>();
  const variantKeyOwners = new Map<string, string>();
  const allIds = new Set<string>();

  for (const edge of edges) {
    allIds.add(edge.productId);
    if (edge.parentProductId) allIds.add(edge.parentProductId);

    if (edge.variantKey) {
      const existingOwner = variantKeyOwners.get(edge.variantKey);
      if (existingOwner && existingOwner !== edge.productId) {
        errors.push(
          `Duplicate variant key "${edge.variantKey}" across products ${existingOwner} and ${edge.productId}.`,
        );
      } else {
        variantKeyOwners.set(edge.variantKey, edge.productId);
        variantKeyByProduct.set(edge.productId, edge.variantKey);
      }
    }

    if (!edge.parentProductId) continue;

    if (edge.parentProductId === edge.productId) {
      errors.push(`Cyclic parentage: product ${edge.productId} cannot be its own parent.`);
      continue;
    }

    const existingParent = parentByChild.get(edge.productId);
    if (existingParent && existingParent !== edge.parentProductId) {
      errors.push(
        `Ambiguous base product for ${edge.productId}: multiple parents (${existingParent}, ${edge.parentProductId}).`,
      );
      continue;
    }

    parentByChild.set(edge.productId, edge.parentProductId);
    const siblings = childrenByParent.get(edge.parentProductId) ?? [];
    siblings.push(edge.productId);
    childrenByParent.set(edge.parentProductId, siblings);
  }

  for (const childId of parentByChild.keys()) {
    const visited = new Set<string>();
    let cursor: string | undefined = childId;
    while (cursor) {
      if (visited.has(cursor)) {
        errors.push(`Cyclic parentage detected involving product ${childId}.`);
        break;
      }
      visited.add(cursor);
      cursor = parentByChild.get(cursor);
    }
  }

  const childIds = new Set(parentByChild.keys());
  const roots = [...allIds].filter((id) => !childIds.has(id)).sort();

  if (edges.some((e) => e.parentProductId) && roots.length !== 1) {
    warnings.push(
      roots.length === 0
        ? "Variant graph has no root — all nodes participate in a cycle."
        : `Variant graph has ${roots.length} roots (${roots.join(", ")}) — expected exactly one basis product.`,
    );
  }

  return {
    roots,
    childrenByParent,
    parentByChild,
    variantKeyByProduct,
    validation: {
      valid: errors.length === 0,
      errors,
      warnings,
    },
  };
}

/**
 * Structural validation for variant hierarchy mutations. Core's RLS (`public.is_admin()`) and
 * triggers (`enforce_product_variant_identity_v1`, `enforce_product_point32_identity_immutable_v1`)
 * are the real authority; this only fails closed on shapes Core would reject anyway, so the UI
 * never submits a doomed write.
 */
export function validateVariantHierarchyMutation(
  mutation: VariantHierarchyMutation,
  existingEdges: ExplicitVariantEdge[] = [],
): { allowed: boolean; reason?: string } {
  if (mutation.kind === "set_parent") {
    if (mutation.parentProductId === mutation.productId) {
      return { allowed: false, reason: "A product cannot be its own basis product." };
    }
    const candidateEdges: ExplicitVariantEdge[] = [
      ...existingEdges.filter((e) => e.productId !== mutation.productId),
      {
        productId: mutation.productId,
        parentProductId: mutation.parentProductId,
        variantKey: mutation.variantKey ?? null,
        sku: null,
      },
    ];
    const resolution = resolveVariantGraph(candidateEdges);
    if (!resolution.validation.valid) {
      return { allowed: false, reason: resolution.validation.errors.join(" ") };
    }
    return { allowed: true };
  }

  if (mutation.kind === "set_variant_key") {
    const candidateEdges: ExplicitVariantEdge[] = existingEdges.map((e) =>
      e.productId === mutation.productId ? { ...e, variantKey: mutation.variantKey } : e,
    );
    const resolution = resolveVariantGraph(candidateEdges);
    if (!resolution.validation.valid) {
      return { allowed: false, reason: resolution.validation.errors.join(" ") };
    }
    return { allowed: true };
  }

  if (mutation.kind === "unlink_parent") {
    return { allowed: true };
  }

  return { allowed: false, reason: "Unsupported variant hierarchy mutation." };
}

/** True when a form row carries explicit (Core-backed) variant parentage fields. */
export function hasVariantParentageFields(form: Record<string, unknown>): boolean {
  return VARIANT_PARENTAGE_FIELD_KEYS.some((key) => str(form[key]) != null);
}

/**
 * Build the canonical product/variant hierarchy for a single product form row.
 * `basis_product_id` / `variant_key` are read directly from the form when present — both are
 * now real `products` / `product_variants` columns (Core PR #310), never inferred.
 */
export function buildCanonicalProductVariantHierarchy(
  form: Record<string, unknown>,
): CanonicalProductVariantHierarchy {
  const errors: string[] = [];
  const warnings: string[] = [];
  const productId = str(form.id);
  const sku = str(form.sku);
  const packagingCode = str(form.packaging_code);
  const basisProductId = str(form.basis_product_id);
  const variantKey = str(form.variant_key);

  if (basisProductId && productId && basisProductId === productId) {
    errors.push(
      "A product cannot be its own basis product (products_basis_product_not_self_check).",
    );
  }

  if (packagingCode) {
    warnings.push(
      `packaging_code (${packagingCode}) is a structured SKU identity segment (Point 32) — not a variant option or pack hierarchy node (Point 33).`,
    );
  }

  const hasExplicitVariant = !!(basisProductId || variantKey);

  const nodes: VariantHierarchyNode[] = [
    {
      level: "basis_product",
      label: "Basis product (sellable SKU row)",
      productId,
      sku,
      parentProductId: null,
      variantKey: null,
      persistence: "products_row",
      sourceFields: ["id", "sku", "product_name"],
      present: !!(productId || sku),
    },
    {
      level: "sellable_sku",
      label: "Sellable SKU identity",
      productId,
      sku,
      parentProductId: null,
      variantKey: packagingCode ? `pkg:${packagingCode}` : null,
      persistence: "products_row",
      sourceFields: ["sku", "packaging_code", "serial_no"],
      present: !!sku,
    },
    {
      level: "variant_option",
      label: "Explicit variant option (flavour/size/pack format)",
      productId,
      sku,
      parentProductId: basisProductId,
      variantKey,
      persistence: "product_variants_row",
      sourceFields: ["basis_product_id", "product_variants.variant_key"],
      present: hasExplicitVariant,
    },
    {
      level: "composition_child",
      label: "BOM / hamper composition child",
      productId,
      sku,
      parentProductId: null,
      variantKey: null,
      persistence: "composition_only",
      sourceFields: ["product_bom_items.child_product_id", "hamper_items.child_product_id"],
      present: false,
    },
  ];

  return {
    productId,
    sku,
    scope: hasExplicitVariant ? "explicit_variant_graph" : "product_sku",
    nodes,
    validation: {
      valid: errors.length === 0,
      errors,
      warnings,
    },
    point33PackHierarchyAuthority: true,
  };
}

/** Editor binding contract for Point 31 identity tab. Parentage is settable via Core RLS (admin). */
export function resolveEditorVariantBinding(form: Record<string, unknown>): {
  tab: "identity";
  owner: "Point32";
  productId: string | null;
  sku: string | null;
  scope: ProductVariantScope;
  canMutateParentage: true;
  hierarchy: CanonicalProductVariantHierarchy;
} {
  const hierarchy = buildCanonicalProductVariantHierarchy(form);
  return {
    tab: "identity",
    owner: "Point32",
    productId: hierarchy.productId,
    sku: hierarchy.sku,
    scope: hierarchy.scope,
    canMutateParentage: true,
    hierarchy,
  };
}

/** Enforce separation between Point 32 sellable identity and Point 33 logistics hierarchy. */
export function assertPackNotVariantHierarchy(input: {
  packagingCode: string | null;
  packHierarchyVariantScope: "product_sku";
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (input.packHierarchyVariantScope !== "product_sku") {
    errors.push(
      "Point 33 pack hierarchy must remain SKU-scoped — variant-scoped pack trees are not modelled here.",
    );
  }
  if (input.packagingCode && input.packagingCode.toLowerCase() === "variant") {
    errors.push(
      'packaging_code "variant" is ambiguous — use structured SKU segments (e.g. BULK, RBOX) not variant hierarchy labels.',
    );
  }
  return { valid: errors.length === 0, errors };
}

export type SnapshotProductVariantHierarchy = {
  schema: "point32_v1";
  scope: ProductVariantScope;
  basis_product: {
    product_id: string | null;
    sku: string | null;
    product_name: string | null;
    packaging_code: string | null;
    persistence: "products_row";
  };
  variant_graph: {
    persistence: "product_variants_row";
    core_authority: readonly string[];
    explicit_edges: ExplicitVariantEdge[];
  };
  composition_semantics: {
    bom_parent_ref: "product_bom_items.parent_product_id";
    hamper_parent_ref: "hampers.parent_product_id";
    note: "Composition parent/child refs are not sellable variant parentage.";
  };
  pack_variant_separation: {
    packaging_code_role: "sku_identity_segment";
    pack_hierarchy_owner: "point33";
  };
  validation: CanonicalProductVariantHierarchy["validation"];
};

export function serializeProductVariantHierarchyForSnapshot(
  form: Record<string, unknown>,
): SnapshotProductVariantHierarchy {
  const canonical = buildCanonicalProductVariantHierarchy(form);
  const basisProductId = str(form.basis_product_id);
  const variantKey = str(form.variant_key);

  return {
    schema: "point32_v1",
    scope: canonical.scope,
    basis_product: {
      product_id: canonical.productId,
      sku: canonical.sku,
      product_name: str(form.product_name),
      packaging_code: str(form.packaging_code),
      persistence: "products_row",
    },
    variant_graph: {
      persistence: "product_variants_row",
      core_authority: POINT_32_CORE_AUTHORITY.variantTable,
      explicit_edges: canonical.productId
        ? [
            {
              productId: canonical.productId,
              parentProductId: basisProductId,
              variantKey:
                variantKey ?? (str(form.packaging_code) ? `pkg:${str(form.packaging_code)}` : null),
              sku: canonical.sku,
            },
          ]
        : [],
    },
    composition_semantics: {
      bom_parent_ref: "product_bom_items.parent_product_id",
      hamper_parent_ref: "hampers.parent_product_id",
      note: "Composition parent/child refs are not sellable variant parentage.",
    },
    pack_variant_separation: {
      packaging_code_role: "sku_identity_segment",
      pack_hierarchy_owner: "point33",
    },
    validation: canonical.validation,
  };
}

/** Save-time guard — fail closed when variant hierarchy validation fails. */
export function assertVariantHierarchySaveAllowed(
  form: Record<string, unknown>,
): { ok: true } | { ok: false; reason: string } {
  const hierarchy = buildCanonicalProductVariantHierarchy(form);
  if (!hierarchy.validation.valid) {
    return { ok: false, reason: hierarchy.validation.errors.join(" ") };
  }
  const packSeparation = assertPackNotVariantHierarchy({
    packagingCode: str(form.packaging_code),
    packHierarchyVariantScope: "product_sku",
  });
  if (!packSeparation.valid) {
    return { ok: false, reason: packSeparation.errors.join(" ") };
  }
  return { ok: true };
}
