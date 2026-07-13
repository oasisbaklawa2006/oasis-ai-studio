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
import { resolveAiComplianceResponse } from "@/shared/ai/complianceSuggestions";
import {
  resolveFastCreateSkuCodes,
  type FastCreateSkuCodeSet,
} from "./fastCreateSkuCodes";
import { sanitizeAiFragments } from "./aiOutputSanitizer";
import { invokeGovernedAi } from "@/shared/ai/governedAiClient";

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
  const short = name.split(/[/,|]/)[0]?.trim() || name;
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
  formPatch.short_name = productName.split(/[/,|]/)[0]?.trim() || productName.trim();
  formPatch.description = buildDescription(productName, category, productType);
  formPatch.short_description = buildShortDescription(productName, productType);
  // Compliance facts are never fabricated from a category. They remain blank until an
  // operator accepts governed extraction/suggestions against an approved source document.
  formPatch.allergen_warnings = formPatch.allergen_warnings || null;
  formPatch.ingredients = formPatch.ingredients || null;

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
  const next = {
    ...base,
    formPatch: { ...base.formPatch },
    aliases: [...base.aliases],
    whatsappKeywords: [...base.whatsappKeywords],
    searchKeywords: [...base.searchKeywords],
    labelStarter: { ...base.labelStarter },
    productTruthStarters: { ...base.productTruthStarters },
    sources: { ...base.sources },
  };

  try {
    const result = await invokeGovernedAi<unknown>("generate-product-attributes", {
      product_name: productName,
      category,
    });
    const { response, usedHeuristic } = resolveAiComplianceResponse(result.ok ? result.data : null, {
      product_name: productName,
      category,
    });
    if (!usedHeuristic) {
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
    /* deterministic category defaults remain intact */
  }

  try {
    const result = await invokeGovernedAi<{
      suggestion_only?: unknown;
      approved?: unknown;
      aliases?: unknown;
    }>("oasis-ai-chat", {
      task: "aliases",
      facts: { product_name: productName, category },
    });
    if (
      result.ok &&
      result.data?.suggestion_only === true &&
      result.data?.approved === false &&
      Array.isArray(result.data.aliases)
    ) {
      const parsed = sanitizeAiFragments(
        result.data.aliases.filter((value): value is string => typeof value === "string"),
        { limit: 5 },
      );
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
  } catch {
    /* heuristic aliases remain */
  }

  return next;
}

export type FastCreateSkuResult = {
  sku: string;
  codes: FastCreateSkuCodeSet;
};

/**
 * Generate structured Oasis SKU using category preset taxonomy codes, with optional
 * overrides — the operator's actual packaging selection must win over the preset's
 * default (a Ready Pack in a paper box must not silently become RBOX).
 */
export async function generateFastCreateSku(
  categoryKey: FastCreateCategoryKey = "other",
  overrides?: Partial<FastCreateSkuCodeSet>,
): Promise<FastCreateSkuResult | null> {
  const codes: FastCreateSkuCodeSet = { ...resolveFastCreateSkuCodes(categoryKey), ...overrides };

  const { data, error } = await supabase.rpc("generate_oasis_sku", {
    _division_code: codes.division_code,
    _category_code: codes.category_code,
    _subcategory_code: codes.subcategory_code,
    _packaging_code: codes.packaging_code,
  });

  if (error || !data) return null;
  return { sku: String(data), codes };
}

/** @deprecated Use generateFastCreateSku(categoryKey) — returns SKU string only. */
export async function generateFastCreateSkuLegacy(): Promise<string | null> {
  const result = await generateFastCreateSku("other");
  return result?.sku ?? null;
}
