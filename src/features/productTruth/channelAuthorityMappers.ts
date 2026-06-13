import type { ChannelMoqRule, ChannelPriceRecord } from "./types";

export type PricingRuleRow = {
  id?: string;
  product_id?: string;
  price_channel?: string | null;
  price_type?: string | null;
  base_price?: number | null;
  calculated_price?: number | null;
  currency?: string | null;
  approval_status?: string | null;
  valid_from?: string | null;
  valid_until?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
};

export type MoqRuleRow = {
  id?: string;
  product_id?: string;
  channel?: string | null;
  moq_applicable?: boolean | null;
  moq_value?: number | null;
  moq_uom?: string | null;
  increment_value?: number | null;
  increment_uom?: string | null;
  customer_type?: string | null;
};

function normalizePriceStatus(
  raw: string | null | undefined,
): ChannelPriceRecord["priceStatus"] {
  const s = String(raw ?? "draft").toLowerCase();
  if (s === "approved") return "approved";
  if (s === "needs_review" || s === "pending_approval" || s === "pending") {
    return "pending_approval";
  }
  if (s === "archived") return "archived";
  return "draft";
}

export function pricingRuleRowToChannelPrice(row: PricingRuleRow): ChannelPriceRecord {
  const channel = String(row.price_channel ?? "").trim();
  const calculated = row.calculated_price ?? null;
  const base = row.base_price ?? null;
  const isMrpChannel = channel.toLowerCase() === "mrp";

  return {
    channel,
    priceType: row.price_type ?? undefined,
    mrp: isMrpChannel ? (calculated ?? base) : null,
    sellingPrice: isMrpChannel ? null : (calculated ?? base),
    currency: row.currency ?? "INR",
    priceStatus: normalizePriceStatus(row.approval_status),
    effectiveFrom: row.valid_from ?? null,
    effectiveTo: row.valid_until ?? null,
    approvedBy: row.approved_by ?? null,
    approvedAt: row.approved_at ?? null,
  };
}

export function moqRuleRowToChannelMoq(row: MoqRuleRow): ChannelMoqRule {
  return {
    channel: String(row.channel ?? "").trim(),
    moqApplicable: row.moq_applicable ?? true,
    moqValue: row.moq_value ?? null,
    moqUom: row.moq_uom ?? null,
    incrementValue: row.increment_value ?? null,
    incrementUom: row.increment_uom ?? null,
  };
}

export function mapPricingRules(rows: PricingRuleRow[]): ChannelPriceRecord[] {
  return rows
    .filter((r) => r.price_channel)
    .map(pricingRuleRowToChannelPrice)
    .sort((a, b) => String(a.channel).localeCompare(String(b.channel)));
}

export function mapMoqRules(rows: MoqRuleRow[]): ChannelMoqRule[] {
  return rows
    .filter((r) => r.channel)
    .map(moqRuleRowToChannelMoq)
    .sort((a, b) => String(a.channel).localeCompare(String(b.channel)));
}

/** Union of channels present in pricing and MOQ authority tables. */
export function configuredChannels(
  prices: ChannelPriceRecord[],
  moqRules: ChannelMoqRule[],
): string[] {
  const channels = new Set<string>();
  for (const p of prices) {
    if (p.channel) channels.add(String(p.channel));
  }
  for (const m of moqRules) {
    if (m.channel) channels.add(String(m.channel));
  }
  return Array.from(channels).sort((a, b) => a.localeCompare(b));
}

export function formatChannelLabel(channel: string): string {
  return channel.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}
