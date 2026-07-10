/**
 * Fast Create draft snapshot (session-scoped) + Full Editor handoff.
 *
 * Single-entry principle: everything the operator answers in Fast Create (sale type,
 * packaging, prices, qty per pack, edited suggestion text) is carried into the Full
 * Editor form patch so it is never asked twice. Persistence caveats stay honest:
 * `sale_type` has no products column (mapped onto product_class where one exists) and
 * price fields are read-model-only for this app (pricing write authority remains the
 * governed Sales Pricing Rules flow).
 */
import type { FastCreateCategoryKey } from "@/features/productDefaults/categoryDefaults";
import type { SaleType } from "@/features/productAuthority/saleType";
import { getSaleTypeRequirements, productClassForSaleType } from "@/features/productAuthority/saleType";
import { labelStarterFromPack } from "@/features/productAuthority/packLogic";
import type { ReadinessCategoryLike } from "@/features/productAuthority/buildMeter";
import type { FastCreateSuggestions } from "./fastCreateSuggestions";

export const FAST_CREATE_DRAFT_STORAGE_KEY = "oasis-fast-create-draft-v2";

export type FastCreateDraftSnapshot = {
  productName: string;
  categoryKey: FastCreateCategoryKey;
  saleType: SaleType;
  packagingCode: string | null;
  packagingLabel: string | null;
  qtyPerPack: string;
  mrp: string;
  b2bPrice: string;
  b2bEnabled: boolean;
  heroUrl: string | null;
  resolvedSku: string | null;
  suggestions: FastCreateSuggestions | null;
  /** Operator-edited suggestion text (overrides generated values). */
  editedDescription: string | null;
  editedAliases: string | null;
  editedWhatsappKeywords: string | null;
};

export function emptyFastCreateDraft(): FastCreateDraftSnapshot {
  return {
    productName: "",
    categoryKey: "baklawa",
    saleType: "retail_ready_pack",
    packagingCode: null,
    packagingLabel: null,
    qtyPerPack: "",
    mrp: "",
    b2bPrice: "",
    b2bEnabled: false,
    heroUrl: null,
    resolvedSku: null,
    suggestions: null,
    editedDescription: null,
    editedAliases: null,
    editedWhatsappKeywords: null,
  };
}

export function loadFastCreateDraft(): FastCreateDraftSnapshot | null {
  try {
    const raw = sessionStorage.getItem(FAST_CREATE_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    return { ...emptyFastCreateDraft(), ...(JSON.parse(raw) as Partial<FastCreateDraftSnapshot>) };
  } catch {
    return null;
  }
}

export function saveFastCreateDraft(snapshot: FastCreateDraftSnapshot) {
  try {
    sessionStorage.setItem(FAST_CREATE_DRAFT_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* sessionStorage unavailable — draft simply won't survive navigation */
  }
}

export function clearFastCreateDraft() {
  try {
    sessionStorage.removeItem(FAST_CREATE_DRAFT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Fast Create build-meter categories — required set adapts to the selected sale type. */
export function fastCreateReadinessCategories(draft: FastCreateDraftSnapshot): ReadinessCategoryLike[] {
  const req = getSaleTypeRequirements(draft.saleType, { b2bEnabled: draft.b2bEnabled });
  const categories: ReadinessCategoryLike[] = [];

  categories.push({
    key: "name",
    label: "Product name",
    state: draft.productName.trim() ? "pass" : "missing",
    nextAction: draft.productName.trim() ? null : "Enter a product name.",
  });

  categories.push({
    key: "sku",
    label: "SKU",
    state: draft.resolvedSku ? "pass" : "warn",
    nextAction: draft.resolvedSku ? null : "Generate the structured SKU.",
  });

  if (req.requiresPackaging) {
    categories.push({
      key: "packaging",
      label: "Packaging",
      state: draft.packagingCode ? "pass" : "missing",
      nextAction: draft.packagingCode ? null : "Select the packaging type.",
    });
  }

  if (req.requiresQtyPerPack) {
    const qty = Number(draft.qtyPerPack);
    categories.push({
      key: "qty_per_pack",
      label: "Qty per pack",
      state: Number.isFinite(qty) && qty > 0 ? "pass" : "missing",
      nextAction: Number.isFinite(qty) && qty > 0 ? null : "Enter pieces per pack.",
    });
  }

  if (req.requiresMrp) {
    const mrp = Number(draft.mrp);
    categories.push({
      key: "mrp",
      label: "MRP",
      state: Number.isFinite(mrp) && mrp > 0 ? "pass" : "missing",
      nextAction: Number.isFinite(mrp) && mrp > 0 ? null : "Enter MRP.",
    });
  }

  if (req.requiresB2bPrice) {
    const b2b = Number(draft.b2bPrice);
    categories.push({
      key: "b2b_price",
      label: "B2B price",
      state: Number.isFinite(b2b) && b2b > 0 ? "pass" : "missing",
      nextAction: Number.isFinite(b2b) && b2b > 0 ? null : "Enter B2B price.",
    });
  }

  if (req.requiresHeroImage) {
    categories.push({
      key: "hero",
      label: "Hero image",
      state: draft.heroUrl ? "pass" : "missing",
      nextAction: draft.heroUrl ? null : "Upload a product image.",
    });
  }

  if (req.requiresExportFields) {
    categories.push({
      key: "export_fields",
      label: "Export details",
      state: "warn",
      nextAction: "Complete export fields in Full Editor.",
    });
  }

  return categories;
}

export function fastCreateReadinessScore(categories: ReadinessCategoryLike[]): number {
  if (categories.length === 0) return 0;
  const points: Record<ReadinessCategoryLike["state"], number> = { pass: 2, warn: 1, missing: 0 };
  const earned = categories.reduce((sum, c) => sum + points[c.state], 0);
  return Math.round((earned / (categories.length * 2)) * 100);
}

/**
 * Full Editor form patch from a Fast Create draft — the handoff that stops the same
 * data being asked twice. Only fields the form already understands are emitted.
 */
export function fastCreateFormPatchFromDraft(draft: FastCreateDraftSnapshot): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    ...(draft.suggestions?.formPatch ?? {}),
    product_name: draft.productName.trim(),
  };

  const productClass = productClassForSaleType(draft.saleType);
  if (productClass) patch.product_class = productClass;
  if (draft.heroUrl) patch.hero_image_url = draft.heroUrl;
  if (draft.resolvedSku) patch.sku = draft.resolvedSku;
  if (draft.packagingCode) patch.packaging_code = draft.packagingCode;
  if (draft.qtyPerPack && Number(draft.qtyPerPack) > 0) patch.pcs_per_pack = draft.qtyPerPack;
  if (draft.mrp && Number(draft.mrp) > 0) patch.mrp = draft.mrp;
  if (draft.b2bPrice && Number(draft.b2bPrice) > 0) patch.b2b_price = draft.b2bPrice;
  if (draft.editedDescription != null && draft.editedDescription.trim()) {
    patch.description = draft.editedDescription.trim();
  }

  const labelStarter = labelStarterFromPack(
    draft.qtyPerPack ? Number(draft.qtyPerPack) : null,
    String(patch.primary_uom ?? "box"),
    draft.packagingLabel,
  );
  if (labelStarter) patch.pack_size = labelStarter;

  return patch;
}
