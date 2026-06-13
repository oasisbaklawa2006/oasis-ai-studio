import { supabase } from "@/integrations/supabase/client";
import { heroUrlWritePayload } from "@/lib/productImage";
import { stripUnapprovedComplianceFields } from "@/lib/compliance/aiComplianceSafety";
import {
  canWriteProductsDirectly,
  isCatalogueContributor,
} from "@/shared/auth/centralPermissions";
import { submitCatalogueDraft } from "@/features/catalogueDrafts/draftService";
import type { FastCreateSuggestions } from "./fastCreateSuggestions";
import { generateFastCreateSku } from "./fastCreateSuggestions";
import type { AliasSeed } from "@/features/productLanguage/aliasSeedRules";

function buildDimensionsText(form: Record<string, unknown>) {
  const l = form.dimension_l_cm;
  const w = form.dimension_w_cm;
  const h = form.dimension_h_cm;
  if (l || w || h) {
    return [l ? `L ${l} cm` : null, w ? `W ${w} cm` : null, h ? `H ${h} cm` : null]
      .filter(Boolean)
      .join(" × ");
  }
  return form.dimensions ?? null;
}

export function formPatchToProductRow(form: Record<string, unknown>) {
  const nutritional =
    typeof form.nutritional_info === "object"
      ? form.nutritional_info
      : form.nutritional_info
        ? { text: String(form.nutritional_info) }
        : null;

  const hero = (form.hero_image_url as string) ?? null;

  return {
    name: form.product_name ?? null,
    category: form.category ?? null,
    sub_category: form.subcategory ?? null,
    sku: form.sku ?? null,
    description: form.description ?? form.short_description ?? null,
    ...heroUrlWritePayload(hero),
    hsn_code: form.hsn_code ?? null,
    gst_rate: form.gst_rate ?? null,
    gst_percentage: form.gst_rate ?? null,
    department: form.main_department ?? null,
    production_department:
      form.main_department === "ready_goods_store" ? form.production_department ?? null : null,
    uom: form.primary_uom || form.b2b_uom || form.retail_uom || null,
    ingredients: form.ingredients ?? null,
    nutritional_info: nutritional,
    allergen_warnings: form.allergen_warnings ?? null,
    shelf_life_days: form.shelf_life_days ?? null,
    storage_instructions: form.storage_instructions ?? null,
    visible_in_catalog: !!form.is_catalogue_ready,
    weight_per_pc_grams: form.approximate_piece_weight_g ?? null,
    grams_per_piece: form.approximate_piece_weight_g ?? null,
    moq: form.moq_value ?? null,
    product_family: form.product_type || form.product_family || null,
    product_class: form.product_class ?? null,
    is_active: form.is_active !== false,
    pack_size: form.pack_size ?? null,
    dimensions: buildDimensionsText(form),
  };
}

export type FastCreateSaveInput = {
  suggestions: FastCreateSuggestions;
  heroUrl: string | null;
  roles: string[];
};

export async function saveFastCreateProduct(input: FastCreateSaveInput): Promise<{ id: string } | { draft: true }> {
  const form: Record<string, unknown> = {
    ...input.suggestions.formPatch,
    hero_image_url: input.heroUrl,
    is_active: true,
    is_catalogue_ready: false,
  };

  if (!form.product_name || !form.category) {
    throw new Error("Product name and category are required.");
  }

  const direct = await canWriteProductsDirectly(input.roles);
  const contributor = input.roles.includes("catalogue_contributor") || (await isCatalogueContributor());

  if (direct) {
    if (!form.sku) {
      form.sku = (await generateFastCreateSku()) ?? `OAS-FC-${Date.now().toString(36).toUpperCase()}`;
    }
    if (!form.product_class) form.product_class = "bulk_loose_product";
    if (!form.main_department) form.main_department = "ready_goods_store";

    const safePayload = stripUnapprovedComplianceFields(
      form,
      input.roles,
      {},
      {},
    );
    const productRow = formPatchToProductRow(safePayload);

    const res = await (supabase as any).from("products").insert(productRow).select("id").single();
    if (res.error) throw new Error(res.error.message);

    await persistFastCreateAliases(res.data.id, String(form.product_name), input.suggestions.aliases);
    return { id: res.data.id };
  }

  if (contributor) {
    const groupedPayload = {
      identity: {
        product_name: form.product_name,
        product_class: form.product_class,
        product_type: form.product_type,
        category: form.category,
        subcategory: form.subcategory,
        description: form.description,
        short_description: form.short_description,
        main_department: form.main_department,
        production_department: form.production_department,
      },
      compliance: {
        hsn_code: form.hsn_code,
        gst_rate: form.gst_rate,
        shelf_life_days: form.shelf_life_days,
        ingredients: form.ingredients,
        allergen_warnings: form.allergen_warnings,
        storage_instructions: form.storage_instructions,
      },
      media: {
        hero_image_url: input.heroUrl,
      },
      search: {
        suggested_aliases: input.suggestions.aliases.map((a) => a.alias),
        whatsapp_keywords: input.suggestions.whatsappKeywords,
        search_keywords: input.suggestions.searchKeywords,
      },
    };

    const draftRes = await submitCatalogueDraft({
      draftType: "product",
      operation: "create",
      payload: groupedPayload,
      targetRecordId: null,
    });
    if (!draftRes.ok) throw new Error(draftRes.message);
    return { draft: true };
  }

  throw new Error("You do not have permission to create products. Contact an administrator.");
}

async function persistFastCreateAliases(
  productId: string,
  productName: string,
  aliases: AliasSeed[],
) {
  if (!aliases.length) return;

  const rows = aliases.slice(0, 8).map((a) => ({
    product_id: productId,
    canonical_name: productName,
    alias: a.alias,
    alias_text: a.alias,
    alias_type: a.alias_type ?? "search_term",
    language: a.language ?? null,
    script: a.script ?? null,
    is_active: true,
    source: "fast_create",
  }));

  await supabase.from("product_aliases").insert(rows);
}
