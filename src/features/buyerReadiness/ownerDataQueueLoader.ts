import { supabase } from "@/integrations/supabase/client";
import { buildOwnerDataCompletionQueue, type OwnerDataQueueItem } from "./ownerDataQueue";

const PRODUCT_SELECT = [
  "id",
  "sku",
  "product_name",
  "category",
  "product_type",
  "product_class",
  "is_active",
  "is_catalogue_ready",
  "visible_in_catalog",
  "media_status",
  "private_label_allowed",
  "private_label_moq",
  "private_label_moq_uom",
  "private_label_price",
  "currency",
  "lead_time_days",
  "price_b2b",
  "moq",
  "uom",
  "primary_uom",
].join(",");

const PRICE_SELECT = [
  "product_id",
  "price_channel",
  "approval_status",
  "base_price",
  "calculated_price",
  "currency",
  "uom",
  "valid_from",
  "valid_until",
].join(",");

type ReadError = { message: string };
type ReadResult = { data: unknown[] | null; error: ReadError | null };

type ReadQuery = PromiseLike<ReadResult> & {
  eq(column: string, value: unknown): ReadQuery;
};

type UntypedReadClient = {
  from(table: string): {
    select(columns: string): ReadQuery;
  };
};

export async function loadOwnerDataCompletionQueue(
  todayIso = new Date().toISOString().slice(0, 10),
): Promise<OwnerDataQueueItem[]> {
  // The generated Studio types lag a few already-live Product Master columns.
  // Keep this deliberately narrow and read-only rather than falling back to
  // select("*"), which could pull product cost/margin fields into this page.
  const client = supabase as unknown as UntypedReadClient;
  const [productsResult, pricingResult] = await Promise.all([
    client.from("products").select(PRODUCT_SELECT),
    client.from("product_pricing_rules").select(PRICE_SELECT).eq("price_channel", "b2b"),
  ]);

  if (productsResult.error) {
    throw new Error(`Owner-data product read failed: ${productsResult.error.message}`);
  }
  if (pricingResult.error) {
    throw new Error(`Owner-data pricing read failed: ${pricingResult.error.message}`);
  }

  return buildOwnerDataCompletionQueue(
    productsResult.data ?? [],
    pricingResult.data ?? [],
    todayIso,
  );
}
