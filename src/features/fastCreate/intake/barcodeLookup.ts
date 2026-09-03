import { supabase } from "@/integrations/supabase/client";
import type { ProductIntakeDuplicateHit } from "./types";

export type BarcodeCatalogHit = {
  productId: string;
  productName: string;
  sku: string | null;
  barcode: string;
};

/**
 * Read-only barcode lookup against governed labels + products tables.
 * Used for duplicate-barcode fail-safe during Fast Create intake.
 */
export async function lookupBarcodeInCatalog(barcode: string): Promise<BarcodeCatalogHit | null> {
  const normalized = barcode.trim();
  if (!normalized) return null;

  const { data, error } = await supabase
    .from("labels")
    .select("barcode, product_id, products:product_id(id, product_name, sku)")
    .eq("barcode", normalized)
    .limit(1)
    .maybeSingle();

  if (error || !data?.product_id) return null;

  const product = data.products as {
    id: string;
    product_name: string | null;
    sku: string | null;
  } | null;
  if (!product?.id) return null;

  return {
    productId: product.id,
    productName: product.product_name ?? "Unnamed product",
    sku: product.sku,
    barcode: normalized,
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
