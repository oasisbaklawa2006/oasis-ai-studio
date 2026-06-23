import {
  loadRuntimeCatalog,
  resolveProductUtterance,
  type ProductUtteranceResolution,
  type RuntimeCatalog,
} from "@/features/productIntelligence/runtime";

export type CatalogLoader = () => Promise<RuntimeCatalog>;

export async function resolveInboundMessage(
  text: string,
  catalogLoader: CatalogLoader = loadRuntimeCatalog,
): Promise<ProductUtteranceResolution | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    const catalog = await catalogLoader();
    return resolveProductUtterance(trimmed, catalog);
  } catch {
    return null;
  }
}
