import { TERM_TYPE_UI_NOTICE } from "@/features/productLanguage/terms";
import {
  buildLanguageTermInventory,
  countLanguageTerms,
  emptyLanguageTermCounts,
} from "./languageTermInventory";
import { evaluateProductLanguageReadiness } from "./productLanguageReadiness";
import type { SnapshotLanguageIntelligence } from "./types";

type AliasRow = {
  id: string;
  alias_text?: string | null;
  alias?: string | null;
  product_id?: string | null;
  canonical_name?: string | null;
  alias_type?: string | null;
};

export function buildSnapshotLanguageIntelligence(args: {
  productId: string;
  officialName: string;
  aliasRows?: AliasRow[];
}): SnapshotLanguageIntelligence {
  const officialName = args.officialName.trim();
  const inventory = args.aliasRows?.length
    ? buildLanguageTermInventory(args.productId, officialName, args.aliasRows)
    : [];

  const term_counts = inventory.length ? countLanguageTerms(inventory) : emptyLanguageTermCounts();
  const language_readiness = evaluateProductLanguageReadiness(term_counts, {
    hasOfficialName: !!officialName,
  });

  return {
    schema_available: false,
    official_name: officialName,
    language_readiness,
    term_counts,
    terms_preview: inventory.slice(0, 25).map((t) => ({
      alias_text: t.alias_text,
      term_type: t.term_type,
      term_type_source: t.term_type_source,
    })),
    discoverability_gaps: language_readiness.gaps,
    search_consumption: {
      matches_name: true,
      matches_sku: true,
      matches_alias_text: term_counts.total_aliases > 0,
      matches_canonical_name: true,
      matches_typed_terms: false,
    },
    note: TERM_TYPE_UI_NOTICE,
  };
}
