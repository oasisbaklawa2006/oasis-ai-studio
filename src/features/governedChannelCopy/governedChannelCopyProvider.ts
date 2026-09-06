import type { CatalogueDraftContent } from "@/features/catalogueAiStudio/catalogueDraftTypes";
import { GOVERNED_NAMING_PROMPT_VERSION } from "@/features/governedProductNaming";
import {
  buildHeuristicChannelSuggestions,
  channelSuggestionsToContent,
  validateChannelCopyText,
  validateGovernedChannelCopy,
  validateProviderChannelEnvelope,
} from "./governedChannelCopyContract";
import type { AuthoritativeChannelSource } from "./types";

export type MockChannelCopyScenario =
  | "ok"
  | "missing_review_marker"
  | "invented_price"
  | "unapproved_compliance_claim"
  | "missing_source_version";

/**
 * Deterministic mocked channel-copy provider for tests and offline harnesses.
 * Never performs network I/O, WhatsApp send, web publish, or label print.
 */
export function mockChannelCopyProvider(
  source: AuthoritativeChannelSource,
  scenario: MockChannelCopyScenario = "ok",
): {
  envelope: Record<string, unknown>;
  parseResult: ReturnType<typeof validateGovernedChannelCopy>;
} {
  const heuristic = buildHeuristicChannelSuggestions(source);
  if (!heuristic.ok) {
    return {
      envelope: { ok: false, reason: heuristic.reason },
      parseResult: { ok: false, reason: heuristic.reason },
    };
  }

  let suggestions = heuristic.suggestions;
  if (scenario === "invented_price") {
    suggestions = suggestions.map((s) =>
      s.key === "export_catalogue_copy"
        ? { ...s, value: `${source.product_name} · HSN 1704 · GST 12% · ₹99999` }
        : s,
    );
  }
  if (scenario === "unapproved_compliance_claim") {
    suggestions = suggestions.map((s) =>
      s.key === "storage_shelf_life_copy"
        ? { ...s, value: `${s.value} FSSAI approved organic certified.` }
        : s,
    );
  }

  const content = channelSuggestionsToContent(suggestions);

  const envelope: Record<string, unknown> = {
    ok: true,
    suggestion_only: true,
    approved: false,
    human_review_required: scenario !== "missing_review_marker",
    source_version:
      scenario === "missing_source_version" ? "" : GOVERNED_NAMING_PROMPT_VERSION,
    channel_prompt_version: "point50-mock-v1",
    content,
    provenance: {
      service: "channel-copy-provider",
      prompt_version: "point50-mock-v1",
    },
  };

  const reviewCheck = validateProviderChannelEnvelope(envelope);
  if (!reviewCheck.ok) {
    return { envelope, parseResult: { ok: false, reason: reviewCheck.reason } };
  }

  for (const row of suggestions) {
    const check = validateChannelCopyText(row.value, row.key, source);
    if (!check.ok) {
      return { envelope, parseResult: { ok: false, reason: check.reason } };
    }
  }

  return {
    envelope,
    parseResult: validateGovernedChannelCopy(content, source),
  };
}

export function buildAuthoritativeChannelSource(
  input: Partial<AuthoritativeChannelSource> & { product_name: string },
): AuthoritativeChannelSource {
  return {
    source_version: GOVERNED_NAMING_PROMPT_VERSION,
    ...input,
  };
}

export function mergeChannelCopyIntoDraftContent(
  base: CatalogueDraftContent,
  channelContent: Pick<
    CatalogueDraftContent,
    "b2b_sales_copy" | "export_catalogue_copy" | "whatsapp_product_message" | "storage_shelf_life_copy"
  >,
): CatalogueDraftContent {
  return { ...base, ...channelContent };
}
