import type { CatalogueDraftContentKey } from "@/features/catalogueAiStudio/catalogueDraftTypes";
import type { AuthoritativeMultilingualSource } from "@/features/governedMultilingual";

/** Channel-specific copy keys owned by Point 50 — tone/format adaptation only. */
export const GOVERNED_CHANNEL_COPY_KEYS = [
  "b2b_sales_copy",
  "export_catalogue_copy",
  "whatsapp_product_message",
  "storage_shelf_life_copy",
] as const;

export type GovernedChannelCopyKey = (typeof GOVERNED_CHANNEL_COPY_KEYS)[number];

export type GovernedChannel =
  | "catalogue_listing"
  | "b2b_web"
  | "export_catalogue"
  | "whatsapp"
  | "label_print";

export const CHANNEL_KEY_TO_CHANNEL: Record<GovernedChannelCopyKey, GovernedChannel> = {
  b2b_sales_copy: "b2b_web",
  export_catalogue_copy: "export_catalogue",
  whatsapp_product_message: "whatsapp",
  storage_shelf_life_copy: "label_print",
};

export type GovernedChannelCopyService =
  | "heuristic"
  | "catalogue-ai-copy"
  | "channel-copy-provider";

export type GovernedChannelCopyProviderStatus = "ok" | "degraded" | "failed";

/**
 * Point48/49-approved source + authoritative product/compliance facts for channel adaptation.
 * Channel generators may adjust length/tone/format only — never invent facts.
 */
export type AuthoritativeChannelSource = AuthoritativeMultilingualSource & {
  b2b_price?: number | null;
  mrp?: number | null;
  b2b_uom?: string | null;
  moq_text?: string | null;
  moq_value?: number | null;
  moq_uom?: string | null;
  hsn_code?: string | null;
  gst_rate?: number | null;
  net_weight_g?: number | null;
  shelf_life_days?: number | null;
  storage_instructions?: string | null;
  temperature_requirement?: string | null;
};

export type GovernedChannelFieldSuggestion = {
  key: GovernedChannelCopyKey;
  channel: GovernedChannel;
  value: string;
  suggestion_only: true;
  approved: false;
  review_status: "pending_review";
  source_version: string;
  multilingual_source_version: string;
  truncated: boolean;
};

export type GovernedChannelCopyProvenance = {
  service: GovernedChannelCopyService;
  provider_status: GovernedChannelCopyProviderStatus;
  prompt_version: string;
  source_version: string;
  multilingual_source_version: string;
  source_identity: string;
  used_heuristic_fallback: boolean;
  fail_closed: boolean;
  uncertainty_reason?: string;
  invoked_at: string;
};

export type GovernedChannelCopySuggestionResult =
  | {
      ok: true;
      suggestion_only: true;
      approved: false;
      human_review_required: true;
      disclaimer: string;
      suggestions: GovernedChannelFieldSuggestion[];
      provenance: GovernedChannelCopyProvenance;
    }
  | {
      ok: false;
      suggestion_only: true;
      approved: false;
      human_review_required: true;
      disclaimer: string;
      reason: string;
      provenance: GovernedChannelCopyProvenance;
    };

export type GovernedChannelCopyValidationResult =
  | { ok: true; content: Pick<import("@/features/catalogueAiStudio/catalogueDraftTypes").CatalogueDraftContent, GovernedChannelCopyKey> }
  | { ok: false; reason: string; unsafe_fields?: CatalogueDraftContentKey[] };

export type ChannelResolutionResult = {
  channel: GovernedChannel | "unsupported";
  availability: "available" | "unsupported";
  reason?: string;
};
