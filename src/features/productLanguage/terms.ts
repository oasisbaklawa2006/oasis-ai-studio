/** Oasis Product Language Authority — six editable term classes (Official Name lives on products.name). */

export const PRODUCT_LANGUAGE_TERM_TYPES = [
  "official_alias",
  "customer_term",
  "whatsapp_keyword",
  "regional_term",
  "legacy_name",
  "search_keyword",
] as const;

export type ProductLanguageTermType = (typeof PRODUCT_LANGUAGE_TERM_TYPES)[number];

export const TERM_TYPE_LABELS: Record<ProductLanguageTermType, string> = {
  official_alias: "Official Alias",
  customer_term: "Customer Term",
  whatsapp_keyword: "WhatsApp Keyword",
  regional_term: "Regional Term",
  legacy_name: "Legacy Name",
  search_keyword: "Search Keyword",
};

export const TERM_TYPE_UI_NOTICE =
  "Term type is tracked in AI Studio UI only until language-term schema is deployed.";

export type ChannelScope =
  | "central"
  | "catalogue"
  | "sales"
  | "customer_app"
  | "whatsapp"
  | "regional"
  | "trace"
  | "search"
  | "discovery"
  | "historical";

export function channelScopeForTermType(termType: ProductLanguageTermType): ChannelScope[] {
  switch (termType) {
    case "official_alias":
      return ["central", "catalogue"];
    case "customer_term":
      return ["sales", "customer_app"];
    case "whatsapp_keyword":
      return ["whatsapp"];
    case "regional_term":
      return ["regional", "trace"];
    case "legacy_name":
      return ["search", "historical"];
    case "search_keyword":
      return ["search", "discovery"];
    default:
      return ["search"];
  }
}

export function isWhatsAppTermType(termType: ProductLanguageTermType): boolean {
  return termType === "whatsapp_keyword";
}

export type ContributorAliasDraftPayload = {
  scope: "product_alias";
  /** Approve-RPC compatibility — mirrors alias_text */
  alias: string;
  alias_text: string;
  term_type: ProductLanguageTermType;
  channel_scope: ChannelScope[];
  product_id: string;
  canonical_name: string;
  language?: string | null;
  script?: string | null;
  source?: string;
};

export type AdminAliasInsertPayload = {
  alias_text: string;
  canonical_name: string;
  product_id: string;
};

/** DB-safe insert — only Central-supported product_aliases columns. */
export function buildAdminAliasInsert(
  productId: string,
  canonicalName: string,
  aliasText: string,
): AdminAliasInsertPayload {
  return {
    product_id: productId,
    canonical_name: canonicalName.trim() || "Unnamed product",
    alias_text: aliasText.trim(),
  };
}

export function buildContributorAliasDraftPayload(args: {
  productId: string;
  canonicalName: string;
  aliasText: string;
  termType: ProductLanguageTermType;
  language?: string | null;
  script?: string | null;
  source?: string;
}): ContributorAliasDraftPayload {
  const aliasText = args.aliasText.trim();
  const canonical = args.canonicalName.trim() || "Unnamed product";

  return {
    scope: "product_alias",
    alias: aliasText,
    alias_text: aliasText,
    term_type: args.termType,
    channel_scope: channelScopeForTermType(args.termType),
    product_id: args.productId,
    canonical_name: canonical,
    language: args.language ?? null,
    script: args.script ?? null,
    source: args.source ?? "manual",
  };
}

export function inferDefaultTermType(row: {
  product_id?: string | null;
  alias_type?: string | null;
}): ProductLanguageTermType {
  if (!row.product_id) return "legacy_name";
  const t = (row.alias_type ?? "").toLowerCase();
  if (t.includes("customer")) return "customer_term";
  if (t.includes("old") || t.includes("legacy")) return "legacy_name";
  if (t.includes("hindi") || t.includes("arabic") || t.includes("turkish") || t.includes("local")) {
    return "regional_term";
  }
  return "official_alias";
}
