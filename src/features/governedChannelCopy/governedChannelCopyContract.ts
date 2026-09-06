import type { CatalogueDraftContent } from "@/features/catalogueAiStudio/catalogueDraftTypes";
import {
  detectUnsafeNamingClaims,
  GOVERNED_NAMING_PROMPT_VERSION,
  validateNamingText,
  validateProductIdentity,
} from "@/features/governedProductNaming";
import {
  GOVERNED_MULTILINGUAL_PROMPT_VERSION,
  validateMultilingualSource,
} from "@/features/governedMultilingual";
import {
  CHANNEL_KEY_TO_CHANNEL,
  GOVERNED_CHANNEL_COPY_KEYS,
  type AuthoritativeChannelSource,
  type GovernedChannel,
  type GovernedChannelCopyKey,
  type GovernedChannelCopyProvenance,
  type GovernedChannelCopyService,
  type GovernedChannelCopySuggestionResult,
  type GovernedChannelCopyValidationResult,
  type GovernedChannelFieldSuggestion,
  type ChannelResolutionResult,
} from "./types";

export const GOVERNED_CHANNEL_COPY_DISCLAIMER =
  "Channel copy suggestion only. Review and approve before publication, WhatsApp send, web publish, or label print — never canonical product truth.";

export const GOVERNED_CHANNEL_COPY_PROMPT_VERSION = "point50-v1";

export const PENDING_CHANNEL_COPY_MARKER =
  "[Channel copy pending — approved Point48/49 source copy required.]";

/** Character limits per channel — truncation must preserve product identity and factual meaning. */
export const CHANNEL_COPY_CHARACTER_LIMITS: Record<GovernedChannelCopyKey, number> = {
  b2b_sales_copy: 500,
  export_catalogue_copy: 400,
  whatsapp_product_message: 1024,
  storage_shelf_life_copy: 300,
};

const LABEL_COMPLIANCE_CLAIM_PATTERN =
  /\b(certified|fda approved|fssai approved|organic certified|halal certified|kosher certified|gmp certified|iso \d+)\b/i;
const INVENTED_PRICE_PATTERN = /₹\s*[\d,.]+/g;

function hasText(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function hasNumber(value: number | null | undefined): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

function sourceIdentity(source: AuthoritativeChannelSource): string {
  return source.product_name.trim().toLowerCase();
}

function provenance(
  service: GovernedChannelCopyService,
  source: AuthoritativeChannelSource,
  options: Partial<GovernedChannelCopyProvenance> = {},
): GovernedChannelCopyProvenance {
  return {
    service,
    provider_status: options.provider_status ?? "ok",
    prompt_version: GOVERNED_CHANNEL_COPY_PROMPT_VERSION,
    source_version: source.source_version,
    multilingual_source_version: GOVERNED_MULTILINGUAL_PROMPT_VERSION,
    source_identity: sourceIdentity(source),
    used_heuristic_fallback: options.used_heuristic_fallback ?? service === "heuristic",
    fail_closed: options.fail_closed ?? false,
    uncertainty_reason: options.uncertainty_reason,
    invoked_at: new Date().toISOString(),
  };
}

function failClosed(
  service: GovernedChannelCopyService,
  source: AuthoritativeChannelSource,
  reason: string,
  options: Partial<GovernedChannelCopyProvenance> = {},
): GovernedChannelCopySuggestionResult {
  return {
    ok: false,
    suggestion_only: true,
    approved: false,
    human_review_required: true,
    disclaimer: GOVERNED_CHANNEL_COPY_DISCLAIMER,
    reason,
    provenance: provenance(service, source, {
      fail_closed: true,
      provider_status: "failed",
      ...options,
    }),
  };
}

function suggestion(
  source: AuthoritativeChannelSource,
  key: GovernedChannelCopyKey,
  value: string,
  truncated = false,
): GovernedChannelFieldSuggestion {
  return {
    key,
    channel: CHANNEL_KEY_TO_CHANNEL[key],
    value: value.trim(),
    suggestion_only: true,
    approved: false,
    review_status: "pending_review",
    source_version: source.source_version,
    multilingual_source_version: GOVERNED_MULTILINGUAL_PROMPT_VERSION,
    truncated,
  };
}

const SUPPORTED_CHANNELS: readonly GovernedChannel[] = [
  "catalogue_listing",
  "b2b_web",
  "export_catalogue",
  "whatsapp",
  "label_print",
];

export function isGovernedChannelCopyKey(key: string): key is GovernedChannelCopyKey {
  return (GOVERNED_CHANNEL_COPY_KEYS as readonly string[]).includes(key);
}

export function isSupportedChannel(channel: string): channel is GovernedChannel {
  return (SUPPORTED_CHANNELS as readonly string[]).includes(channel);
}

/** Fail closed when channel is outside the governed support matrix. */
export function resolveChannel(channel: string): ChannelResolutionResult {
  if (!isSupportedChannel(channel)) {
    return {
      channel: "unsupported",
      availability: "unsupported",
      reason: `Channel "${channel}" is not in the governed support matrix.`,
    };
  }
  return { channel, availability: "available" };
}

/** Requires Point48 identity, Point49 source_version pin, and naming prompt version alignment. */
export function validateChannelSource(
  source: AuthoritativeChannelSource,
): { ok: true } | { ok: false; reason: string } {
  const multilingualCheck = validateMultilingualSource(source);
  if (!multilingualCheck.ok) return multilingualCheck;
  if (source.source_version !== GOVERNED_NAMING_PROMPT_VERSION) {
    return {
      ok: false,
      reason: `Unsupported source_version "${source.source_version}" — expected ${GOVERNED_NAMING_PROMPT_VERSION}.`,
    };
  }
  return { ok: true };
}

function moqLabel(source: AuthoritativeChannelSource): string | null {
  if (hasText(source.moq_text)) return source.moq_text!.trim();
  if (hasNumber(source.moq_value)) {
    return `${source.moq_value}${hasText(source.moq_uom) ? ` ${source.moq_uom}` : ""}`;
  }
  return null;
}

function displayPrice(
  source: AuthoritativeChannelSource,
): { label: "B2B price" | "MRP"; amount: number } | null {
  if (hasNumber(source.b2b_price)) return { label: "B2B price", amount: source.b2b_price! };
  if (hasNumber(source.mrp)) return { label: "MRP", amount: source.mrp! };
  return null;
}

const MISSING_FIELD = (field: string) => `Add missing field first: ${field}.`;

function buildB2bSalesCopy(source: AuthoritativeChannelSource): string {
  if (!hasText(source.product_name)) return MISSING_FIELD("Product Name");
  if (!hasNumber(source.b2b_price)) {
    return `${source.product_name} is available for wholesale. ${MISSING_FIELD("B2B price")}`;
  }
  const moq = moqLabel(source);
  const moqPart = moq ? ` MOQ: ${moq}.` : " Add MOQ for a complete pitch.";
  const uomPart = hasText(source.b2b_uom) ? `/${source.b2b_uom}` : "";
  return `${source.product_name} — B2B base ₹${source.b2b_price}${uomPart}.${moqPart}`;
}

function buildExportCatalogueCopy(source: AuthoritativeChannelSource): string {
  if (!hasText(source.product_name)) return MISSING_FIELD("Product Name");
  const parts: string[] = [source.product_name.trim()];
  parts.push(hasText(source.hsn_code) ? `HSN ${source.hsn_code}` : MISSING_FIELD("HSN Code"));
  parts.push(
    typeof source.gst_rate === "number"
      ? `GST ${source.gst_rate}%`
      : MISSING_FIELD("GST Rate"),
  );
  if (hasNumber(source.net_weight_g)) parts.push(`Net wt ${source.net_weight_g}g`);
  return parts.join(" · ");
}

function buildWhatsappProductMessage(source: AuthoritativeChannelSource): string {
  if (!hasText(source.product_name)) return MISSING_FIELD("Product Name");
  const price = displayPrice(source);
  if (!price) {
    return `Hi! We have *${source.product_name}* available. ${MISSING_FIELD("a price (MRP or B2B price)")} Reply to know more.`;
  }
  const uomPart =
    price.label === "B2B price" && hasText(source.b2b_uom) ? `/${source.b2b_uom}` : "";
  return `Hi! We have *${source.product_name}* available — ${price.label} ₹${price.amount}${uomPart}. Reply to know more.`;
}

function buildStorageShelfLifeCopy(source: AuthoritativeChannelSource): string {
  const hasShelf = hasNumber(source.shelf_life_days);
  const hasStorage =
    hasText(source.storage_instructions) || hasText(source.temperature_requirement);
  if (!hasShelf && !hasStorage) return MISSING_FIELD("Shelf Life and Storage Instructions");
  const shelf = hasShelf
    ? `Shelf life: ${source.shelf_life_days} days.`
    : MISSING_FIELD("Shelf Life");
  const storageText = [source.storage_instructions, source.temperature_requirement]
    .filter(hasText)
    .join(" · ");
  const storage = hasStorage ? `Store: ${storageText}.` : MISSING_FIELD("Storage Instructions");
  return `${shelf} ${storage}`;
}

/**
 * Truncate channel copy without dropping the approved product name or changing factual meaning.
 * Returns null when safe truncation is impossible.
 */
export function truncateChannelCopySafely(
  text: string,
  key: GovernedChannelCopyKey,
  source: AuthoritativeChannelSource,
): { ok: true; value: string; truncated: boolean } | { ok: false; reason: string } {
  const limit = CHANNEL_COPY_CHARACTER_LIMITS[key];
  const trimmed = text.trim();
  if (trimmed.length <= limit) {
    return { ok: true, value: trimmed, truncated: false };
  }

  const productName = source.product_name.trim();
  if (!trimmed.includes(productName)) {
    return {
      ok: false,
      reason: `Cannot truncate ${key} safely — approved product_name would be lost.`,
    };
  }

  const ellipsis = "…";
  const maxBody = limit - ellipsis.length;
  if (maxBody < productName.length + 4) {
    return {
      ok: false,
      reason: `Cannot truncate ${key} safely within ${limit} characters while preserving product_name.`,
    };
  }

  const truncated = `${trimmed.slice(0, maxBody).trimEnd()}${ellipsis}`;
  if (!truncated.includes(productName)) {
    return {
      ok: false,
      reason: `Truncation of ${key} would remove approved product_name — fail closed.`,
    };
  }

  const unsafe = detectUnsafeNamingClaims(truncated, source);
  if (unsafe.length > 0) {
    return { ok: false, reason: `Truncation introduced unsafe claims: ${unsafe.join("; ")}` };
  }

  return { ok: true, value: truncated, truncated: true };
}

/** Detect invented prices or unapproved label/compliance claims in channel copy. */
export function detectChannelFactualDrift(
  text: string,
  source: AuthoritativeChannelSource,
  key: GovernedChannelCopyKey,
): string[] {
  const reasons: string[] = [];
  const unsafe = detectUnsafeNamingClaims(text, source);
  reasons.push(...unsafe);

  if (LABEL_COMPLIANCE_CLAIM_PATTERN.test(text)) {
    const match = text.match(LABEL_COMPLIANCE_CLAIM_PATTERN);
    if (match) reasons.push(`unapproved legal/compliance claim: ${match[0]}`);
  }

  const priceMatches = [...text.matchAll(INVENTED_PRICE_PATTERN)].map((m) => m[0]);
  const authoritativePrices = new Set<string>();
  if (hasNumber(source.b2b_price)) authoritativePrices.add(`₹${source.b2b_price}`);
  if (hasNumber(source.mrp)) authoritativePrices.add(`₹${source.mrp}`);

  for (const priceToken of priceMatches) {
    const normalized = priceToken.replace(/\s+/g, "");
    const allowed = [...authoritativePrices].some(
      (p) => normalized.startsWith(p.replace(/\s+/g, "")),
    );
    if (!allowed) {
      reasons.push(`invented price in channel copy: ${priceToken}`);
    }
  }

  if (key === "export_catalogue_copy") {
    if (hasText(source.hsn_code) && !text.includes(source.hsn_code!)) {
      reasons.push("export copy missing authoritative HSN code");
    }
    if (typeof source.gst_rate === "number" && !text.includes(`${source.gst_rate}`)) {
      reasons.push("export copy missing authoritative GST rate");
    }
  }

  return reasons;
}

export function validateChannelCopyText(
  text: string,
  key: GovernedChannelCopyKey,
  source: AuthoritativeChannelSource,
): { ok: true } | { ok: false; reason: string } {
  const namingCheck = validateNamingText(text, source);
  if (!namingCheck.ok) return namingCheck;

  const drift = detectChannelFactualDrift(text, source, key);
  if (drift.length > 0) {
    return { ok: false, reason: drift.join("; ") };
  }

  if (key === "whatsapp_product_message" && hasText(source.product_name)) {
    if (!text.includes(source.product_name.trim())) {
      return {
        ok: false,
        reason: "WhatsApp channel copy must preserve approved product_name.",
      };
    }
  }

  return { ok: true };
}

const CHANNEL_BUILDERS: Record<
  GovernedChannelCopyKey,
  (source: AuthoritativeChannelSource) => string
> = {
  b2b_sales_copy: buildB2bSalesCopy,
  export_catalogue_copy: buildExportCatalogueCopy,
  whatsapp_product_message: buildWhatsappProductMessage,
  storage_shelf_life_copy: buildStorageShelfLifeCopy,
};

/** Deterministic channel copy from Point48/49-approved source — no provider call. */
export function buildHeuristicChannelSuggestions(
  source: AuthoritativeChannelSource,
): GovernedChannelCopySuggestionResult {
  const sourceCheck = validateChannelSource(source);
  if (!sourceCheck.ok) {
    return failClosed("heuristic", source, sourceCheck.reason);
  }

  const suggestions: GovernedChannelFieldSuggestion[] = [];

  for (const key of GOVERNED_CHANNEL_COPY_KEYS) {
    const raw = CHANNEL_BUILDERS[key](source);
    const truncated = truncateChannelCopySafely(raw, key, source);
    if (!truncated.ok) {
      return failClosed("heuristic", source, truncated.reason);
    }

    const check = validateChannelCopyText(truncated.value, key, source);
    if (!check.ok) {
      return failClosed("heuristic", source, check.reason);
    }

    suggestions.push(suggestion(source, key, truncated.value, truncated.truncated));
  }

  return {
    ok: true,
    suggestion_only: true,
    approved: false,
    human_review_required: true,
    disclaimer: GOVERNED_CHANNEL_COPY_DISCLAIMER,
    suggestions,
    provenance: provenance("heuristic", source),
  };
}

export function channelSuggestionsToContent(
  suggestions: GovernedChannelFieldSuggestion[],
): Pick<CatalogueDraftContent, GovernedChannelCopyKey> {
  const out = {} as Pick<CatalogueDraftContent, GovernedChannelCopyKey>;
  for (const row of suggestions) {
    out[row.key] = row.value;
  }
  return out;
}

/** Validates channel-specific catalogue draft fields against Point48/49 source contract. */
export function validateGovernedChannelCopy(
  content: Pick<CatalogueDraftContent, GovernedChannelCopyKey>,
  source: AuthoritativeChannelSource,
): GovernedChannelCopyValidationResult {
  const sourceCheck = validateChannelSource(source);
  if (!sourceCheck.ok) {
    return { ok: false, reason: sourceCheck.reason };
  }

  const identity = validateProductIdentity(source);
  if (!identity.ok) {
    return { ok: false, reason: identity.reason };
  }

  const unsafeFields: GovernedChannelCopyKey[] = [];
  for (const key of GOVERNED_CHANNEL_COPY_KEYS) {
    const value = content[key];
    if (!hasText(value)) {
      return { ok: false, reason: `Channel copy missing or invalid value for: ${key}.` };
    }
    const check = validateChannelCopyText(value, key, source);
    if (!check.ok) unsafeFields.push(key);
  }

  if (unsafeFields.length > 0) {
    return {
      ok: false,
      reason: `Channel copy contained factual drift or unsafe claims in: ${unsafeFields.join(", ")}.`,
      unsafe_fields: unsafeFields,
    };
  }

  return { ok: true, content };
}

/** Provider envelope must carry human-review handoff markers and source version pins. */
export function validateProviderChannelEnvelope(
  payload: unknown,
): { ok: true } | { ok: false; reason: string } {
  if (!payload || typeof payload !== "object") {
    return { ok: false, reason: "Channel copy provider response could not be parsed." };
  }
  const row = payload as Record<string, unknown>;
  if (row.ok !== true) {
    return { ok: false, reason: "Channel copy generation service returned a failure envelope." };
  }
  if (row.human_review_required !== true) {
    return {
      ok: false,
      reason: "Channel copy response missing required human_review_required marker.",
    };
  }
  if (row.suggestion_only === false || row.approved === true) {
    return { ok: false, reason: "Channel copy response attempted to bypass review-only contract." };
  }
  if (!hasText(String(row.source_version ?? ""))) {
    return { ok: false, reason: "Channel copy response missing required source_version pin." };
  }
  if (!hasText(String(row.channel_prompt_version ?? ""))) {
    return {
      ok: false,
      reason: "Channel copy response missing required channel_prompt_version pin.",
    };
  }
  return { ok: true };
}

export function serializeChannelSuggestions(
  suggestions: GovernedChannelFieldSuggestion[],
): string {
  return JSON.stringify(
    suggestions.map((s) => ({
      key: s.key,
      channel: s.channel,
      value: s.value,
      truncated: s.truncated,
      review_status: s.review_status,
      source_version: s.source_version,
      multilingual_source_version: s.multilingual_source_version,
      suggestion_only: s.suggestion_only,
      approved: s.approved,
    })),
  );
}
