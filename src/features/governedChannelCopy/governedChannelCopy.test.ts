import { describe, expect, it } from "vitest";
import { GOVERNED_NAMING_PROMPT_VERSION } from "@/features/governedProductNaming";
import {
  buildHeuristicChannelSuggestions,
  CHANNEL_COPY_CHARACTER_LIMITS,
  channelSuggestionsToContent,
  truncateChannelCopySafely,
  validateGovernedChannelCopy,
  validateProviderChannelEnvelope,
} from "./governedChannelCopyContract";
import { mockChannelCopyProvider } from "./governedChannelCopyProvider";

const SOURCE = {
  product_name: "Cashew Pyramid Baklawa",
  category: "Baklawa",
  source_version: GOVERNED_NAMING_PROMPT_VERSION,
  b2b_price: 850,
  mrp: 999,
  b2b_uom: "box",
  moq_value: 12,
  moq_uom: "boxes",
  hsn_code: "19059090",
  gst_rate: 18,
  net_weight_g: 500,
  shelf_life_days: 105,
  storage_instructions: "Store in a cool dry place",
};

describe("Point50 governed channel copy", () => {
  it("generates all governed channels as review-only suggestions", () => {
    const result = buildHeuristicChannelSuggestions(SOURCE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.suggestions).toHaveLength(4);
    expect(result.human_review_required).toBe(true);
    expect(result.approved).toBe(false);
    for (const row of result.suggestions) {
      expect(row.suggestion_only).toBe(true);
      expect(row.approved).toBe(false);
    }
  });

  it("uses only authoritative price values", () => {
    const result = buildHeuristicChannelSuggestions(SOURCE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const content = channelSuggestionsToContent(result.suggestions);
    expect(content.b2b_sales_copy).toContain("₹850");
    expect(content.whatsapp_product_message).toContain("₹850");
    expect(JSON.stringify(content)).not.toContain("₹99999");
  });

  it("rejects invented prices", () => {
    const result = mockChannelCopyProvider(SOURCE, "invented_price");
    expect(result.parseResult.ok).toBe(false);
  });

  it("rejects unapproved compliance claims", () => {
    const result = mockChannelCopyProvider(SOURCE, "unapproved_compliance_claim");
    expect(result.parseResult.ok).toBe(false);
  });

  it("requires human-review provider markers", () => {
    const result = mockChannelCopyProvider(SOURCE, "missing_review_marker");
    expect(result.parseResult.ok).toBe(false);
    expect(
      validateProviderChannelEnvelope({
        ok: true,
        human_review_required: true,
        suggestion_only: true,
        approved: false,
        source_version: GOVERNED_NAMING_PROMPT_VERSION,
        channel_prompt_version: "point50-v1",
      }).ok,
    ).toBe(true);
  });

  it("fails closed on a stale source version", () => {
    expect(buildHeuristicChannelSuggestions({ ...SOURCE, source_version: "stale" }).ok).toBe(false);
  });

  it("preserves product identity during truncation", () => {
    const long = `${SOURCE.product_name} ${"x".repeat(1200)}`;
    const result = truncateChannelCopySafely(long, "whatsapp_product_message", SOURCE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain(SOURCE.product_name);
    expect(result.value.length).toBeLessThanOrEqual(
      CHANNEL_COPY_CHARACTER_LIMITS.whatsapp_product_message,
    );
  });

  it("validates a complete generated channel payload", () => {
    const generated = buildHeuristicChannelSuggestions(SOURCE);
    expect(generated.ok).toBe(true);
    if (!generated.ok) return;
    expect(
      validateGovernedChannelCopy(channelSuggestionsToContent(generated.suggestions), SOURCE).ok,
    ).toBe(true);
  });

  it("never performs WhatsApp send or publication actions", () => {
    const generated = buildHeuristicChannelSuggestions(SOURCE);
    expect(generated.ok).toBe(true);
    const moduleText = `${buildHeuristicChannelSuggestions}${validateGovernedChannelCopy}`;
    expect(moduleText).not.toContain("sendMessage");
    expect(moduleText).not.toContain("publish");
  });
});
