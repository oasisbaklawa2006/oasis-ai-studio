import { supabase } from "@/integrations/supabase/client";
import {
  extractChannelPricingFromForm,
  resolveChannelUom,
} from "./channelPricingMapper";

export type ChannelPricingWriteMode = "direct" | "draft";

/**
 * Upsert legacy compliance-tab price fields into product_pricing_rules.
 * Direct master write persists approval_status=approved.
 */
export async function syncChannelPricingFromForm(
  form: Record<string, unknown>,
  productId: string,
  writeMode: ChannelPricingWriteMode = "direct",
): Promise<{ ok: boolean; message?: string; count: number }> {
  const rows = extractChannelPricingFromForm(form, productId, writeMode);
  if (!rows.length) return { ok: true, count: 0 };

  let count = 0;
  for (const row of rows) {
    const channel = String(row.price_channel ?? "");
    const uom = row.uom ?? resolveChannelUom(channel, form);
    const { error } = await supabase.from("product_pricing_rules").upsert(
      {
        ...row,
        uom,
      },
      { onConflict: "product_id,price_channel" },
    );
    if (error) return { ok: false, message: error.message, count };
    count += 1;
  }

  return { ok: true, count };
}

/** Direct master-write repair for pricing rows stuck in draft. */
export async function repairDirectMasterPricingRows(
  productId: string,
): Promise<{ repaired: number; error?: string }> {
  const { data, error } = await supabase
    .from("product_pricing_rules")
    .select("id, approval_status, base_price, calculated_price")
    .eq("product_id", productId);

  if (error) return { repaired: 0, error: error.message };

  const stuck = (data ?? []).filter((r) => {
    const status = String(r.approval_status ?? "draft").toLowerCase();
    const hasPrice = r.base_price != null || r.calculated_price != null;
    return hasPrice && status !== "approved" && status !== "archived";
  });

  if (!stuck.length) return { repaired: 0 };

  const { error: upErr } = await supabase
    .from("product_pricing_rules")
    .update({
      approval_status: "approved",
      approved_at: new Date().toISOString(),
    })
    .eq("product_id", productId)
    .in(
      "id",
      stuck.map((r) => r.id),
    );

  if (upErr) return { repaired: 0, error: upErr.message };
  return { repaired: stuck.length };
}
