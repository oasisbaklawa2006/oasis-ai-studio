/**
 * Maps a Catalogue Product AI Studio readiness category (all currently master-product-owned —
 * see catalogueProductReadiness.ts) to the Full Editor tab that actually owns that field, so a
 * missing-field chip can deep-link to the right place instead of always opening the product on
 * its default tab. Every key here must exist as a TabsTrigger value in ProductEdit.tsx.
 */
import type { ReadinessCategory } from "./catalogueProductReadiness";

const CATEGORY_TO_FULL_EDITOR_TAB: Record<ReadinessCategory["key"], string> = {
  identity: "identity",
  sku: "identity",
  category: "identity",
  hero_image: "media",
  pricing: "channels",
  catalogue_visibility: "identity",
  pack_size: "uom",
  carton_packaging: "uom",
  moq: "uom",
  shelf_storage: "compliance",
  export_compliance: "compliance",
};

/** Full Editor tab for a readiness category key — falls back to "identity" for any unknown key. */
export function fullEditorTabForCategory(categoryKey: string): string {
  return CATEGORY_TO_FULL_EDITOR_TAB[categoryKey] ?? "identity";
}

/** Deep-link URL into the Full Editor, pre-selecting the tab that owns the given category. */
export function fullEditorDeepLink(productId: string, categoryKey: string): string {
  return `/products/${productId}?tab=${fullEditorTabForCategory(categoryKey)}`;
}
