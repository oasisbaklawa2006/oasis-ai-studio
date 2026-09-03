import { supabase } from "@/integrations/supabase/client";
import type { AliasSeed } from "@/features/productLanguage/aliasSeedRules";
import { whatsappKeywordsFromAliases } from "@/features/productLanguage/aliasSeedRules";
import { mergeComplianceMetaMaps } from "./governedFieldMerge";
import { applyGovernedComplianceToForm, extractGovernedCompliance } from "./governedComplianceExtraction";
import { extractGovernedAliases } from "./governedAliasExtraction";
import type { FastCreateSuggestions } from "@/features/fastCreate/fastCreateSuggestions";
import type { GovernedAiProvenance } from "./types";

export type GovernedFastCreateEnrichment = {
  suggestions: FastCreateSuggestions;
  provenance: GovernedAiProvenance[];
};

function searchKeywordsFromForm(name: string, category: string, aliases: AliasSeed[]): string[] {
  const base = [name, category, ...aliases.map((a) => a.alias)];
  return [...new Set(base.map((s) => s.trim()).filter((s) => s.length > 1))].slice(0, 10);
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
  const next: FastCreateSuggestions = {
    ...base,
    formPatch: { ...base.formPatch },
    sources: { ...base.sources },
    complianceFieldMeta: { ...(base.complianceFieldMeta ?? {}) },
    extractionProvenance: [...(base.extractionProvenance ?? [])],
  };
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
    next.complianceFieldMeta = mergeComplianceMetaMaps(next.complianceFieldMeta, complianceFieldMeta);

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
    next.complianceFieldMeta = mergeComplianceMetaMaps(next.complianceFieldMeta, complianceFieldMeta);
    next.labelStarter.ingredients_hint = String(next.formPatch.ingredients ?? "");
    next.labelStarter.allergen_hint = String(next.formPatch.allergen_warnings ?? "");
    next.sources.aiCompliance = false;
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
        const rawFragments = text
          .split(/[,\n]/)
          .map((s) => s.trim().replace(/^[-*\d.]+\s*/, ""));
        const aliasExtraction = extractGovernedAliases(rawFragments);
        provenance.push(aliasExtraction.provenance);

        if (aliasExtraction.aliases.length > 0) {
          const merged = [...next.aliases];
          const seen = new Set(merged.map((a) => a.alias.toLowerCase()));
          for (const alias of aliasExtraction.aliases) {
            if (!seen.has(alias.toLowerCase())) {
              merged.push({ alias, alias_type: "search_term" });
              seen.add(alias.toLowerCase());
            }
          }
          next.aliases = merged.slice(0, 12);
          next.whatsappKeywords = whatsappKeywordsFromAliases(next.aliases);
          next.searchKeywords = searchKeywordsFromForm(productName, category, next.aliases);
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
