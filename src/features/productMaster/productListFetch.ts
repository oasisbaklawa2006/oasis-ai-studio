import { IMMUTABLE_VERSION_STATUSES } from "@/features/catalogueSnapshot/types";
import type { ProductMediaRow } from "@/features/mediaReadiness/mediaAssetsFromForm";
import type { ProductLabelBarcodeRow } from "@/features/productGovernance/types";
import type { MoqRuleRow, PricingRuleRow } from "@/features/productTruth/channelAuthorityMappers";
import { groupRowsByProductId } from "@/features/readiness/productReadinessSnapshot";
import { supabase } from "@/integrations/supabase/client";
import {
  matchesProductListView,
  type ProductListRow,
  productVisibleInActiveView,
} from "./productListModel";

export type ProductsFetchResult = {
  products: Array<ProductListRow & Record<string, unknown>>;
  error: string | null;
};

export type ProductAuthorityBundleResult = {
  rules: Record<string, unknown>[];
  moqCounts: Record<string, number>;
  priceCounts: Record<string, { total: number; approved: number }>;
  mediaByProduct: Record<string, ProductMediaRow[]>;
  pricingByProduct: Record<string, PricingRuleRow[]>;
  moqByProduct: Record<string, MoqRuleRow[]>;
  catalogueApprovedByProduct: Record<string, boolean>;
  labelRows: ProductLabelBarcodeRow[];
  hadErrors: boolean;
};

export async function fetchProductsForMasterList(opts: {
  showArchived: boolean;
}): Promise<ProductsFetchResult> {
  const order = { ascending: false as const };
  const res = await supabase.from("products").select("*").order("created_at", order);
  if (res.error) return { products: [], error: res.error.message };
  const products = ((res.data ?? []) as Array<ProductListRow & Record<string, unknown>>).filter(
    (p) => matchesProductListView(p, opts.showArchived),
  );
  return { products, error: null };
}

/** Active product ids for search filtering using the canonical is_active contract. */
export async function fetchActiveProductIdsForSearch(): Promise<Set<string> | null> {
  const res = await supabase.from("products").select("id, is_active");
  if (res.error) return null;

  const ids = new Set<string>();
  for (const row of (res.data ?? []) as ProductListRow[]) {
    if (productVisibleInActiveView(row)) ids.add(row.id);
  }
  return ids;
}

export async function fetchProductAuthorityBundle(): Promise<ProductAuthorityBundleResult> {
  const [rulesRes, moqRes, pricingRes, mediaRes, versionsRes] = await Promise.all([
    supabase.from("sku_code_rules").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("product_moq_rules").select("*"),
    supabase.from("product_pricing_rules").select("*"),
    supabase
      .from("product_media")
      .select("id, product_id, type, file_url, status, alt_text, angle, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("catalogue_versions")
      .select("product_id, status, version_number")
      .order("version_number", { ascending: false }),
  ]);

  const hadErrors = [rulesRes, moqRes, pricingRes, mediaRes, versionsRes].some((r) => r.error);
  if (hadErrors) {
    for (const r of [rulesRes, moqRes, pricingRes, mediaRes, versionsRes]) {
      if (r.error) console.error("[Products] authority bundle:", r.error);
    }
  }

  const moqRows = (moqRes.data ?? []) as MoqRuleRow[];
  const moqCounts: Record<string, number> = {};
  moqRows.forEach((r) => {
    if (!r.product_id) return;
    moqCounts[r.product_id] = (moqCounts[r.product_id] || 0) + 1;
  });

  const pricingRows = (pricingRes.data ?? []) as PricingRuleRow[];
  const priceCounts: Record<string, { total: number; approved: number }> = {};
  pricingRows.forEach((r) => {
    if (!r.product_id) return;
    if (!priceCounts[r.product_id]) priceCounts[r.product_id] = { total: 0, approved: 0 };
    priceCounts[r.product_id].total += 1;
    if (r.approval_status === "approved") priceCounts[r.product_id].approved += 1;
  });

  const approvedByProduct: Record<string, boolean> = {};
  if (!versionsRes.error) {
    for (const row of versionsRes.data ?? []) {
      const pid = row.product_id as string | null;
      if (!pid || approvedByProduct[pid] !== undefined) continue;
      approvedByProduct[pid] = IMMUTABLE_VERSION_STATUSES.includes(
        row.status as (typeof IMMUTABLE_VERSION_STATUSES)[number],
      );
    }
  }

  return {
    rules: rulesRes.data ?? [],
    moqCounts,
    priceCounts,
    mediaByProduct: groupRowsByProductId((mediaRes.data ?? []) as ProductMediaRow[]),
    pricingByProduct: groupRowsByProductId(pricingRows),
    moqByProduct: groupRowsByProductId(moqRows),
    catalogueApprovedByProduct: approvedByProduct,
    labelRows: [],
    hadErrors,
  };
}
