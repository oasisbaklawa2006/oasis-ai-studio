import { supabase } from "@/integrations/supabase/client";
import {
  extractChannelPricingFromForm,
  resolveChannelUom,
} from "./channelPricingMapper";

/**
 * Upsert legacy compliance-tab price fields into product_pricing_rules.
 * Does not write to products — channel authority table only.
 */
export async function syncChannelPricingFromForm(
  form: Record<string, unknown>,
  productId: string,
): Promise<{ ok: boolean; message?: string; count: number }> {
  const rows = extractChannelPricingFromForm(form, productId);
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
