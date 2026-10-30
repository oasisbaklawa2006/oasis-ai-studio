/**
 * Canonical Studio hand-offs for one product. These routes preserve the Core product id;
 * catalogue copy and media remain separate governed workspaces, never shadow product masters.
 */
function encodedProductId(productId: string): string {
  return encodeURIComponent(productId.trim());
}

export function productEditorRoute(productId: string): string {
  return `/products/${encodedProductId(productId)}`;
}

export function productMediaRoute(productId: string): string {
  return `${productEditorRoute(productId)}/media`;
}

export function productCatalogueCopyRoute(productId: string): string {
  return `/admin/catalogue-product-studio?product=${encodedProductId(productId)}`;
}

export const catalogueBuilderRoute = "/admin/catalogue-builder";
