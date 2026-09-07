import type { CatalogueDraftContent } from "@/features/catalogueAiStudio/catalogueDraftTypes";
import { CATALOGUE_DRAFT_CONTENT_KEYS } from "@/features/catalogueAiStudio/catalogueDraftTypes";
import {
  buildHeuristicNamingSuggestions,
  validateGovernedCatalogueCopy,
  validateProviderReviewEnvelope,
} from "./governedProductNamingContract";
import type { AuthoritativeProductFacts, GovernedNamingDescriptionResult } from "./types";

export type MockCatalogueCopyScenario =
  | "ok"
  | "missing_review_marker"
  | "unsafe_superlative"
  | "invalid_schema";

/**
 * Deterministic mocked catalogue-ai-copy provider for tests and offline harnesses.
 * Never performs network I/O or production mutation.
 */
export function mockCatalogueAiCopyProvider(
  facts: AuthoritativeProductFacts,
  scenario: MockCatalogueCopyScenario = "ok",
): {
  envelope: Record<string, unknown>;
  parseResult: { ok: true; content: CatalogueDraftContent } | { ok: false; reason: string };
} {
  const heuristic = buildHeuristicNamingSuggestions(facts);
  if (!heuristic.ok) {
    return {
      envelope: { ok: false, reason: heuristic.reason },
      parseResult: { ok: false, reason: heuristic.reason },
    };
  }

  const baseTitle = heuristic.suggestions.catalogue_title ?? facts.product_name;
  const baseShort = heuristic.suggestions.short_description ?? facts.product_name;
  const baseLong = heuristic.suggestions.description ?? facts.product_name;

  const content = Object.fromEntries(
    CATALOGUE_DRAFT_CONTENT_KEYS.map((key) => {
      switch (key) {
        case "catalogue_title":
          return [key, scenario === "unsafe_superlative" ? `The Best ${baseTitle}` : baseTitle];
        case "short_description":
          return [key, baseShort];
        case "long_description":
          return [key, baseLong];
        case "b2b_sales_copy":
          return [key, `${facts.product_name} — wholesale listing draft.`];
        case "export_catalogue_copy":
          return [key, `${facts.product_name} — export catalogue draft.`];
        case "whatsapp_product_message":
          return [key, `Hi! We have *${facts.product_name}* available. Reply to know more.`];
        case "hindi_description":
          return [key, `${facts.product_name} — समीक्षा के लिए ड्राफ्ट.`];
        case "storage_shelf_life_copy":
          return [key, "Refer to product label for storage and shelf-life details."];
        default:
          return [key, baseShort];
      }
    }),
  ) as CatalogueDraftContent;

  if (scenario === "invalid_schema") {
    const broken = { ...content, short_description: "" };
    return {
      envelope: {
        ok: true,
        human_review_required: true,
        suggestion_only: true,
        approved: false,
        content: broken,
      },
      parseResult: validateGovernedCatalogueCopy(broken, facts),
    };
  }

  const envelope: Record<string, unknown> = {
    ok: true,
    suggestion_only: true,
    approved: false,
    human_review_required: scenario !== "missing_review_marker",
    content,
    provenance: {
      service: "catalogue-ai-copy",
      prompt_version: "point48-mock-v1",
    },
  };

  const reviewCheck = validateProviderReviewEnvelope(envelope);
  if (!reviewCheck.ok) {
    return { envelope, parseResult: { ok: false, reason: reviewCheck.reason } };
  }

  return {
    envelope,
    parseResult: validateGovernedCatalogueCopy(content, facts),
  };
}

export function extractFastCreateNamingFromGoverned(
  facts: AuthoritativeProductFacts,
): GovernedNamingDescriptionResult {
  return buildHeuristicNamingSuggestions(facts);
}
