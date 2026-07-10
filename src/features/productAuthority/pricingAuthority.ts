/**
 * One pricing read model for the whole Studio UI.
 *
 * Write authority for pricing is `product_pricing_rules` (channel rules) — product-row
 * pricing writes are deliberately blocked by liveProductsSchema's
 * LIVE_PRODUCTS_PRICING_EXCLUDED_COLUMNS, and that is not changed here. But the *read*
 * side was fragmented: Product Truth only recognized approved channel rule rows, while
 * the products table itself carries legacy/Central-owned mrp / price_b2b values on
 * hundreds of live rows. Result: an operator sees MRP+B2B on the product and Product
 * Truth still claims "pricing missing". This module resolves prices from both sources,
 * channel rules first, and reports which source answered.
 */
import type { SaleType } from "./saleType";
import { getSaleTypeRequirements } from "./saleType";

export interface ChannelPriceLike {
  channel?: string | null;
  sellingPrice?: number | null;
  mrp?: number | null;
  priceStatus?: string | null;
}

export interface ResolvedPricing {
  mrp: number | null;
  b2bPrice: number | null;
  exportPrice: number | null;
  wholesalePrice: number | null;
  source: "channel_rules" | "product_fields" | "mixed" | "none";
  hasAnyPrice: boolean;
}

function num(v: unknown): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function resolvePricing(
  form: Record<string, unknown>,
  channelPrices: ChannelPriceLike[] = [],
): ResolvedPricing {
  const approved = channelPrices.filter((p) => p.priceStatus === "approved");
  const channelOf = (name: string) =>
    approved.find((p) => String(p.channel ?? "").toLowerCase() === name);

  const retailRule = channelOf("retail");
  const b2bRule = channelOf("b2b");
  const exportRule = channelOf("export");

  const fieldMrp = num(form.mrp);
  const fieldB2b = num(form.b2b_price) ?? num(form.price_b2b) ?? num(form.b2b_price_inr);
  const fieldExport = num(form.export_price) ?? num(form.export_price_usd);
  const fieldWholesale = num(form.wholesale_price) ?? num(form.price_wholesale);

  const mrp = num(retailRule?.mrp) ?? num(retailRule?.sellingPrice) ?? fieldMrp;
  const b2bPrice = num(b2bRule?.sellingPrice) ?? fieldB2b;
  const exportPrice = num(exportRule?.sellingPrice) ?? fieldExport;

  const fromChannel = !!(retailRule || b2bRule || exportRule);
  const fromFields = !!(fieldMrp || fieldB2b || fieldExport || fieldWholesale);
  const source: ResolvedPricing["source"] =
    fromChannel && fromFields ? "mixed" : fromChannel ? "channel_rules" : fromFields ? "product_fields" : "none";

  return {
    mrp,
    b2bPrice,
    exportPrice,
    wholesalePrice: fieldWholesale,
    source,
    hasAnyPrice: !!(mrp || b2bPrice || exportPrice || fieldWholesale),
  };
}

/** Sale-type-aware pricing blockers. Internal products never demand customer-facing prices. */
export function pricingBlockers(
  pricing: ResolvedPricing,
  saleType: SaleType,
  opts?: { b2bEnabled?: boolean },
): string[] {
  const req = getSaleTypeRequirements(saleType, opts);
  const blockers: string[] = [];
  if (!req.customerFacing) return blockers;
  if (req.requiresMrp && !pricing.mrp) blockers.push("MRP missing");
  if (req.requiresB2bPrice && !pricing.b2bPrice) blockers.push("B2B price missing");
  if (req.requiresExportPrice && !pricing.exportPrice) blockers.push("Export price missing");
  return blockers;
}
