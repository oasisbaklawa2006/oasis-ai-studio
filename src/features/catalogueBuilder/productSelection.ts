/** Keep the Add action tied to an actually loaded collection and one selectable product. */
export function isSelectedCatalogueProductAvailable(
  selectedProductId: string,
  availableProducts: ReadonlyArray<{ id: string }>,
  activeCollectionId: string | null,
  loadedCollectionId: string | null,
): boolean {
  return Boolean(
    selectedProductId &&
      activeCollectionId &&
      activeCollectionId === loadedCollectionId &&
      availableProducts.some((product) => product.id === selectedProductId),
  );
}
