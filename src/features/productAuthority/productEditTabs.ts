/**
 * The Full Editor's real TabsTrigger values (ProductEdit.tsx). Kept here, separate from the page,
 * so the ?tab= deep-link validation is unit-testable without a router or DOM (Bugbot-caught: an
 * unvalidated deep-link tab value left the Tabs control on a non-existent panel with no fallback).
 */
export const PRODUCT_EDIT_TABS = [
  "identity",
  "uom",
  "media",
  "private_label",
  "customisation",
  "dimensions",
  "frozen",
  "bom",
  "channels",
  "compliance",
  "ops",
  "product_truth",
] as const;

export type ProductEditTab = (typeof PRODUCT_EDIT_TABS)[number];

/** Less-frequent specialist domains hidden behind progressive disclosure in the editor shell. */
export const ADVANCED_PRODUCT_EDIT_TABS = [
  "private_label",
  "customisation",
  "dimensions",
  "frozen",
  "bom",
  "ops",
] as const satisfies readonly ProductEditTab[];

export function isAdvancedProductEditTab(tab: string): boolean {
  return (ADVANCED_PRODUCT_EDIT_TABS as readonly string[]).includes(tab);
}

/** A stale/mistyped ?tab= (old bookmark, hand-built deep link) falls back to "identity", never blank. */
export function resolveProductEditTab(rawTab: string | null): ProductEditTab {
  return (PRODUCT_EDIT_TABS as readonly string[]).includes(rawTab ?? "")
    ? (rawTab as ProductEditTab)
    : "identity";
}
