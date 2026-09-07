import { describe, expect, it } from "vitest";
import { GOVERNED_NAMING_PROMPT_VERSION } from "@/features/governedProductNaming";
import {
  buildHeuristicChannelSuggestions,
  CHANNEL_COPY_CHARACTER_LIMITS,
  channelSuggestionsToContent,
  detectChannelFactualDrift,
  resolveChannel,
  serializeChannelSuggestions,
  truncateChannelCopySafely,
  validateChannelCopyText,
  validateChannelSource,
  validateGovernedChannelCopy,
  validateProviderChannelEnvelope,
} from "./governedChannelCopyContract";
import { mockChannelCopyProvider } from "./governedChannelCopyProvider";
import type { AuthoritativeChannelSource } from "./types";

const BASE_SOURCE: AuthoritativeChannelSource = {
  product_name: "Cashew Pyramid Baklawa",
  category: "Baklawa",
  product_type: "Arabic sweets",
  pack_size: "500g",
  source_version: GOVERNED_NAMING_PROMPT_VERSION,
  b2b_price: 650,
  b2b_uom: "kg",
  moq_text: "10 boxes",
  hsn_code: "1704",
  gst_rate: 12,
  net_weight_g: 500,
  shelf_life_days: 30,
  storage_instructions: "Store in a cool dry place",
  mrp: 750,
  description: "Layered filo with cashew filling.",
  approved_short_description: "Layered filo with cashew filling.",
};

describe("validateChannelSource", () => {
  it("fails closed without source_version pin", () => {
    expect(validateChannelSource({ product_name: "Test", source_version: "" }).ok).toBe(false);
  });

  it("fails closed on unsupported source_version", () => {
    expect(
      validateChannelSource({ product_name: "Test", source_version: "legacy-v0" }).ok,
    ).toBe(false);
  });

  it("accepts Point48/49 identity with pinned source version", () => {
    expect(validateChannelSource(BASE_SOURCE).ok).toBe(true);
  });
});

describe("resolveChannel", () => {
  it("resolves supported channels", () => {
    expect(resolveChannel("whatsapp").availability).toBe("available");
    expect(resolveChannel("label_print").channel).toBe("label_print");
  });

  it("fails closed on unsupported channel", () => {
    const result = resolveChannel("social_media");
    expect(result.channel).toBe("unsupported");
    expect(result.availability).toBe("unsupported");
  });
});

describe("buildHeuristicChannelSuggestions", () => {
  it("grounds channel copy in authoritative facts with review envelope", () => {
    const result = buildHeuristicChannelSuggestions(BASE_SOURCE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.suggestion_only).toBe(true);
    expect(result.approved).toBe(false);
    expect(result.human_review_required).toBe(true);
    expect(result.suggestions).toHaveLength(4);
    expect(result.provenance.service).toBe("heuristic");
    expect(result.provenance.source_version).toBe(GOVERNED_NAMING_PROMPT_VERSION);
  });

  it("preserves approved product_name in WhatsApp channel copy", () => {
    const result = buildHeuristicChannelSuggestions(BASE_SOURCE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const whatsapp = result.suggestions.find((s) => s.key === "whatsapp_product_message");
    expect(whatsapp?.value).toContain("Cashew Pyramid Baklawa");
    expect(whatsapp?.value).toContain("*");
  });

  it("includes authoritative B2B price and MOQ in b2b channel copy", () => {
    const result = buildHeuristicChannelSuggestions(BASE_SOURCE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const b2b = result.suggestions.find((s) => s.key === "b2b_sales_copy");
    expect(b2b?.value).toContain("₹650");
    expect(b2b?.value).toContain("MOQ: 10 boxes");
  });

  it("includes HSN and GST in export channel copy", () => {
    const result = buildHeuristicChannelSuggestions(BASE_SOURCE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const exportCopy = result.suggestions.find((s) => s.key === "export_catalogue_copy");
    expect(exportCopy?.value).toContain("HSN 1704");
    expect(exportCopy?.value).toContain("GST 12%");
  });

  it("fails closed without product identity", () => {
    const result = buildHeuristicChannelSuggestions({ ...BASE_SOURCE, product_name: "" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.provenance.fail_closed).toBe(true);
  });

  it("never emits unapproved compliance claims in label channel copy", () => {
    const result = buildHeuristicChannelSuggestions(BASE_SOURCE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const label = result.suggestions.find((s) => s.key === "storage_shelf_life_copy");
    expect(label?.value.toLowerCase()).not.toContain("fssai approved");
    expect(label?.value.toLowerCase()).not.toContain("organic certified");
  });
});

describe("truncateChannelCopySafely", () => {
  it("passes through copy within character limit", () => {
    const short = "Short WhatsApp draft.";
    const result = truncateChannelCopySafely(short, "whatsapp_product_message", BASE_SOURCE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.truncated).toBe(false);
  });

  it("truncates long copy while preserving product_name", () => {
    const longText = `${"A".repeat(900)} ${BASE_SOURCE.product_name} ${"B".repeat(200)}`;
    const result = truncateChannelCopySafely(longText, "whatsapp_product_message", BASE_SOURCE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.truncated).toBe(true);
    expect(result.value.length).toBeLessThanOrEqual(
      CHANNEL_COPY_CHARACTER_LIMITS.whatsapp_product_message,
    );
    expect(result.value).toContain(BASE_SOURCE.product_name);
  });

  it("fails closed when truncation would drop product_name", () => {
    const longText = "X".repeat(CHANNEL_COPY_CHARACTER_LIMITS.whatsapp_product_message + 50);
    const result = truncateChannelCopySafely(longText, "whatsapp_product_message", BASE_SOURCE);
    expect(result.ok).toBe(false);
  });
});

describe("detectChannelFactualDrift", () => {
  it("flags invented prices in export channel copy", () => {
    const drift = detectChannelFactualDrift(
      "Cashew Pyramid Baklawa · HSN 1704 · GST 12% · ₹99999",
      BASE_SOURCE,
      "export_catalogue_copy",
    );
    expect(drift.some((r) => r.includes("invented price"))).toBe(true);
  });

  it("flags unapproved legal/compliance claims in label channel copy", () => {
    const drift = detectChannelFactualDrift(
      "Shelf life: 30 days. FSSAI approved organic certified.",
      BASE_SOURCE,
      "storage_shelf_life_copy",
    );
    expect(drift.some((r) => r.includes("compliance"))).toBe(true);
  });

  it("allows authoritative prices in WhatsApp channel copy", () => {
    const drift = detectChannelFactualDrift(
      `Hi! *${BASE_SOURCE.product_name}* — B2B price ₹650/kg.`,
      BASE_SOURCE,
      "whatsapp_product_message",
    );
    expect(drift.some((r) => r.includes("invented price"))).toBe(false);
  });

  it("flags invented prices in WhatsApp channel copy", () => {
    const drift = detectChannelFactualDrift(
      `Hi! *${BASE_SOURCE.product_name}* — ₹99999.`,
      BASE_SOURCE,
      "whatsapp_product_message",
    );
    expect(drift.some((r) => r.includes("invented price"))).toBe(true);
  });
});

describe("validateChannelCopyText", () => {
  it("rejects WhatsApp copy missing approved product_name", () => {
    const check = validateChannelCopyText(
      "Hi! We have a product available.",
      "whatsapp_product_message",
      BASE_SOURCE,
    );
    expect(check.ok).toBe(false);
  });

  it("accepts fact-grounded B2B channel copy", () => {
    const check = validateChannelCopyText(
      "Cashew Pyramid Baklawa — B2B base ₹650/kg. MOQ: 10 boxes.",
      "b2b_sales_copy",
      BASE_SOURCE,
    );
    expect(check.ok).toBe(true);
  });
});

describe("validateGovernedChannelCopy", () => {
  it("accepts fact-grounded channel fields", () => {
    const heuristic = buildHeuristicChannelSuggestions(BASE_SOURCE);
    expect(heuristic.ok).toBe(true);
    if (!heuristic.ok) return;
    const content = channelSuggestionsToContent(heuristic.suggestions);
    expect(validateGovernedChannelCopy(content, BASE_SOURCE).ok).toBe(true);
  });

  it("rejects channel copy with unapproved compliance claims", () => {
    const heuristic = buildHeuristicChannelSuggestions(BASE_SOURCE);
    expect(heuristic.ok).toBe(true);
    if (!heuristic.ok) return;
    const content = channelSuggestionsToContent(heuristic.suggestions);
    content.storage_shelf_life_copy = `${content.storage_shelf_life_copy} FSSAI approved.`;
    const result = validateGovernedChannelCopy(content, BASE_SOURCE);
    expect(result.ok).toBe(false);
  });
});

describe("validateProviderChannelEnvelope", () => {
  it("requires human_review_required and source_version pins", () => {
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

    expect(
      validateProviderChannelEnvelope({
        ok: true,
        human_review_required: false,
        suggestion_only: true,
        approved: false,
        source_version: GOVERNED_NAMING_PROMPT_VERSION,
        channel_prompt_version: "point50-v1",
      }).ok,
    ).toBe(false);
  });
});

describe("mockChannelCopyProvider", () => {
  it("returns ok scenario with review envelope", () => {
    const { envelope, parseResult } = mockChannelCopyProvider(BASE_SOURCE, "ok");
    expect(envelope.human_review_required).toBe(true);
    expect(parseResult.ok).toBe(true);
  });

  it("fails on invented price scenario", () => {
    const { parseResult } = mockChannelCopyProvider(BASE_SOURCE, "invented_price");
    expect(parseResult.ok).toBe(false);
  });

  it("fails on unapproved compliance claim scenario", () => {
    const { parseResult } = mockChannelCopyProvider(BASE_SOURCE, "unapproved_compliance_claim");
    expect(parseResult.ok).toBe(false);
  });

  it("fails when review marker is missing", () => {
    const { parseResult } = mockChannelCopyProvider(BASE_SOURCE, "missing_review_marker");
    expect(parseResult.ok).toBe(false);
  });
});

describe("serializeChannelSuggestions", () => {
  it("serializes review state for audit handoff", () => {
    const result = buildHeuristicChannelSuggestions(BASE_SOURCE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const serialized = serializeChannelSuggestions(result.suggestions);
    const parsed = JSON.parse(serialized) as Array<Record<string, unknown>>;
    expect(parsed[0].suggestion_only).toBe(true);
    expect(parsed[0].approved).toBe(false);
    expect(parsed[0].review_status).toBe("pending_review");
  });
});
