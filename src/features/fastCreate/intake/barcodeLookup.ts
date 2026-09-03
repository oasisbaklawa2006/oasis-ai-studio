import { supabase } from "@/integrations/supabase/client";
import type { ProductIntakeDuplicateHit } from "./types";

export type BarcodeCatalogHit = {
  productId: string;
  productName: string;
  sku: string | null;
  barcode: string;
};

export type BarcodeCatalogLookupResult =
  | { outcome: "found"; hit: BarcodeCatalogHit }
  | { outcome: "not_found" }
  | { outcome: "error"; message: string };

/**
 * Read-only barcode lookup against governed labels + products tables.
 * Used for duplicate-barcode fail-safe during Fast Create intake.
 */
export async function lookupBarcodeInCatalog(barcode: string): Promise<BarcodeCatalogLookupResult> {
  const normalized = barcode.trim();
  if (!normalized) return { outcome: "not_found" };

  const { data, error } = await supabase
    .from("labels")
    .select("barcode, product_id, products:product_id(id, product_name, sku)")
    .eq("barcode", normalized)
    .limit(1)
    .maybeSingle();

  if (error) return { outcome: "error", message: error.message };
  if (!data?.product_id) return { outcome: "not_found" };

  const product = data.products as {
    id: string;
    product_name: string | null;
    sku: string | null;
  } | null;
  if (!product?.id) return { outcome: "not_found" };

  return {
    outcome: "found",
    hit: {
      productId: product.id,
      productName: product.product_name ?? "Unnamed product",
      sku: product.sku,
      barcode: normalized,
    },
  };
}

export function toDuplicateHit(hit: BarcodeCatalogHit): ProductIntakeDuplicateHit {
  const label = hit.sku ? `${hit.productName} (${hit.sku})` : hit.productName;
  return {
    productId: hit.productId,
    label,
    barcode: hit.barcode,
  };
}
