import { supabase } from "@/integrations/supabase/client";
import type { ResolverCatalog } from "./types";

/**
 * Read-only catalog loader for resolver prototype.
 * No writes. No Central sync.
 */
export async function loadResolverCatalog(
  skuFilter?: string[],
): Promise<ResolverCatalog> {
  let productQuery = supabase.from("products").select("id, sku, name");

  if (skuFilter?.length) {
    productQuery = productQuery.in("sku", skuFilter);
  }

  const { data: products, error: productsError } = await productQuery;
  if (productsError) throw productsError;

  const productIds = (products ?? []).map((p) => p.id);
  if (!productIds.length) {
    return { products: [], aliases: [] };
  }

  const { data: aliases, error: aliasesError } = await supabase
    .from("product_aliases")
    .select("alias_text, canonical_name, product_id")
    .in("product_id", productIds);

  if (aliasesError) throw aliasesError;

  return {
    products: (products ?? []).map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name ?? "Unnamed product",
    })),
    aliases: (aliases ?? [])
      .map((a) => ({
        alias_text: (a.alias_text ?? "").trim(),
        canonical_name: (a.canonical_name ?? "").trim(),
        product_id: a.product_id,
      }))
      .filter((a) => a.alias_text && a.product_id),
  };
}
