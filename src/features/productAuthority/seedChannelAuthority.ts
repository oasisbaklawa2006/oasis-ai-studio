import { supabase } from "@/integrations/supabase/client";
import { resolveChannelUom } from "./channelPricingMapper";

export type ChannelSeedTarget = "retail" | "b2b";

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

  const { error } = await supabase.from("product_moq_rules").upsert(
    {
      product_id: productId,
      channel,
      customer_type: null,
      moq_applicable: channel !== "retail",
      moq_value: Number.isFinite(moqValue) ? moqValue : 1,
      moq_uom: uom,
      increment_value: Number.isFinite(incrementValue) ? incrementValue : 1,
      increment_uom: incrementUom,
    },
    { onConflict: "product_id,channel,customer_type" },
  );

  if (error) return { ok: false, message: error.message };
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
