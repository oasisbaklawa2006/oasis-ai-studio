import type { FastCreateSuggestions } from "@/features/fastCreate/fastCreateSuggestions";
import type { AliasSeed } from "@/features/productLanguage/aliasSeedRules";
import { supabase } from "@/integrations/supabase/client";
import { extractGovernedAliases } from "./governedAliasExtraction";
import {
  applyGovernedComplianceToForm,
  extractGovernedCompliance,
} from "./governedComplianceExtraction";
import { mergeComplianceMetaMaps } from "./governedFieldMerge";
import type { GovernedAiProvenance } from "./types";

export const FAST_CREATE_ALIAS_FETCH_TIMEOUT_MS = 15_000;

function createAliasFetchAbortSignal(): AbortSignal | undefined {
  if (typeof AbortSignal === "undefined" || typeof AbortSignal.timeout !== "function") {
    return undefined;
  }
  return AbortSignal.timeout(FAST_CREATE_ALIAS_FETCH_TIMEOUT_MS);
}

export type GovernedFastCreateEnrichment = {
  suggestions: FastCreateSuggestions;
  provenance: GovernedAiProvenance[];
};

function cloneFastCreateSuggestions(base: FastCreateSuggestions): FastCreateSuggestions {
  return {
    ...base,
    formPatch: { ...base.formPatch },
    aliases: [...base.aliases],
    whatsappKeywords: [...base.whatsappKeywords],
    searchKeywords: [...base.searchKeywords],
    labelStarter: { ...base.labelStarter },
    productTruthStarters: { ...base.productTruthStarters },
    sources: { ...base.sources },
    complianceFieldMeta: { ...(base.complianceFieldMeta ?? {}) },
    extractionProvenance: [...(base.extractionProvenance ?? [])],
    pendingAiAliases: base.pendingAiAliases ? [...base.pendingAiAliases] : undefined,
  };
}

export type PersistableFastCreateAliasPayload = {
  aliases: AliasSeed[];
  whatsappKeywords: string[];
  searchKeywords: string[];
};

/**
 * Returns only aliases/keywords that are approved for canonical persistence.
 * AI-derived aliases remain in `pendingAiAliases` until explicitly approved.
 */
export function getPersistableFastCreateAliases(
  suggestions: FastCreateSuggestions,
): PersistableFastCreateAliasPayload {
  const pendingKeys = new Set(
    (suggestions.pendingAiAliases ?? []).map((alias) => alias.alias.trim().toLowerCase()),
  );
  const aliases = suggestions.aliases.filter(
    (alias) => !pendingKeys.has(alias.alias.trim().toLowerCase()),
  );
  const filterKeyword = (keyword: string) => !pendingKeys.has(keyword.trim().toLowerCase());

  return {
    aliases,
    whatsappKeywords: suggestions.whatsappKeywords.filter(filterKeyword),
    searchKeywords: suggestions.searchKeywords.filter(filterKeyword),
  };
}

/**
 * Governed AI enrichment for Fast Create — compliance and alias suggestions remain
 * reviewable; canonical form values are never silently overwritten.
 */
export async function enrichFastCreateWithGovernedAi(
  base: FastCreateSuggestions,
  productName: string,
  category: string,
): Promise<GovernedFastCreateEnrichment> {
  const next = cloneFastCreateSuggestions(base);
  const provenance: GovernedAiProvenance[] = [];

  try {
    const { data, error } = await supabase.functions.invoke("generate-product-attributes", {
      body: { product_name: productName, category },
    });

    const extraction = extractGovernedCompliance({
      product_name: productName,
      category,
      edgeData: data,
      edgeError: error,
    });
    provenance.push(extraction.provenance);

    const { form, appliedFields, complianceFieldMeta } = applyGovernedComplianceToForm(
      next.formPatch,
      extraction,
      next.complianceFieldMeta,
    );
    next.formPatch = form;
    next.complianceFieldMeta = mergeComplianceMetaMaps(
      next.complianceFieldMeta,
      complianceFieldMeta,
    );

    if (appliedFields.length > 0) {
      next.labelStarter.ingredients_hint = String(next.formPatch.ingredients ?? "");
      next.labelStarter.allergen_hint = String(next.formPatch.allergen_warnings ?? "");
    }

    next.sources.aiCompliance = extraction.provenance.provider_status === "ok";
  } catch (e) {
    const extraction = extractGovernedCompliance({
      product_name: productName,
      category,
      edgeData: null,
      edgeError: { message: e instanceof Error ? e.message : "Unknown enrichment error" },
    });
    provenance.push(extraction.provenance);

    const { form, complianceFieldMeta } = applyGovernedComplianceToForm(
      next.formPatch,
      extraction,
      next.complianceFieldMeta,
    );
    next.formPatch = form;
    next.complianceFieldMeta = mergeComplianceMetaMaps(
      next.complianceFieldMeta,
      complianceFieldMeta,
    );
    next.labelStarter.ingredients_hint = String(next.formPatch.ingredients ?? "");
    next.labelStarter.allergen_hint = String(next.formPatch.allergen_warnings ?? "");
    next.sources.aiCompliance = false;
  }

  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (supabaseUrl && anonKey) {
      const abortSignal = createAliasFetchAbortSignal();
      const resp = await fetch(`${supabaseUrl}/functions/v1/oasis-ai-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonKey}`,
        },
        ...(abortSignal ? { signal: abortSignal } : {}),
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
        const rawFragments = text.split(/[,\n]/).map((s) => s.trim().replace(/^[-*\d.]+\s*/, ""));
        const aliasExtraction = extractGovernedAliases(rawFragments);
        provenance.push(aliasExtraction.provenance);

        if (aliasExtraction.aliases.length > 0) {
          next.pendingAiAliases = aliasExtraction.aliases.map((alias) => ({
            alias,
            alias_type: "search_term",
          }));
          next.sources.aiAliases = aliasExtraction.provenance.provider_status === "ok";
        }
      } else {
        provenance.push({
          service: "oasis-ai-chat",
          provider_status: "degraded",
          used_heuristic_fallback: false,
          fail_closed: true,
          uncertainty_reason: `Alias provider HTTP ${resp.status}`,
          invoked_at: new Date().toISOString(),
        });
      }
    }
  } catch (e) {
    provenance.push({
      service: "oasis-ai-chat",
      provider_status: "degraded",
      used_heuristic_fallback: false,
      fail_closed: true,
      uncertainty_reason: e instanceof Error ? e.message : "Alias enrichment failed",
      invoked_at: new Date().toISOString(),
    });
  }

  next.extractionProvenance = [...(next.extractionProvenance ?? []), ...provenance];
  return { suggestions: next, provenance };
}
