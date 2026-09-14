import { GOVERNED_NAMING_PROMPT_VERSION } from "@/features/governedProductNaming";
import {
  buildHeuristicChannelSuggestions,
  channelSuggestionsToContent,
  GOVERNED_CHANNEL_COPY_PROMPT_VERSION,
  validateGovernedChannelCopy,
  validateProviderChannelEnvelope,
} from "./governedChannelCopyContract";
import type { AuthoritativeChannelSource } from "./types";

export type MockChannelCopyScenario =
  | "ok"
  | "missing_review_marker"
  | "invented_price"
  | "unapproved_compliance_claim";

export function buildAuthoritativeChannelSource(
  input: Partial<AuthoritativeChannelSource> & { product_name: string },
): AuthoritativeChannelSource {
  return { source_version: GOVERNED_NAMING_PROMPT_VERSION, ...input };
}

export function mockChannelCopyProvider(
  source: AuthoritativeChannelSource,
  scenario: MockChannelCopyScenario = "ok",
): { envelope: Record<string, unknown>; parseResult: ReturnType<typeof validateGovernedChannelCopy> } {
  const generated = buildHeuristicChannelSuggestions(source);
  if (generated.ok === false) {
    return { envelope: { ok: false }, parseResult: { ok: false, reason: generated.reason } };
  }
  const content = channelSuggestionsToContent(generated.suggestions);
  if (scenario === "invented_price") content.whatsapp_product_message = `${source.product_name} — ₹99999`;
  if (scenario === "unapproved_compliance_claim") {
    content.storage_shelf_life_copy = `${source.product_name}. FSSAI approved organic certified.`;
  }
  const envelope = {
    ok: true,
    human_review_required: scenario !== "missing_review_marker",
    suggestion_only: true,
    approved: false,
    source_version: source.source_version,
    channel_prompt_version: GOVERNED_CHANNEL_COPY_PROMPT_VERSION,
    content,
  };
  const envelopeCheck = validateProviderChannelEnvelope(envelope);
  if (envelopeCheck.ok === false) {
    return { envelope, parseResult: { ok: false, reason: envelopeCheck.reason } };
  }
  return { envelope, parseResult: validateGovernedChannelCopy(content, source) };
}
