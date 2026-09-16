import type { CatalogueDraftContent } from "@/features/catalogueAiStudio/catalogueDraftTypes";
import { validateMultilingualSource } from "@/features/governedMultilingual";
import {
  GOVERNED_NAMING_PROMPT_VERSION,
  validateNamingText,
} from "@/features/governedProductNaming";
import {
  type AuthoritativeChannelSource,
  CHANNEL_KEY_TO_CHANNEL,
  GOVERNED_CHANNEL_COPY_KEYS,
  type GovernedChannelCopyKey,
  type GovernedChannelCopyResult,
  type GovernedChannelCopyValidationResult,
  type GovernedChannelFieldSuggestion,
} from "./types";

export const GOVERNED_CHANNEL_COPY_PROMPT_VERSION = "point50-v1";
export const GOVERNED_CHANNEL_COPY_DISCLAIMER =
  "Channel copy suggestion only. Human review is required before publication, sending, or printing.";

export const CHANNEL_COPY_CHARACTER_LIMITS: Record<GovernedChannelCopyKey, number> = {
  b2b_sales_copy: 500,
  export_catalogue_copy: 400,
  whatsapp_product_message: 1024,
  storage_shelf_life_copy: 300,
};

const LEGAL_CLAIM_PATTERN =
  /\b(fssai approved|fda approved|organic certified|halal certified|kosher certified|gmp certified|iso \d+)\b/i;
const PRICE_PATTERN = /₹\s*([\d,.]+)/g;

function hasText(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function validateChannelSource(
  source: AuthoritativeChannelSource,
): { ok: true } | { ok: false; reason: string } {
  const multilingual = validateMultilingualSource(source);
  if (multilingual.ok === false) return multilingual;
  if (source.source_version !== GOVERNED_NAMING_PROMPT_VERSION) {
    return {
      ok: false,
      reason: `Unsupported source_version "${source.source_version}"; expected ${GOVERNED_NAMING_PROMPT_VERSION}.`,
    };
  }
  return { ok: true };
}

function authorisedPrices(source: AuthoritativeChannelSource): Set<number> {
  const prices = new Set<number>();
  if (hasNumber(source.b2b_price)) prices.add(source.b2b_price);
  if (hasNumber(source.mrp)) prices.add(source.mrp);
  return prices;
}

export function detectChannelFactualDrift(
  text: string,
  source: AuthoritativeChannelSource,
): string[] {
  const reasons: string[] = [];
  if (LEGAL_CLAIM_PATTERN.test(text)) reasons.push("unapproved legal/compliance claim");
  const allowed = authorisedPrices(source);
  for (const match of text.matchAll(PRICE_PATTERN)) {
    const parsed = Number(match[1].replace(/,/g, ""));
    if (!Number.isFinite(parsed) || !allowed.has(parsed))
      reasons.push(`invented price: ${match[0]}`);
  }
  return reasons;
}

export function validateChannelCopyText(
  text: string,
  key: GovernedChannelCopyKey,
  source: AuthoritativeChannelSource,
): { ok: true } | { ok: false; reason: string } {
  if (!hasText(text)) return { ok: false, reason: `${key} is empty.` };
  if (text.trim().length > CHANNEL_COPY_CHARACTER_LIMITS[key]) {
    return { ok: false, reason: `${key} exceeds its character limit.` };
  }
  const naming = validateNamingText(text, source);
  if (naming.ok === false) return naming;
  const drift = detectChannelFactualDrift(text, source);
  if (drift.length) return { ok: false, reason: drift.join("; ") };
  if (key === "whatsapp_product_message" && !text.includes(source.product_name.trim())) {
    return { ok: false, reason: "WhatsApp draft must retain the approved product name." };
  }
  return { ok: true };
}

export function truncateChannelCopySafely(
  text: string,
  key: GovernedChannelCopyKey,
  source: AuthoritativeChannelSource,
): { ok: true; value: string; truncated: boolean } | { ok: false; reason: string } {
  const limit = CHANNEL_COPY_CHARACTER_LIMITS[key];
  const trimmed = text.trim();
  if (trimmed.length <= limit) return { ok: true, value: trimmed, truncated: false };
  const name = source.product_name.trim();
  if (!trimmed.startsWith(name) || name.length + 2 >= limit) {
    return { ok: false, reason: `Cannot truncate ${key} without losing approved identity.` };
  }
  const value = `${trimmed.slice(0, limit - 1).trimEnd()}…`;
  if (!value.includes(name))
    return { ok: false, reason: `Truncation removed approved product identity from ${key}.` };
  return { ok: true, value, truncated: true };
}

function moq(source: AuthoritativeChannelSource): string | null {
  if (hasText(source.moq_text)) return source.moq_text.trim();
  if (hasNumber(source.moq_value)) {
    return `${source.moq_value}${hasText(source.moq_uom) ? ` ${source.moq_uom.trim()}` : ""}`;
  }
  return null;
}

function generateRaw(key: GovernedChannelCopyKey, source: AuthoritativeChannelSource): string {
  const name = source.product_name.trim();
  switch (key) {
    case "b2b_sales_copy": {
      const price = hasNumber(source.b2b_price)
        ? `B2B base ₹${source.b2b_price}`
        : "B2B price pending";
      const unit =
        hasText(source.b2b_uom) && hasNumber(source.b2b_price) ? `/${source.b2b_uom.trim()}` : "";
      const minimum = moq(source);
      return `${name} — ${price}${unit}.${minimum ? ` MOQ: ${minimum}.` : " MOQ pending."}`;
    }
    case "export_catalogue_copy": {
      const parts = [name];
      if (hasText(source.hsn_code)) parts.push(`HSN ${source.hsn_code.trim()}`);
      if (hasNumber(source.gst_rate)) parts.push(`GST ${source.gst_rate}%`);
      if (hasNumber(source.net_weight_g)) parts.push(`Net wt ${source.net_weight_g}g`);
      return parts.join(" · ");
    }
    case "whatsapp_product_message": {
      const price = hasNumber(source.b2b_price)
        ? `B2B price ₹${source.b2b_price}${hasText(source.b2b_uom) ? `/${source.b2b_uom.trim()}` : ""}`
        : hasNumber(source.mrp)
          ? `MRP ₹${source.mrp}`
          : "price available on request";
      return `Hi! *${name}* is available — ${price}. Reply to know more.`;
    }
    case "storage_shelf_life_copy": {
      const shelf = hasNumber(source.shelf_life_days)
        ? `Shelf life: ${source.shelf_life_days} days.`
        : "Shelf life pending.";
      const storage = [source.storage_instructions, source.temperature_requirement]
        .filter(hasText)
        .map((value) => value.trim())
        .join(" · ");
      return `${name}. ${shelf}${storage ? ` Store: ${storage}.` : " Storage instructions pending."}`;
    }
  }
}

function suggestion(
  key: GovernedChannelCopyKey,
  value: string,
  source: AuthoritativeChannelSource,
  truncated: boolean,
): GovernedChannelFieldSuggestion {
  return {
    key,
    channel: CHANNEL_KEY_TO_CHANNEL[key],
    value,
    suggestion_only: true,
    approved: false,
    human_review_required: true,
    source_version: source.source_version,
    truncated,
  };
}

export function buildHeuristicChannelSuggestions(
  source: AuthoritativeChannelSource,
): GovernedChannelCopyResult {
  const sourceCheck = validateChannelSource(source);
  if (sourceCheck.ok === false) {
    return {
      ok: false,
      suggestion_only: true,
      approved: false,
      human_review_required: true,
      reason: sourceCheck.reason,
    };
  }
  const suggestions: GovernedChannelFieldSuggestion[] = [];
  for (const key of GOVERNED_CHANNEL_COPY_KEYS) {
    const truncation = truncateChannelCopySafely(generateRaw(key, source), key, source);
    if (truncation.ok === false) {
      return {
        ok: false,
        suggestion_only: true,
        approved: false,
        human_review_required: true,
        reason: truncation.reason,
      };
    }
    const validation = validateChannelCopyText(truncation.value, key, source);
    if (validation.ok === false) {
      return {
        ok: false,
        suggestion_only: true,
        approved: false,
        human_review_required: true,
        reason: validation.reason,
      };
    }
    suggestions.push(suggestion(key, truncation.value, source, truncation.truncated));
  }
  return {
    ok: true,
    suggestion_only: true,
    approved: false,
    human_review_required: true,
    suggestions,
  };
}

export function channelSuggestionsToContent(
  suggestions: GovernedChannelFieldSuggestion[],
): Pick<CatalogueDraftContent, GovernedChannelCopyKey> {
  const out = {} as Pick<CatalogueDraftContent, GovernedChannelCopyKey>;
  for (const row of suggestions) out[row.key] = row.value;
  return out;
}

export function validateGovernedChannelCopy(
  content: Pick<CatalogueDraftContent, GovernedChannelCopyKey>,
  source: AuthoritativeChannelSource,
): GovernedChannelCopyValidationResult {
  const sourceCheck = validateChannelSource(source);
  if (sourceCheck.ok === false) return sourceCheck;
  const unsafe: GovernedChannelCopyKey[] = [];
  for (const key of GOVERNED_CHANNEL_COPY_KEYS) {
    if (validateChannelCopyText(content[key], key, source).ok === false) unsafe.push(key);
  }
  return unsafe.length
    ? { ok: false, reason: `Unsafe channel copy: ${unsafe.join(", ")}.`, unsafe_fields: unsafe }
    : { ok: true, content };
}

export function validateProviderChannelEnvelope(
  payload: unknown,
): { ok: true } | { ok: false; reason: string } {
  if (!payload || typeof payload !== "object")
    return { ok: false, reason: "Invalid channel-copy envelope." };
  const row = payload as Record<string, unknown>;
  if (row.ok !== true || row.human_review_required !== true) {
    return { ok: false, reason: "Channel-copy response is not review-governed." };
  }
  if (row.suggestion_only !== true || row.approved !== false) {
    return { ok: false, reason: "Channel-copy response attempted to bypass human review." };
  }
  if (row.source_version !== GOVERNED_NAMING_PROMPT_VERSION) {
    return { ok: false, reason: "Channel-copy response used an unexpected source_version." };
  }
  if (row.channel_prompt_version !== GOVERNED_CHANNEL_COPY_PROMPT_VERSION) {
    return {
      ok: false,
      reason: "Channel-copy response used an unexpected channel_prompt_version.",
    };
  }
  return { ok: true };
}
