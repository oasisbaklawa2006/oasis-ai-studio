import { supabase } from "@/integrations/supabase/client";

export type ProductSearchResult = {
  id: string;
  sku: string;
  product_name: string;
  short_name: string | null;
  category: string | null;
  hero_image_url: string | null;
  matched_alias: string | null;
  match_score: number;
};

/**
 * Alias-aware product search.
 * Note: SKU is the permanent system identity. Aliases are search helpers only.
 * All future API integrations must pass product_id / sku — never alias text.
 */
export async function searchProductsWithAliases(q: string): Promise<ProductSearchResult[]> {
  const text = q.trim();
  if (!text) {
    const { data } = await supabase
      .from("products")
      .select("id,sku,product_name,short_name,category,hero_image_url")
      .order("product_name")
      .limit(50);
    return (data ?? []).map((p: any) => ({ ...p, matched_alias: null, match_score: 0 }));
  }
  const { data, error } = await supabase.rpc("search_products_with_aliases", { _q: text });
  if (error) {
    console.error(error);
    return [];
  }
  return (data ?? []) as ProductSearchResult[];
}
