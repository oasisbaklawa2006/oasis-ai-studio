import { supabase } from "@/integrations/supabase/client";
import { isProductLanguageTermsSchemaDeployed } from "./languageSchema";
import { buildLanguageTermInventory, countLanguageTerms } from "./languageTermInventory";
import { evaluateProductLanguageReadiness } from "./productLanguageReadiness";
import type {
  LanguageTermCounts,
  LanguageTermRecord,
  ProductLanguageReadinessResult,
} from "./types";

export type ProductLanguageSnapshot = {
  inventory: LanguageTermRecord[];
  counts: LanguageTermCounts;
  readiness: ProductLanguageReadinessResult;
};

export async function fetchProductLanguageSnapshot(
  productId: string,
  productName: string,
): Promise<ProductLanguageSnapshot> {
  const trimmedName = productName.trim();

  const byProductId = supabase
    .from("product_aliases")
    .select("id, alias_text, product_id, canonical_name")
    .eq("product_id", productId);

  const byCanonical =
    trimmedName.length > 0
      ? supabase
          .from("product_aliases")
          .select("id, alias_text, product_id, canonical_name")
          .is("product_id", null)
          .ilike("canonical_name", trimmedName)
      : Promise.resolve({ data: [], error: null });

  const [linked, legacy] = await Promise.all([byProductId, byCanonical]);
  if (linked.error || legacy.error)
    throw new Error(
      linked.error?.message ?? legacy.error?.message ?? "Alias authority unavailable",
    );
  const merged = [...(linked.data ?? []), ...(legacy.data ?? [])];

  const inventory = buildLanguageTermInventory(productId, productName, merged);
  const counts = countLanguageTerms(inventory);

  if (!isProductLanguageTermsSchemaDeployed()) {
    const readiness: ProductLanguageReadinessResult = {
      score: 0,
      maxScore: 5,
      percent: 0,
      readyForDiscoverability: false,
      dimensions: [],
      gaps: [],
      nextAction: "Preview only — typed product_language_terms schema not deployed.",
    };
    return { inventory, counts, readiness };
  }

  const readiness = evaluateProductLanguageReadiness(counts, {
    hasOfficialName: !!trimmedName,
  });

  return { inventory, counts, readiness };
}
