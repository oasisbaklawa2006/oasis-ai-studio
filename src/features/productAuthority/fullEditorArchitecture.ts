/**
 * Point 31 — canonical Full Editor shell / router / state-orchestration contract.
 *
 * Architecture-only: defines routes, tab/domain ownership, identity resolution, and the
 * single governed save boundary. Field/workflow/media domain rules remain owned by downstream
 * programme points (32–47, 53).
 */
import type { ProductEditTab } from "./productEditTabs";
import { PRODUCT_EDIT_TABS, resolveProductEditTab } from "./productEditTabs";

/** Page component that hosts the authoritative Full Editor shell. */
export const FULL_EDITOR_SHELL_PAGE = "ProductEdit";

/** Authoritative Full Editor entry routes — all product master writes flow through these. */
export const FULL_EDITOR_CANONICAL_ROUTES = {
  /** Create flow — `ProductEdit` with `id === "new"`. */
  create: "/products/new",
  /** Edit flow — `ProductEdit` with a persisted product id. */
  edit: "/products/:id",
  /** SCREEN #29 — redirects to `?tab=media`. */
  mediaDeepLink: "/products/:id/media",
  /** SCREEN #30 — redirects to identity tab + `#product-language-terms`. */
  aliasesDeepLink: "/products/:id/aliases",
} as const;

/**
 * Routes that must never be treated as product-master authoring authority.
 * Retained code may exist for future activation; these paths are explicitly non-authoritative.
 */
export const FULL_EDITOR_NON_AUTHORITATIVE_ROUTES = [
  "/admin/catalogue-builder",
  "/catalogues",
  "/catalogues/:id",
  "/catalogues/:id/proposal",
  "/hampers",
  "/ingredients",
  "/labels",
  "/label-queue",
  "/tags",
] as const;

/** Fast Create is a separate governed create tier; handoff pre-fills Full Editor only. */
export const FULL_EDITOR_HANDOFF_ROUTES = {
  fastCreate: "/products/new/fast",
  catalogueStudio: "/admin/catalogue-product-studio",
} as const;

/** localStorage key prefix for last-selected tab per product. */
export const FULL_EDITOR_TAB_STORAGE_PREFIX = "oasis_product_edit_tab_";

/** localStorage key prefix for autosaved form drafts (non-authoritative resilience only). */
export const FULL_EDITOR_FORM_DRAFT_PREFIX = "catalogue_product_form_draft_";

/** Downstream programme point that owns each Full Editor tab's field domain. */
export type FullEditorDomainOwner =
  | "Point26" // product master / identity shell
  | "Point32" // product/variant hierarchy, aliases, language terms
  | "Point33" // pack / carton / pallet / UOM
  | "Point34" // compliance fields
  | "Point35" // dimensions / weight / CBM
  | "Point36" // frozen / shelf-life
  | "Point37" // BOM
  | "Point38" // channel pricing (draft/approval semantics)
  | "Point39" // MOQ / contributor draft workflow
  | "Point40" // ops notes
  | "Point41" // media workflow
  | "Point42" // private label
  | "Point43" // customisation
  | "Point44" // product truth panels
  | "Point53"; // deferred-detail semantics (product_truth tab)

export type FullEditorTabDomainContract = {
  tab: ProductEditTab;
  owner: FullEditorDomainOwner;
  /** Human-readable scope — architecture map only, not field validation. */
  scope: string;
};

/**
 * Deterministic tab → downstream domain ownership map.
 * Point 31 provides the shell; each tab's field rules are owned by the listed point.
 */
export const FULL_EDITOR_TAB_DOMAIN_OWNERSHIP: readonly FullEditorTabDomainContract[] = [
  { tab: "identity", owner: "Point32", scope: "Name, class, SKU, departments, aliases" },
  { tab: "uom", owner: "Point33", scope: "Pack sizes, UOM, carton logic, MOQ display" },
  { tab: "media", owner: "Point41", scope: "Hero image and governed product media" },
  { tab: "private_label", owner: "Point42", scope: "Private-label MOQ and cost terms" },
  { tab: "customisation", owner: "Point43", scope: "Customisation types and notes" },
  { tab: "dimensions", owner: "Point35", scope: "Shipping dimensions, weight, CBM" },
  { tab: "frozen", owner: "Point36", scope: "Frozen shelf-life fields" },
  { tab: "bom", owner: "Point37", scope: "Bill of materials composition" },
  { tab: "channels", owner: "Point38", scope: "Channel pricing rules (approval-governed)" },
  { tab: "compliance", owner: "Point34", scope: "Ingredients, allergens, label compliance" },
  { tab: "ops", owner: "Point40", scope: "Operational and pricing notes" },
  {
    tab: "product_truth",
    owner: "Point53",
    scope: "Product Truth panels — deferred-detail semantics",
  },
];

/** Readiness-category → Full Editor tab (Catalogue Studio deep-link bridge). */
export const FULL_EDITOR_READINESS_CATEGORY_TAB_MAP: Record<string, ProductEditTab> = {
  identity: "identity",
  sku: "identity",
  category: "identity",
  catalogue_visibility: "identity",
  hero_image: "media",
  pricing: "channels",
  pack_size: "uom",
  carton_packaging: "uom",
  moq: "uom",
  shelf_storage: "compliance",
  export_compliance: "compliance",
};

export function fullEditorTabForReadinessCategory(categoryKey: string): ProductEditTab {
  return FULL_EDITOR_READINESS_CATEGORY_TAB_MAP[categoryKey] ?? "identity";
}

export function resolveFullEditorTabOwner(tab: string): FullEditorTabDomainContract | null {
  if (!(PRODUCT_EDIT_TABS as readonly string[]).includes(tab)) {
    return null;
  }
  return FULL_EDITOR_TAB_DOMAIN_OWNERSHIP.find((entry) => entry.tab === tab) ?? null;
}

export function assertKnownFullEditorTab(tab: string): ProductEditTab | null {
  return (PRODUCT_EDIT_TABS as readonly string[]).includes(tab) ? (tab as ProductEditTab) : null;
}

export type FullEditorIdentity =
  | { kind: "create"; routeId: "new" }
  | { kind: "edit"; routeId: string; productId: string }
  | { kind: "invalid"; reason: string };

/** Fail closed when the route does not resolve to a known create or edit identity. */
export function resolveFullEditorIdentity(routeId: string | undefined): FullEditorIdentity {
  const trimmed = routeId?.trim() ?? "";
  if (!trimmed || trimmed === "new") {
    return { kind: "create", routeId: "new" };
  }
  if (trimmed.length < 2) {
    return { kind: "invalid", reason: "Product identity is unresolved — invalid product id." };
  }
  return { kind: "edit", routeId: trimmed, productId: trimmed };
}

export function isFullEditorCreateIdentity(identity: FullEditorIdentity): boolean {
  return identity.kind === "create";
}

/**
 * True when the loaded product row does not match the current route id, or a fetch is still
 * in flight — save must fail closed until identity is reconciled.
 */
export function hasFullEditorIdentityConflict(
  identity: FullEditorIdentity,
  loadedId: string | null,
  fetchPending: boolean,
): boolean {
  if (identity.kind === "invalid") return true;
  if (identity.kind === "create") return fetchPending;
  if (fetchPending) return true;
  return loadedId !== identity.productId;
}

export type FullEditorSavePathKind = "direct_write" | "contributor_draft" | "blocked";

export type FullEditorSavePath =
  | { kind: "direct_write"; allowed: true }
  | { kind: "contributor_draft"; allowed: true }
  | { kind: "blocked"; allowed: false; reason: string };

export type FullEditorSaveBoundaryInput = {
  identity: FullEditorIdentity;
  canDirectWrite: boolean;
  isContributor: boolean;
  fetchPending: boolean;
  loadedId: string | null;
  /** Direct publish/write is never supported for unresolved or conflicting sessions. */
  allowDirectPublish?: boolean;
};

/**
 * Single governed save boundary for the Full Editor shell.
 * Direct `products` writes and contributor `catalogue_product_drafts` are the only allowed paths.
 */
export function resolveFullEditorSavePath(input: FullEditorSaveBoundaryInput): FullEditorSavePath {
  const {
    identity,
    canDirectWrite,
    isContributor,
    fetchPending,
    loadedId,
    allowDirectPublish = true,
  } = input;

  if (identity.kind === "invalid") {
    return {
      kind: "blocked",
      allowed: false,
      reason: identity.reason,
    };
  }

  if (hasFullEditorIdentityConflict(identity, loadedId, fetchPending)) {
    return {
      kind: "blocked",
      allowed: false,
      reason: "Save blocked — product identity is still loading or conflicts with the open session.",
    };
  }

  if (canDirectWrite) {
    if (!allowDirectPublish) {
      return {
        kind: "blocked",
        allowed: false,
        reason: "Direct publish is not supported for this product session.",
      };
    }
    return { kind: "direct_write", allowed: true };
  }

  if (isContributor) {
    return { kind: "contributor_draft", allowed: true };
  }

  return {
    kind: "blocked",
    allowed: false,
    reason: "Read-only mode: you do not have permission to save products.",
  };
}

export function fullEditorTabStorageKey(routeId: string | null | undefined): string {
  return `${FULL_EDITOR_TAB_STORAGE_PREFIX}${routeId ?? "new"}`;
}

export function fullEditorFormDraftKey(identity: FullEditorIdentity): string {
  if (identity.kind === "create") {
    return `${FULL_EDITOR_FORM_DRAFT_PREFIX}new`;
  }
  if (identity.kind === "edit") {
    return `${FULL_EDITOR_FORM_DRAFT_PREFIX}${identity.productId}`;
  }
  return `${FULL_EDITOR_FORM_DRAFT_PREFIX}invalid`;
}

export type FullEditorTabStateInput = {
  rawDeepLinkTab: string | null;
  persistedTab: string | null;
  locationKey: string;
  appliedLocationKey: string;
};

export type FullEditorTabStateResult = {
  initialTab: ProductEditTab;
  deepLinkTab: ProductEditTab | null;
  shouldApplyDeepLink: boolean;
};

/**
 * Tab orchestration contract: deep-link `?tab=` wins on navigation; otherwise persisted tab;
 * unknown tabs fail closed to `identity`.
 */
export function resolveFullEditorTabState(input: FullEditorTabStateInput): FullEditorTabStateResult {
  const deepLinkTab = input.rawDeepLinkTab ? resolveProductEditTab(input.rawDeepLinkTab) : null;
  const persisted = input.persistedTab ? resolveProductEditTab(input.persistedTab) : null;
  const initialTab = deepLinkTab ?? persisted ?? "identity";
  const shouldApplyDeepLink =
    !!deepLinkTab && input.appliedLocationKey !== input.locationKey;
  return { initialTab, deepLinkTab, shouldApplyDeepLink };
}

export function buildFullEditorEditPath(productId: string, tab?: ProductEditTab): string {
  const base = `/products/${encodeURIComponent(productId)}`;
  if (!tab || tab === "identity") return base;
  return `${base}?tab=${tab}`;
}

export function buildFullEditorCreatePath(): string {
  return FULL_EDITOR_CANONICAL_ROUTES.create;
}
