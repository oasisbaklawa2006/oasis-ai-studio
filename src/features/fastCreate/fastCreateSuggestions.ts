import type { GovernedAiProvenance } from "@/features/governedAiExtraction";
import { enrichFastCreateWithGovernedAi } from "@/features/governedAiExtraction";
import { applyCategoryDefaults } from "@/features/productDefaults/applyDefaults";
import type { FastCreateCategoryKey } from "@/features/productDefaults/categoryDefaults";
import {
  type AliasSeed,
  seedAliasesFromName,
  whatsappKeywordsFromAliases,
} from "@/features/productLanguage/aliasSeedRules";
import { supabase } from "@/integrations/supabase/client";
import type { ComplianceFieldMetaMap } from "@/shared/ai/complianceApproval";
import { type FastCreateSkuCodeSet, resolveFastCreateSkuCodes } from "./fastCreateSkuCodes";

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
  /** Review-only metadata for AI-filled compliance fields — never canonical without approval. */
  complianceFieldMeta?: ComplianceFieldMetaMap;
  /** Provider/runtime provenance for governed enrichment rounds. */
  extractionProvenance?: GovernedAiProvenance[];
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
  const { suggestions } = await enrichFastCreateWithGovernedAi(base, productName, category);
  return suggestions;
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
