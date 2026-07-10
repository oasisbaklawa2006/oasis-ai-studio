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
 *
 * Canonical channel semantics (post-Bugbot-recovery-program pricing-authority fix):
 *   - "mrp" channel  = Maximum Retail Price authority — the printed/legal MRP.
 *   - "retail" channel = a distinct, separately-tracked retail selling-price channel.
 *   These are NOT the same thing and must never be conflated or globally renamed into one
 *   another. Before this fix, resolvePricing() queried channelOf("retail") to compute MRP —
 *   it never queried the "mrp" channel at all, so every approved mrp-channel rule in
 *   production was silently ignored and MRP fell through to the (usually empty)
 *   products.mrp field fallback. A production-wide blast-radius query (read-only,
 *   tcxvcatsqqertcnycuop) confirmed zero catalogue-ready products depend on a "retail"
 *   rule for MRP (0 of them have any approved retail-channel rule at all), so the "retail"
 *   channel is not retained as an MRP fallback here — removing it creates no verified
 *   regression. products.mrp remains the only legacy fallback, per its existing role.
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

/** Mirrors resolvePricing()'s own per-channel precedence — the mrp channel reads .mrp,
 *  falling back to .sellingPrice (defensive only: a correctly-mapped mrp-channel row never
 *  has sellingPrice set — see pricingRuleRowToChannelPrice's isMrpChannel branch); b2b/export
 *  read sellingPrice only. Two rows must be compared by this *effective* value, not by raw
 *  field equality: a row with mrp=500,sellingPrice=null and another with mrp=null,
 *  sellingPrice=500 both resolve to 500 and must not be flagged as disagreeing just because
 *  the raw fields differ (Bugbot-caught regression). */
type EffectiveValueOf = (p: ChannelPriceLike) => number | null;
const effectiveMrpValue: EffectiveValueOf = (p) => num(p.mrp) ?? num(p.sellingPrice);
const effectiveSellingValue: EffectiveValueOf = (p) => num(p.sellingPrice);

function disagreesWithSelected(
  approvedPrices: ChannelPriceLike[],
  channel: string,
  selected: ChannelPriceLike,
  at: Date,
  effectiveValueOf: EffectiveValueOf,
): boolean {
  const normalized = channel.toLowerCase();
  const selectedValue = effectiveValueOf(selected);
  return approvedPrices.some(
    (p) =>
      p !== selected &&
      String(p.channel ?? "").toLowerCase() === normalized &&
      isPriceEffective(p, at) &&
      effectiveValueOf(p) !== selectedValue,
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

  const channelOf = (name: string, effectiveValueOf: EffectiveValueOf) => {
    const selected = getChannelPrice(approvedChannelPrices, name, at);
    if (selected && disagreesWithSelected(approvedChannelPrices, name, selected, at, effectiveValueOf)) {
      reviewRequiredChannels.push(name);
    }
    return selected;
  };

  const mrpRule = channelOf("mrp", effectiveMrpValue);
  const b2bRule = channelOf("b2b", effectiveSellingValue);
  const exportRule = channelOf("export", effectiveSellingValue);

  const fieldMrp = num(form.mrp);
  const fieldB2b = num(form.b2b_price) ?? num(form.price_b2b) ?? num(form.b2b_price_inr);
  const fieldExport = num(form.export_price) ?? num(form.export_price_usd);
  const fieldWholesale = num(form.wholesale_price) ?? num(form.price_wholesale);

  const channelMrp = num(mrpRule?.mrp) ?? num(mrpRule?.sellingPrice);
  // Conflict diagnostic (not silent): the approved mrp-channel rule remains authoritative
  // (product_pricing_rules is the declared write authority — same rule as b2b/export), but
  // a disagreeing positive products.mrp fallback value must surface for operator review
  // rather than being silently discarded.
  if (channelMrp != null && fieldMrp != null && channelMrp !== fieldMrp && !reviewRequiredChannels.includes("mrp")) {
    reviewRequiredChannels.push("mrp");
  }
  const mrp = channelMrp ?? fieldMrp;
  const b2bPrice = num(b2bRule?.sellingPrice) ?? fieldB2b;
  const exportPrice = num(exportRule?.sellingPrice) ?? fieldExport;

  const fromChannel = !!(mrpRule || b2bRule || exportRule);
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
  if (req.requiresMrp && pricing.reviewRequiredChannels.includes("mrp")) {
    blockers.push("MRP needs review — pricing sources disagree");
  }
  if (req.requiresB2bPrice && pricing.reviewRequiredChannels.includes("b2b")) {
    blockers.push("B2B price needs review — multiple disagreeing approved pricing rules");
  }
  if (req.requiresExportPrice && pricing.reviewRequiredChannels.includes("export")) {
    blockers.push("Export price needs review — multiple disagreeing approved pricing rules");
  }
  return blockers;
}
