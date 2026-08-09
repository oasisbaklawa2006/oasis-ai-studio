import { resolveChannelUom } from "./channelPricingMapper";
import { submitCatalogueDraft } from "@/features/catalogueDrafts/draftService";

export type ChannelSeedTarget = "retail" | "b2b";

// MOQ is a Central/Core-governed commercial authority (Point 27, Finding 2).
// This submits a proposal only - it is never written to product_moq_rules
// directly from AI Studio. It goes through the same catalogue draft/approval
// path as manual MOQ edits and only becomes live once approved in Central.
export async function seedMoqRowForChannel(
  productId: string,
  channel: ChannelSeedTarget,
  product: Record<string, unknown>,
): Promise<{ ok: boolean; message?: string }> {
  const uom =
    resolveChannelUom(channel, product) ??
    ((channel === "retail" ? String(product.retail_uom ?? "") : String(product.b2b_uom ?? "")) ||
      String(product.primary_uom ?? "kg"));

  const moqValue =
    channel === "retail"
      ? 1
      : product.moq_value != null && String(product.moq_value).trim() !== ""
        ? Number(product.moq_value)
        : 1;

  const incrementValue =
    product.increment_value != null && String(product.increment_value).trim() !== ""
      ? Number(product.increment_value)
      : moqValue;

  const incrementUom = String(product.increment_uom ?? product.moq_uom ?? uom);
  const moqApplicable = channel !== "retail";

  const res = await submitCatalogueDraft({
    draftType: "moq",
    operation: "create",
    targetRecordId: null,
    payload: {
      scope: "product_moq_rule",
      product_id: productId,
      channel,
      customer_type: null,
      moq_applicable: moqApplicable,
      min_order_quantity: moqApplicable ? (Number.isFinite(moqValue) ? moqValue : 1) : null,
      increment_quantity: moqApplicable ? (Number.isFinite(incrementValue) ? incrementValue : 1) : null,
      is_active: moqApplicable,
      moq_value: moqApplicable ? (Number.isFinite(moqValue) ? moqValue : 1) : null,
      moq_uom: moqApplicable ? uom : null,
      increment_value: moqApplicable ? (Number.isFinite(incrementValue) ? incrementValue : 1) : null,
      increment_uom: moqApplicable ? incrementUom : null,
      allow_override: false,
      min_carton_qty: null,
      carton_logic: null,
      notes: null,
    },
  });

  if (!res.ok) return { ok: false, message: res.message };
  return { ok: true };
}

export async function seedRetailB2bMoqFromProduct(
  productId: string,
  product: Record<string, unknown>,
  channels: ChannelSeedTarget[] = ["retail", "b2b"],
): Promise<{ ok: boolean; created: number; message?: string }> {
  let created = 0;
  for (const channel of channels) {
    const uom = resolveChannelUom(channel, product);
    if (!uom && channel === "retail" && !product.retail_uom) continue;
    const res = await seedMoqRowForChannel(productId, channel, product);
    if (!res.ok) return { ok: false, created, message: res.message };
    created += 1;
  }
  return { ok: true, created };
}
