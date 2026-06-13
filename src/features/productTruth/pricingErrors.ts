/** User-facing pricing save error messages. */
export function formatPricingSaveError(error: unknown): string {
  if (!error || typeof error !== "object") return "Pricing save failed.";
  const msg = String((error as { message?: string }).message ?? "Pricing save failed.");
  if (/duplicate key.*uq_product_pricing_rules_product_channel|uq_price_rule_product_channel/i.test(msg)) {
    return "Pricing for this channel already exists. Updating existing row.";
  }
  return msg;
}
