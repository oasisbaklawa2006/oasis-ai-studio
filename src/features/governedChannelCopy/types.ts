import type {
  CatalogueDraftContent,
  CatalogueDraftContentKey,
} from "@/features/catalogueAiStudio/catalogueDraftTypes";
import type { AuthoritativeMultilingualSource } from "@/features/governedMultilingual";

export const GOVERNED_CHANNEL_COPY_KEYS = [
  "b2b_sales_copy",
  "export_catalogue_copy",
  "whatsapp_product_message",
  "storage_shelf_life_copy",
] as const;

export type GovernedChannelCopyKey = (typeof GOVERNED_CHANNEL_COPY_KEYS)[number];
export type GovernedChannel = "b2b_web" | "export_catalogue" | "whatsapp" | "label_print";

export const CHANNEL_KEY_TO_CHANNEL: Record<GovernedChannelCopyKey, GovernedChannel> = {
  b2b_sales_copy: "b2b_web",
  export_catalogue_copy: "export_catalogue",
  whatsapp_product_message: "whatsapp",
  storage_shelf_life_copy: "label_print",
};

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
  human_review_required: true;
  source_version: string;
  truncated: boolean;
};

export type GovernedChannelCopyResult =
  | {
      ok: true;
      suggestion_only: true;
      approved: false;
      human_review_required: true;
      suggestions: GovernedChannelFieldSuggestion[];
    }
  | {
      ok: false;
      suggestion_only: true;
      approved: false;
      human_review_required: true;
      reason: string;
    };

export type GovernedChannelCopyValidationResult =
  | { ok: true; content: Pick<CatalogueDraftContent, GovernedChannelCopyKey> }
  | { ok: false; reason: string; unsafe_fields?: CatalogueDraftContentKey[] };
