import { convertOrderedQtyToBaseQty, normalizeUom } from "./uomPackagingEngine";
import type { ChannelMoqRule, ChannelPriceRecord, PackagingHierarchy, ProductTruthChannel } from "./types";

export function isPriceEffective(price: ChannelPriceRecord, at = new Date()): boolean {
  if (price.priceStatus === "archived") return false;
  const now = at.getTime();
  if (price.effectiveFrom) {
    const from = new Date(price.effectiveFrom).getTime();
    if (!Number.isNaN(from) && now < from) return false;
  }
  if (price.effectiveTo) {
    const to = new Date(price.effectiveTo).getTime();
    if (!Number.isNaN(to) && now > to) return false;
  }
  return true;
}

/**
 * Deterministic newest-currently-valid-approved-rule ordering: newest approvedAt first,
 * ties (including rows with no approvedAt at all) broken by `id` ascending so the result
 * never depends on the order rows arrived in — required for resolvePricing() and the
 * read-only audit SQL to reproduce exactly the same selection (Defect 3).
 */
export function compareChannelPriceRows(a: ChannelPriceRecord, b: ChannelPriceRecord): number {
  const aT = a.approvedAt ? new Date(a.approvedAt).getTime() : 0;
  const bT = b.approvedAt ? new Date(b.approvedAt).getTime() : 0;
  if (bT !== aT) return bT - aT;
  return String(a.id ?? "").localeCompare(String(b.id ?? ""));
}

export function getChannelPrice(
  prices: ChannelPriceRecord[],
  channel: string,
  at = new Date(),
): ChannelPriceRecord | null {
  const normalized = channel.toLowerCase();
  const matches = prices.filter(
    (p) => p.channel?.toLowerCase() === normalized && isPriceEffective(p, at),
  );
  const approved = matches.filter((p) => p.priceStatus === "approved");
  const pool = approved.length ? approved : matches.filter((p) => p.priceStatus !== "archived");
  if (!pool.length) return null;
  return [...pool].sort(compareChannelPriceRows)[0];
}

export function validateMOQ(
  orderQty: number,
  orderUom: string,
  rule: ChannelMoqRule,
  hierarchy: PackagingHierarchy,
): { valid: boolean; message?: string } {
  if (!rule.moqApplicable) return { valid: true };
  const moq = rule.moqValue;
  const moqUom = rule.moqUom ?? "kg";
  if (moq == null || moq <= 0) return { valid: true };

  const orderBase = convertOrderedQtyToBaseQty(orderQty, orderUom, hierarchy);
  const moqBase = convertOrderedQtyToBaseQty(moq, String(moqUom), hierarchy);
  if (orderBase == null || moqBase == null) {
    return { valid: false, message: "Cannot compare MOQ — check UOM conversion rules" };
  }
  if (orderBase + 1e-9 < moqBase) {
    return {
      valid: false,
      message: `Minimum order is ${moq} ${moqUom} (ordered ≈ ${orderBase.toFixed(2)} kg)`,
    };
  }
  return { valid: true };
}

export function validateIncrement(
  orderQty: number,
  orderUom: string,
  rule: ChannelMoqRule,
  hierarchy: PackagingHierarchy,
): { valid: boolean; message?: string } {
  if (!rule.moqApplicable) return { valid: true };
  const inc = rule.incrementValue;
  const incUom = rule.incrementUom ?? rule.moqUom ?? "kg";
  if (inc == null || inc <= 0) return { valid: true };

  const orderBase = convertOrderedQtyToBaseQty(orderQty, orderUom, hierarchy);
  const moqBase = convertOrderedQtyToBaseQty(rule.moqValue ?? 0, String(rule.moqUom ?? incUom), hierarchy);
  const incBase = convertOrderedQtyToBaseQty(inc, String(incUom), hierarchy);
  if (orderBase == null || incBase == null) {
    return { valid: false, message: "Cannot validate increment — check UOM rules" };
  }

  const aboveMoq = moqBase == null ? orderBase : Math.max(0, orderBase - (moqBase ?? 0));
  const remainder = incBase > 0 ? aboveMoq % incBase : 0;
  const tolerance = (hierarchy.tolerancePercent ?? 0) / 100;
  if (remainder > incBase * tolerance && remainder < incBase * (1 - tolerance)) {
    return {
      valid: false,
      message: `Order must be in increments of ${inc} ${incUom} above MOQ`,
    };
  }
  return { valid: true };
}

export function validateOrderQtyAgainstChannelRules(
  orderQty: number,
  orderUom: string,
  channel: ProductTruthChannel | string,
  rule: ChannelMoqRule | undefined,
  hierarchy: PackagingHierarchy,
): { valid: boolean; messages: string[] } {
  const messages: string[] = [];
  const u = normalizeUom(orderUom);

  if (channel === "retail" && u === "pcs" && orderQty >= 1) {
    return { valid: true, messages: [] };
  }

  if (!rule) {
    if (channel === "retail" && orderQty >= 1) return { valid: true, messages: [] };
    messages.push("No MOQ rule configured for channel");
    return { valid: false, messages };
  }

  const moq = validateMOQ(orderQty, orderUom, { ...rule, channel }, hierarchy);
  if (!moq.valid && moq.message) messages.push(moq.message);

  const inc = validateIncrement(orderQty, orderUom, { ...rule, channel }, hierarchy);
  if (!inc.valid && inc.message) messages.push(inc.message);

  return { valid: messages.length === 0, messages };
}

export function getInvalidQtyMessage(
  orderQty: number,
  orderUom: string,
  channel: string,
  rule: ChannelMoqRule | undefined,
  hierarchy: PackagingHierarchy,
): string | null {
  const result = validateOrderQtyAgainstChannelRules(orderQty, orderUom, channel, rule, hierarchy);
  return result.messages[0] ?? null;
}

export function priceBlocksPublish(price: ChannelPriceRecord | null): boolean {
  if (!price) return true;
  if (price.priceStatus === "pending_approval" || price.priceStatus === "draft") return true;
  if (!isPriceEffective(price)) return true;
  return false;
}
