import { supabase } from "@/integrations/supabase/client";
import {
  applyCategoryDefaults,
} from "@/features/productDefaults/applyDefaults";
import type { FastCreateCategoryKey } from "@/features/productDefaults/categoryDefaults";
import {
  seedAliasesFromName,
  whatsappKeywordsFromAliases,
  type AliasSeed,
} from "@/features/productLanguage/aliasSeedRules";
import type { AiComplianceResponse } from "@/shared/ai/complianceSuggestions";

export type FastCreateSuggestions = {
  formPatch: Record<string, unknown>;
  aliases: AliasSeed[];
  whatsappKeywords: string[];
  searchKeywords: string[];
  labelStarter: {
    product_name: string;
    ingredients_hint: string;
    allergen_hint: string;
    net_weight_hint: string;
  };
  productTruthStarters: {
    piecesPerKg: number | null;
    traysPerMasterCarton: number | null;
    primaryPackSummary: string | null;
  };
  sources: {
    defaults: boolean;
    heuristicAliases: boolean;
    aiCompliance: boolean;
    aiAliases: boolean;
  };
};

function buildDescription(name: string, category: string, productType: string): string {
  return `Premium Oasis ${productType || category} — ${name}. Crafted with quality ingredients for wholesale and retail catalogue use.`;
}

function buildShortDescription(name: string, productType: string): string {
  const short = name.split(/[\/,|]/)[0]?.trim() || name;
  return `${short} — signature ${productType || "Oasis"} product.`;
}

function searchKeywordsFromForm(name: string, category: string, aliases: AliasSeed[]): string[] {
  const base = [name, category, ...aliases.map((a) => a.alias)];
  return [...new Set(base.map((s) => s.trim()).filter((s) => s.length > 1))].slice(0, 10);
}

export function buildHeuristicSuggestions(
  productName: string,
  categoryKey: FastCreateCategoryKey,
): FastCreateSuggestions {
  const formPatch = applyCategoryDefaults(
    { product_name: productName.trim() },
    categoryKey,
  ) as Record<string, unknown>;

  const category = String(formPatch.category ?? "");
  const productType = String(formPatch.product_type ?? "");
  formPatch.short_name = productName.split(/[\/,|]/)[0]?.trim() || productName.trim();
  formPatch.description = buildDescription(productName, category, productType);
  formPatch.short_description = buildShortDescription(productName, productType);
  formPatch.allergen_warnings =
    formPatch.allergen_warnings ||
    "Contains nuts, gluten, and dairy. May contain traces of sesame and soy.";
  formPatch.ingredients =
    formPatch.ingredients ||
    "Refer to batch label. Typical ingredients include nuts, sugar, clarified butter, and filo pastry.";

  const aliases = seedAliasesFromName(productName);
  const whatsappKeywords = whatsappKeywordsFromAliases(aliases);
  const piecesPerKg = formPatch.pieces_per_kg ? Number(formPatch.pieces_per_kg) : null;
  const traysPerMasterCarton =
    formPatch.primary_pack_uom === "tray" ? 8 : formPatch.primary_pack_uom === "box" ? 12 : null;

  return {
    formPatch,
    aliases,
    whatsappKeywords,
    searchKeywords: searchKeywordsFromForm(productName, category, aliases),
    labelStarter: {
      product_name: productName.trim(),
      ingredients_hint: String(formPatch.ingredients ?? ""),
      allergen_hint: String(formPatch.allergen_warnings ?? ""),
      net_weight_hint: String(formPatch.pack_size ?? "As labelled"),
    },
    productTruthStarters: {
      piecesPerKg: Number.isFinite(piecesPerKg) ? piecesPerKg : null,
      traysPerMasterCarton,
      primaryPackSummary: formPatch.pack_size ? String(formPatch.pack_size) : null,
    },
    sources: {
      defaults: true,
      heuristicAliases: aliases.length > 0,
      aiCompliance: false,
      aiAliases: false,
    },
  };
}

export async function enrichSuggestionsWithAi(
  base: FastCreateSuggestions,
  productName: string,
  category: string,
): Promise<FastCreateSuggestions> {
  const next = { ...base, formPatch: { ...base.formPatch }, sources: { ...base.sources } };

  try {
    const { data, error } = await supabase.functions.invoke("generate-product-attributes", {
      body: { product_name: productName, category },
    });
    if (!error && data) {
      const response = data as AiComplianceResponse;
      const s = response.suggestions;
      if (s.hsn_code) next.formPatch.hsn_code = String(s.hsn_code);
      if (s.gst_rate != null) next.formPatch.gst_rate = String(s.gst_rate);
      if (s.shelf_life_days != null) next.formPatch.shelf_life_days = String(s.shelf_life_days);
      if (s.ingredients) next.formPatch.ingredients = s.ingredients;
      if (s.allergen_warnings) next.formPatch.allergen_warnings = s.allergen_warnings;
      if (s.storage_instructions) next.formPatch.storage_instructions = s.storage_instructions;
      if (s.nutritional_info) next.formPatch.nutritional_info = s.nutritional_info;
      next.labelStarter.ingredients_hint = String(next.formPatch.ingredients ?? "");
      next.labelStarter.allergen_hint = String(next.formPatch.allergen_warnings ?? "");
      next.sources.aiCompliance = true;
    }
  } catch {
    /* heuristic defaults remain */
  }

  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (supabaseUrl && anonKey) {
      const resp = await fetch(`${supabaseUrl}/functions/v1/oasis-ai-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: `Suggest 5 short B2B search aliases (comma-separated, no explanation) for Oasis product: "${productName}" in category "${category}".`,
            },
          ],
        }),
      });
      if (resp.ok) {
        const text = await resp.text();
        const parsed = text
          .split(/[,\n]/)
          .map((s) => s.trim().replace(/^[-*\d.]+\s*/, ""))
          .filter((s) => s.length > 1 && s.length < 40);
        if (parsed.length) {
          const merged = [...next.aliases];
          const seen = new Set(merged.map((a) => a.alias.toLowerCase()));
          for (const alias of parsed) {
            if (!seen.has(alias.toLowerCase())) {
              merged.push({ alias, alias_type: "search_term" });
              seen.add(alias.toLowerCase());
            }
          }
          next.aliases = merged.slice(0, 12);
          next.whatsappKeywords = whatsappKeywordsFromAliases(next.aliases);
          next.searchKeywords = searchKeywordsFromForm(productName, category, next.aliases);
          next.sources.aiAliases = true;
        }
      }
    }
  } catch {
    /* heuristic aliases remain */
  }

  return next;
}

export async function generateFastCreateSku(): Promise<string | null> {
  const { data: rules } = await supabase
    .from("sku_code_rules")
    .select("code,code_type")
    .eq("is_active", true)
    .order("sort_order");

  if (!rules?.length) return null;

  const pick = (type: string) => rules.find((r) => r.code_type === type)?.code;
  const division = pick("division");
  const category = pick("category");
  const subcategory = pick("subcategory");
  const packaging = pick("packaging");

  if (!division || !category || !subcategory || !packaging) return null;

  const { data, error } = await supabase.rpc("generate_oasis_sku", {
    _division_code: division,
    _category_code: category,
    _subcategory_code: subcategory,
    _packaging_code: packaging,
  });

  if (error || !data) return null;
  return String(data);
}
