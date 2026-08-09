import { submitCatalogueDraft } from "@/features/catalogueDrafts/draftService";
import { supabase } from "@/integrations/supabase/client";
import { extractChannelPricingFromForm, resolveChannelUom } from "./channelPricingMapper";

/**
 * Point 27, Finding 2: AI Studio must never write product_pricing_rules
 * directly, including from this legacy compliance-tab pricing sync - Core
 * owns pricing authority and RLS now revokes direct anon/authenticated
 * writes to that table. Every channel price extracted from the form is
 * submitted as a governed catalogue draft (create for a new channel, update
 * against the existing row for one that already exists) instead.
 */
export async function syncChannelPricingFromForm(
  form: Record<string, unknown>,
  productId: string,
): Promise<{ ok: boolean; message?: string; count: number }> {
  const rows = extractChannelPricingFromForm(form, productId, "draft");
  if (!rows.length) return { ok: true, count: 0 };

  const { data: existingRows, error: existingError } = await supabase
    .from("product_pricing_rules")
    .select("id, price_channel")
    .eq("product_id", productId);
  if (existingError) return { ok: false, message: existingError.message, count: 0 };

  const existingIdByChannel = new Map((existingRows ?? []).map((r) => [r.price_channel, r.id]));

  let count = 0;
  for (const row of rows) {
    const channel = String(row.price_channel ?? "");
    const uom = row.uom ?? resolveChannelUom(channel, form);
    const existingId = existingIdByChannel.get(channel) ?? null;
    const result = await submitCatalogueDraft({
      draftType: "pricing",
      operation: existingId ? "update" : "create",
      targetRecordId: existingId,
      payload: {
        scope: "product_pricing_rule" as const,
        product_id: productId,
        price_channel: row.price_channel ?? null,
        price_type: row.price_type ?? null,
        base_price: row.base_price ?? null,
        calculated_price: row.calculated_price ?? null,
        currency: row.currency ?? "INR",
        uom: uom ?? null,
        source: row.source ?? null,
        approval_status: "draft",
      },
    });
    if (!result.ok) return { ok: false, message: result.message, count };
    count += 1;
  }

  return { ok: true, count };
}
