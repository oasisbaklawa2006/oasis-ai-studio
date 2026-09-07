import type { GovernedAiProvenance } from "@/features/governedAiExtraction";
import { enrichFastCreateWithGovernedAi } from "@/features/governedAiExtraction";
import {
  buildHeuristicNamingSuggestions,
  GOVERNED_NAMING_PROMPT_VERSION,
  type GovernedNamingProvenance,
} from "@/features/governedProductNaming";
import {
  governedAliasSeedsFromSource,
  type GovernedMultilingualProvenance,
} from "@/features/governedMultilingual";
import { applyCategoryDefaults } from "@/features/productDefaults/applyDefaults";
import type { FastCreateCategoryKey } from "@/features/productDefaults/categoryDefaults";
import {
  type AliasSeed,
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
  /** Point 48 naming/description provenance — review-only, never publication truth. */
  namingProvenance?: GovernedNamingProvenance;
  /** Point 49 multilingual provenance — review-only, never publication truth. */
  multilingualProvenance?: GovernedMultilingualProvenance;
  /** Review-only AI alias suggestions — never persisted until explicitly approved. */
  pendingAiAliases?: AliasSeed[];
};

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
  const naming = buildHeuristicNamingSuggestions({
    product_name: productName.trim(),
    category,
    product_type: productType,
    pack_size: formPatch.pack_size ? String(formPatch.pack_size) : null,
    description: formPatch.description ? String(formPatch.description) : null,
    short_description: formPatch.short_description ? String(formPatch.short_description) : null,
  });
  if (naming.ok) {
    if (naming.suggestions.short_name) formPatch.short_name = naming.suggestions.short_name;
    if (naming.suggestions.description) formPatch.description = naming.suggestions.description;
    if (naming.suggestions.short_description) {
      formPatch.short_description = naming.suggestions.short_description;
    }
  }
  formPatch.allergen_warnings =
    formPatch.allergen_warnings ||
    "Contains nuts, gluten, and dairy. May contain traces of sesame and soy.";
  formPatch.ingredients =
    formPatch.ingredients ||
    "Refer to batch label. Typical ingredients include nuts, sugar, clarified butter, and filo pastry.";

  const multilingualSource = {
    product_name: productName.trim(),
    category,
    product_type: productType,
    pack_size: formPatch.pack_size ? String(formPatch.pack_size) : null,
    description: formPatch.description ? String(formPatch.description) : null,
    short_description: formPatch.short_description ? String(formPatch.short_description) : null,
    source_version: GOVERNED_NAMING_PROMPT_VERSION,
    approved_short_description: naming.ok ? naming.suggestions.short_description ?? null : null,
    approved_description: naming.ok ? naming.suggestions.description ?? null : null,
  };
  const governedAliases = governedAliasSeedsFromSource(multilingualSource);
  const aliases = governedAliases.ok ? governedAliases.aliases : [];
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
    namingProvenance: naming.provenance,
    multilingualProvenance: governedAliases.provenance,
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
