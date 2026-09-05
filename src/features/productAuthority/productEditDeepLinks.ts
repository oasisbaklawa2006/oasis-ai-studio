/** Canonical deep links for SCREEN_REGISTRY #29 (media) and #30 (aliases). */
export const PRODUCT_ALIASES_SECTION_ID = "product-language-terms";

export function productMediaDeepLink(productId: string): string {
  return `/products/${encodeURIComponent(productId)}?tab=media`;
}

export function productAliasesDeepLink(productId: string): string {
  return `/products/${encodeURIComponent(productId)}?tab=identity#${PRODUCT_ALIASES_SECTION_ID}`;
}
