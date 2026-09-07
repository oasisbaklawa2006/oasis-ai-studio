import type { AuthoritativeMultilingualSource } from "./types";
import {
  buildHeuristicMultilingualSuggestions,
  validateMultilingualText,
  validateProviderMultilingualEnvelope,
} from "./governedMultilingualContract";

export type MockMultilingualScenario =
  | "ok"
  | "missing_review_marker"
  | "missing_source_version"
  | "unsafe_superlative"
  | "wrong_language_hindi"
  | "unsupported_locale";

/**
 * Deterministic mocked multilingual provider for tests and offline harnesses.
 * Never performs network I/O or production mutation.
 */
export function mockMultilingualProvider(
  source: AuthoritativeMultilingualSource,
  scenario: MockMultilingualScenario = "ok",
  requestedLocale: "hi" | "ar" | "tr" = "hi",
) {
  const heuristic = buildHeuristicMultilingualSuggestions(source, ["en", requestedLocale]);
  if (!heuristic.ok) {
    return {
      envelope: { ok: false, reason: heuristic.reason },
      parseResult: { ok: false as const, reason: heuristic.reason },
    };
  }

  const hindiSuggestion = heuristic.suggestions.find(
    (s) => s.kind === "hindi_description" && s.locale === "hi",
  );
  const baseHindi =
    hindiSuggestion?.availability === "available"
      ? hindiSuggestion.value
      : "समीक्षा के लिए हिंदी ड्राफ्ट — अनुमोदित स्रोत प्रतिलिपि आवश्यक।";

  const valueByScenario: Record<MockMultilingualScenario, string> = {
    ok: baseHindi,
    missing_review_marker: baseHindi,
    missing_source_version: baseHindi,
    unsafe_superlative: `सर्वश्रेष्ठ काजू पिरामिड बकलावा`,
    wrong_language_hindi: `${source.product_name} is available now.`,
    unsupported_locale: baseHindi,
  };

  const envelope: Record<string, unknown> = {
    ok: true,
    suggestion_only: true,
    approved: false,
    human_review_required: scenario !== "missing_review_marker",
    source_version: scenario === "missing_source_version" ? "" : source.source_version,
    locale: scenario === "unsupported_locale" ? "fr" : requestedLocale,
    suggestions: [
      {
        kind: "hindi_description",
        locale: requestedLocale,
        value: valueByScenario[scenario],
      },
    ],
    provenance: {
      service: "multilingual-provider",
      prompt_version: "point49-mock-v1",
      source_version: source.source_version,
    },
  };

  const reviewCheck = validateProviderMultilingualEnvelope(envelope);
  if (!reviewCheck.ok) {
    return { envelope, parseResult: { ok: false as const, reason: reviewCheck.reason } };
  }

  if (scenario === "unsupported_locale") {
    return {
      envelope,
      parseResult: {
        ok: false as const,
        reason: 'Locale "fr" is not in the governed support matrix.',
      },
    };
  }

  const text = valueByScenario[scenario];
  const parseResult = validateMultilingualText(text, requestedLocale, source, "hindi_description");
  return { envelope, parseResult };
}

export function buildAuthoritativeMultilingualSource(
  facts: AuthoritativeMultilingualSource,
): AuthoritativeMultilingualSource {
  return {
    ...facts,
    source_version: facts.source_version,
  };
}
