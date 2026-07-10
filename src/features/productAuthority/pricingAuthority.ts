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
 *
 * Channel-rule selection defers to getChannelPrice() (channelPricingMoqEngine.ts) — the
 * same "newest currently-valid approved rule" authority already used by the readiness
 * snapshot, Central sync payload, Catalogue Builder, and the Channel Rules panel. Before
 * Defect 3, this module ran its own separate, unordered Array.find() selection here,
 * meaning two different parts of the app could disagree on which of several approved rows
 * for the same product+channel was authoritative.
 */
import { getChannelPrice, isPriceEffective } from "@/features/productTruth/channelPricingMoqEngine";
import type { ChannelPriceRecord } from "@/features/productTruth/types";
import type { SaleType } from "./saleType";
import { getSaleTypeRequirements } from "./saleType";

export type ChannelPriceLike = ChannelPriceRecord;

export interface ResolvedPricing {
  mrp: number | null;
  b2bPrice: number | null;
  exportPrice: number | null;
  wholesalePrice: number | null;
  source: "channel_rules" | "product_fields" | "mixed" | "none";
  hasAnyPrice: boolean;
  /** Channels where more than one approved, currently-valid rule exists with disagreeing
   *  mrp/sellingPrice values. The newest rule (per getChannelPrice's authority rule) is
   *  still used for the resolved price above, but this is not aggregated/averaged — it's
   *  an explicit diagnostic so callers can surface a review-required state instead of
   *  silently trusting an ambiguous answer. */
  reviewRequiredChannels: string[];
}

function num(v: unknown): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function disagreesWithSelected(
  approvedPrices: ChannelPriceLike[],
  channel: string,
  selected: ChannelPriceLike,
  at: Date,
): boolean {
  const normalized = channel.toLowerCase();
  return approvedPrices.some(
    (p) =>
      p !== selected &&
      String(p.channel ?? "").toLowerCase() === normalized &&
      isPriceEffective(p, at) &&
      (num(p.mrp) !== num(selected.mrp) || num(p.sellingPrice) !== num(selected.sellingPrice)),
  );
}

export function resolvePricing(
  form: Record<string, unknown>,
  channelPrices: ChannelPriceLike[] = [],
  at: Date = new Date(),
): ResolvedPricing {
  const reviewRequiredChannels: string[] = [];
  // Pre-filter to approved rows: getChannelPrice() falls back to the best non-archived
  // (e.g. pending) row when no approved one exists, which is correct for its other callers
  // (previews) but must never satisfy this module's "approved pricing only" contract —
  // resolvePricing() has always ignored pending/draft rows entirely.
  const approvedChannelPrices = channelPrices.filter((p) => p.priceStatus === "approved");

  const channelOf = (name: string) => {
    const selected = getChannelPrice(approvedChannelPrices, name, at);
    if (selected && disagreesWithSelected(approvedChannelPrices, name, selected, at)) {
      reviewRequiredChannels.push(name);
    }
    return selected;
  };

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
    reviewRequiredChannels,
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
  if (req.requiresMrp && pricing.reviewRequiredChannels.includes("retail")) {
    blockers.push("MRP needs review — multiple disagreeing approved pricing rules");
  }
  if (req.requiresB2bPrice && pricing.reviewRequiredChannels.includes("b2b")) {
    blockers.push("B2B price needs review — multiple disagreeing approved pricing rules");
  }
  if (req.requiresExportPrice && pricing.reviewRequiredChannels.includes("export")) {
    blockers.push("Export price needs review — multiple disagreeing approved pricing rules");
  }
  return blockers;
}
