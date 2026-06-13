import type { PilotSkuCode } from "./skuGuard";

/** Pilot alias taxonomy (5-SKU governed review). */
export const PILOT_ALIAS_TYPES = [
  "official",
  "search_keyword",
  "whatsapp_keyword",
  "phonetic",
  "sales_term",
] as const;

export type PilotAliasType = (typeof PILOT_ALIAS_TYPES)[number];

export const PILOT_CHANNEL_SCOPES = ["catalogue", "whatsapp", "both", "internal"] as const;

export type PilotChannelScope = (typeof PILOT_CHANNEL_SCOPES)[number];

export const PILOT_REVIEW_STATUSES = ["suggested", "approved", "rejected"] as const;

export type PilotReviewStatus = (typeof PILOT_REVIEW_STATUSES)[number];

export type PilotAliasCollision = {
  level: "none" | "warning" | "block";
  reason: string;
  conflictsWith?: Array<{ sku: string; label: string; term: string }>;
};

export type PilotAliasTermSuggestion = {
  id: string;
  sku: PilotSkuCode;
  product_id: string;
  product_name: string;
  alias_text: string;
  alias_type: PilotAliasType;
  channel_scope: PilotChannelScope;
  review_status: PilotReviewStatus;
  collision: PilotAliasCollision;
  review_notes?: string;
  source: "authority_preview" | "ai_suggested" | "manual";
};

export type PilotAliasSkuBundle = {
  sku: PilotSkuCode;
  product_id: string;
  product_name: string;
  terms: PilotAliasTermSuggestion[];
  summary: {
    total: number;
    suggested: number;
    approved: number;
    rejected: number;
    collisions: number;
  };
};

export const PILOT_ALIAS_DISCLAIMER =
  "AI-generated and authority-preview terms are suggestions only. Approve each term before saving to product_aliases or alias drafts.";

export const PILOT_ALIAS_TYPE_LABELS: Record<PilotAliasType, string> = {
  official: "Official alias",
  search_keyword: "Search keyword",
  whatsapp_keyword: "WhatsApp keyword",
  phonetic: "Phonetic / misspelling",
  sales_term: "Sales-team term",
};

export const PILOT_CHANNEL_LABELS: Record<PilotChannelScope, string> = {
  catalogue: "Catalogue",
  whatsapp: "WhatsApp",
  both: "Catalogue + WhatsApp",
  internal: "Internal / sales only",
};

/** Maps pilot alias_type → product_aliases.alias_type for DB insert. */
export function toDbAliasType(type: PilotAliasType): string {
  switch (type) {
    case "official":
      return "official_alias";
    case "search_keyword":
      return "search_keyword";
    case "whatsapp_keyword":
      return "whatsapp_keyword";
    case "phonetic":
      return "phonetic_variant";
    case "sales_term":
      return "sales_term";
    default:
      return type;
  }
}
