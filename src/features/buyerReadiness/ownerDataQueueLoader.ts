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

const PAGE_SIZE = 500;
const MAX_PAGES = 100;

type ReadError = { message: string };
type ReadResult = { data: unknown[] | null; error: ReadError | null };

type ReadQuery = PromiseLike<ReadResult> & {
  eq(column: string, value: unknown): ReadQuery;
  range(from: number, to: number): ReadQuery;
};

type UntypedReadClient = {
  from(table: string): {
    select(columns: string): ReadQuery;
  };
};

async function readAllPages(label: string, buildQuery: () => ReadQuery): Promise<unknown[]> {
  const rows: unknown[] = [];

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const result = await buildQuery().range(from, to);

    if (result.error) {
      throw new Error(`${label} read failed: ${result.error.message}`);
    }

    const pageRows = result.data ?? [];
    rows.push(...pageRows);

    if (pageRows.length < PAGE_SIZE) {
      return rows;
    }
  }

  throw new Error(
    `${label} read exceeded ${PAGE_SIZE * MAX_PAGES} rows; refusing to present an incomplete owner-data queue.`,
  );
}

export async function loadOwnerDataCompletionQueue(
  todayIso = new Date().toISOString().slice(0, 10),
): Promise<OwnerDataQueueItem[]> {
  // The generated Studio types lag a few already-live Product Master columns.
  // Keep this deliberately narrow and read-only rather than falling back to
  // select("*"), which could pull product cost/margin fields into this page.
  const client = supabase as unknown as UntypedReadClient;

  const [products, pricingRules] = await Promise.all([
    readAllPages("Owner-data product", () =>
      client.from("products").select(PRODUCT_SELECT).eq("is_active", true),
    ),
    readAllPages("Owner-data pricing", () =>
      client.from("product_pricing_rules").select(PRICE_SELECT).eq("price_channel", "b2b"),
    ),
  ]);

  return buildOwnerDataCompletionQueue(products, pricingRules, todayIso);
}
