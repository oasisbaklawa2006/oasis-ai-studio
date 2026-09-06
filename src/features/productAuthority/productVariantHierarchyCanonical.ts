/**
 * Point 32 — canonical product ↔ variant hierarchy contract.
 *
 * Architecture-only closure: one deterministic modelling contract using existing Core
 * `products` row authority. No shadow schema, no inferred parentage from fuzzy names/SKU
 * tokens, and no absorption of Point 33 pack/carton hierarchy or Point 28 duplicate detection.
 */

/** Current sellable authority is one `products` row per SKU until Core variant table ships. */
export type ProductVariantScope = "product_sku" | "explicit_variant_graph";

export type VariantPersistence = "products_row" | "composition_only" | "core_blocked";

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
  /** Explicit parent product id when Core variant graph is available — never inferred. */
  parentProductId: string | null;
  /** Explicit variant key when Core variant table is available. */
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
  /** Exact Core gaps — do not shadow-persist variant parentage in AI Studio. */
  coreDependencies: string[];
  /** Point 33 owns pack/carton/pallet logistics — referenced only, never modelled here. */
  point33PackHierarchyAuthority: true;
};

export const POINT_32_CORE_DEPENDENCIES = {
  variantTable: [
    "product_variants table (id, product_id, variant_key, basis_sku, sku)",
    "products.basis_product_id or products.parent_product_id (variant parentage — distinct from BOM/hamper composition)",
    "deterministic variant_key uniqueness constraint per basis product",
  ],
  compositionSemantics: [
    "product_bom_items.parent_product_id / child_product_id — BOM composition only",
    "hampers.parent_product_id — hamper shell only",
  ],
} as const;

/** Form/row keys that must never be treated as variant parentage without Core schema. */
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

function collectCoreDependencies(): string[] {
  return [...POINT_32_CORE_DEPENDENCIES.variantTable];
}

/**
 * Resolve an explicit variant parent/child graph. Parentage must be supplied via deterministic
 * refs — never inferred from product name, SKU segment, or packaging_code.
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

/** Fail closed on unsupported or invalid variant hierarchy mutations. */
export function validateVariantHierarchyMutation(
  mutation: VariantHierarchyMutation,
  existingEdges: ExplicitVariantEdge[] = [],
): { allowed: boolean; reason?: string } {
  const coreBlockedReason =
    "Variant parentage mutations are Core-blocked until product_variants and basis_product_id ship in oasis-supabase-core.";

  if (mutation.kind === "set_parent" || mutation.kind === "set_variant_key") {
    return { allowed: false, reason: coreBlockedReason };
  }

  if (mutation.kind === "unlink_parent") {
    const hasExplicitParent = existingEdges.some(
      (edge) => edge.productId === mutation.productId && edge.parentProductId,
    );
    if (!hasExplicitParent) {
      return { allowed: true };
    }
    return { allowed: false, reason: coreBlockedReason };
  }

  return { allowed: false, reason: "Unsupported variant hierarchy mutation." };
}

/** True when a form row attempts to set variant parentage fields that Core does not own yet. */
export function hasUnsupportedVariantParentageFields(form: Record<string, unknown>): boolean {
  const blockedKeys = [
    "parent_product_id",
    "basis_product_id",
    "basis_sku",
    "variant_id",
    "variant_key",
    "parent_variant_id",
  ];
  return blockedKeys.some((key) => str(form[key]) != null);
}

/**
 * Build the canonical product/variant hierarchy for a single product form row.
 * Until Core variant schema ships, each row is a self-rooted sellable SKU.
 */
export function buildCanonicalProductVariantHierarchy(
  form: Record<string, unknown>,
): CanonicalProductVariantHierarchy {
  const errors: string[] = [];
  const warnings: string[] = [];
  const productId = str(form.id);
  const sku = str(form.sku);
  const packagingCode = str(form.packaging_code);

  if (hasUnsupportedVariantParentageFields(form)) {
    errors.push(
      "Variant parentage fields are present but Core schema is not deployed — remove parent_product_id / basis_sku / variant_key from the save payload.",
    );
  }

  if (packagingCode) {
    warnings.push(
      `packaging_code (${packagingCode}) is a structured SKU identity segment (Point 32) — not a variant option or pack hierarchy node (Point 33).`,
    );
  }

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
      parentProductId: null,
      variantKey: null,
      persistence: "core_blocked",
      sourceFields: [],
      present: false,
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
    scope: "product_sku",
    nodes,
    validation: {
      valid: errors.length === 0,
      errors,
      warnings,
    },
    coreDependencies: collectCoreDependencies(),
    point33PackHierarchyAuthority: true,
  };
}

/** Editor binding contract for Point 31 identity tab — deterministic, no inferred parentage. */
export function resolveEditorVariantBinding(form: Record<string, unknown>): {
  tab: "identity";
  owner: "Point32";
  productId: string | null;
  sku: string | null;
  scope: ProductVariantScope;
  canMutateParentage: false;
  hierarchy: CanonicalProductVariantHierarchy;
} {
  const hierarchy = buildCanonicalProductVariantHierarchy(form);
  return {
    tab: "identity",
    owner: "Point32",
    productId: hierarchy.productId,
    sku: hierarchy.sku,
    scope: hierarchy.scope,
    canMutateParentage: false,
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
    errors.push("Point 33 pack hierarchy must remain SKU-scoped — variant-scoped pack trees are Core-blocked.");
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
    persistence: "core_blocked";
    core_dependencies: string[];
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
      persistence: "core_blocked",
      core_dependencies: canonical.coreDependencies,
      explicit_edges: canonical.productId
        ? [
            {
              productId: canonical.productId,
              parentProductId: null,
              variantKey: str(form.packaging_code) ? `pkg:${str(form.packaging_code)}` : null,
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
