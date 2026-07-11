/**
 * URL-authoritative product/tab selection for the Catalogue Product AI Studio page (owner-reported
 * smoke-test failures: browser Back/Forward and a repeat deep-link navigation did nothing, because
 * the selected product and active studio tab previously lived only in local `useState` — never in
 * the URL. Pulled out as pure functions so the fallback/URL-building rules are unit-testable without
 * a router or DOM; the page itself wires these to `useSearchParams()`.
 */
export const CATALOGUE_STUDIO_TABS = ["content", "language", "media", "packaging", "export"] as const;
export type CatalogueStudioTab = (typeof CATALOGUE_STUDIO_TABS)[number];

/** A stale/invalid ?tab= (old bookmark, hand-edited URL) must fall back to "content", never crash. */
export function resolveCatalogueStudioTab(rawTab: string | null): CatalogueStudioTab {
  return (CATALOGUE_STUDIO_TABS as readonly string[]).includes(rawTab ?? "")
    ? (rawTab as CatalogueStudioTab)
    : "content";
}

/** True only when the raw ?tab= value needs correcting (present but not a real tab). */
export function isInvalidCatalogueStudioTab(rawTab: string | null): boolean {
  return !!rawTab && !(CATALOGUE_STUDIO_TABS as readonly string[]).includes(rawTab);
}

/** Pure URLSearchParams transform for selecting a product — same shape passed to setSearchParams(). */
export function withSelectedProduct(prev: URLSearchParams, productId: string): URLSearchParams {
  const next = new URLSearchParams(prev);
  next.set("product", productId);
  return next;
}

/** Pure URLSearchParams transform for switching the active studio tab. */
export function withStudioTab(prev: URLSearchParams, tab: string): URLSearchParams {
  const next = new URLSearchParams(prev);
  next.set("tab", tab);
  return next;
}
