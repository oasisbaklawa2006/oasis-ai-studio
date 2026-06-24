import {
  loadRuntimeCatalog,
  resolveProductUtterance,
  type ProductUtteranceResolution,
  type RuntimeCatalog,
} from "@/features/productIntelligence/runtime";

export type CatalogLoader = () => Promise<RuntimeCatalog>;

const DEFAULT_RESOLVE_TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Resolver timed out")), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export async function resolveInboundMessage(
  text: string,
  catalogLoader: CatalogLoader = loadRuntimeCatalog,
  timeoutMs = DEFAULT_RESOLVE_TIMEOUT_MS,
): Promise<ProductUtteranceResolution | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    const catalog = await withTimeout(catalogLoader(), timeoutMs);
    return resolveProductUtterance(trimmed, catalog);
  } catch {
    return null;
  }
}
