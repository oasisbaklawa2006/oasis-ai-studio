import {
  detectUnsafeNamingClaims,
  validateProductIdentity,
} from "@/features/governedProductNaming";
import { seedAliasesFromName } from "@/features/productLanguage/aliasSeedRules";
import type { AliasSeed } from "@/features/productLanguage/aliasSeedRules";
import {
  MULTILINGUAL_LOCALE_SCRIPTS,
  SUPPORTED_MULTILINGUAL_LOCALES,
  type AuthoritativeMultilingualSource,
  type GovernedMultilingualFieldSuggestion,
  type GovernedMultilingualProvenance,
  type GovernedMultilingualService,
  type GovernedMultilingualSuggestionResult,
  type GovernedMultilingualValidationResult,
  type LocaleResolutionResult,
  type MultilingualAvailability,
  type MultilingualLocaleCode,
  type MultilingualSuggestionKind,
} from "./types";

export const GOVERNED_MULTILINGUAL_DISCLAIMER =
  "Multilingual suggestion only. Review and approve before publication — never canonical product truth.";

export const GOVERNED_MULTILINGUAL_PROMPT_VERSION = "point49-v1";

export const PENDING_HINDI_DESCRIPTION_MARKER =
  "[Hindi translation pending — approved Hindi source copy required. Do not publish English product name as Hindi.]";

export const PENDING_SELLING_POINT_MARKER =
  "[Selling point pending — approved source description required for this locale.]";

const DEVANAGARI_PATTERN = /[\u0900-\u097F]/;
const HINDI_SUPERLATIVE_PATTERN = /सर्वश्रेष्ठ|बेहतरीन|उत्कृष्ट/;
const ARABIC_SCRIPT_PATTERN = /[\u0600-\u06FF]/;
const LATIN_ASCII_PATTERN = /^[\x00-\x7F\s.,!?'"()\-–—:;*]+$/;

function hasText(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function factsBlob(facts: AuthoritativeProductFacts): string {
  return JSON.stringify(facts).toLowerCase();
}

function sourceIdentity(source: AuthoritativeMultilingualSource): string {
  return source.product_name.trim().toLowerCase();
}

function provenance(
  service: GovernedMultilingualService,
  source: AuthoritativeMultilingualSource,
  options: Partial<GovernedMultilingualProvenance> = {},
): GovernedMultilingualProvenance {
  return {
    service,
    provider_status: options.provider_status ?? "ok",
    prompt_version: GOVERNED_MULTILINGUAL_PROMPT_VERSION,
    source_version: source.source_version,
    source_identity: sourceIdentity(source),
    used_heuristic_fallback: options.used_heuristic_fallback ?? service === "heuristic",
    fail_closed: options.fail_closed ?? false,
    uncertainty_reason: options.uncertainty_reason,
    invoked_at: new Date().toISOString(),
  };
}

function failClosed(
  service: GovernedMultilingualService,
  source: AuthoritativeMultilingualSource,
  reason: string,
  options: Partial<GovernedMultilingualProvenance> = {},
): GovernedMultilingualSuggestionResult {
  return {
    ok: false,
    suggestion_only: true,
    approved: false,
    human_review_required: true,
    disclaimer: GOVERNED_MULTILINGUAL_DISCLAIMER,
    reason,
    provenance: provenance(service, source, {
      fail_closed: true,
      provider_status: "failed",
      ...options,
    }),
  };
}

function suggestion(
  source: AuthoritativeMultilingualSource,
  args: {
    kind: MultilingualSuggestionKind;
    locale: MultilingualLocaleCode;
    value: string;
    availability: MultilingualAvailability;
    term_type?: string;
  },
): GovernedMultilingualFieldSuggestion {
  return {
    kind: args.kind,
    locale: args.locale,
    script: MULTILINGUAL_LOCALE_SCRIPTS[args.locale],
    value: args.value.trim(),
    availability: args.availability,
    suggestion_only: true,
    approved: false,
    review_status: "pending_review",
    source_version: source.source_version,
    term_type: args.term_type,
  };
}

export function isSupportedMultilingualLocale(
  locale: string,
): locale is MultilingualLocaleCode {
  return (SUPPORTED_MULTILINGUAL_LOCALES as readonly string[]).includes(locale);
}

/** Fail closed when locale is outside the governed support matrix. */
export function resolveLocale(locale: string): LocaleResolutionResult {
  if (!isSupportedMultilingualLocale(locale)) {
    return {
      locale: "unsupported",
      availability: "unsupported",
      reason: `Locale "${locale}" is not in the governed support matrix.`,
    };
  }
  return { locale, availability: "available" };
}

/** Requires Point48 identity plus pinned source_version. */
export function validateMultilingualSource(
  source: AuthoritativeMultilingualSource,
): { ok: true } | { ok: false; reason: string } {
  const identity = validateProductIdentity(source);
  if (!identity.ok) return identity;
  if (!hasText(source.source_version)) {
    return { ok: false, reason: "Missing source_version — Point48 copy revision must be pinned." };
  }
  return { ok: true };
}

function localeForAliasSeed(seed: AliasSeed): MultilingualLocaleCode {
  const lang = (seed.language ?? "en").toLowerCase();
  if (lang === "hi") return "hi";
  if (lang === "ar") return "ar";
  if (lang === "tr") return "tr";
  return "en";
}

function kindForAliasSeed(seed: AliasSeed): MultilingualSuggestionKind {
  const aliasType = (seed.alias_type ?? "").toLowerCase();
  if (aliasType.includes("hindi") || seed.language === "hi") return "regional_term";
  if (aliasType.includes("arabic") || seed.language === "ar") return "regional_term";
  if (seed.language === "tr") return "regional_term";
  if (aliasType.includes("official")) return "product_name_alias";
  return "search_keyword";
}

function scriptForSeed(seed: AliasSeed, locale: MultilingualLocaleCode): string {
  if (seed.script) return seed.script;
  return MULTILINGUAL_LOCALE_SCRIPTS[locale];
}

/** Detect when English/Latin copy is presented as a non-English locale translation. */
export function detectWrongLanguagePresentation(
  text: string,
  locale: MultilingualLocaleCode,
  source?: AuthoritativeMultilingualSource,
  kind?: MultilingualSuggestionKind,
): string | null {
  const trimmed = text.trim();
  if (!trimmed) return "empty multilingual value";

  if (locale === "hi" && kind === "hindi_description") {
    if (PENDING_HINDI_DESCRIPTION_MARKER === trimmed) return null;
    if (!DEVANAGARI_PATTERN.test(trimmed)) {
      return "Hindi locale content must use Devanagari script or explicit pending marker";
    }
    if (source?.product_name && trimmed.includes(source.product_name.trim())) {
      return "Hindi locale must not embed English product_name as translated truth";
    }
  }

  if (locale === "ar" && kind === "hindi_description") {
    if (!ARABIC_SCRIPT_PATTERN.test(trimmed)) {
      return "Arabic locale content must use Arabic script";
    }
  }

  if ((locale === "hi" || locale === "ar") && kind === "hindi_description") {
    if (LATIN_ASCII_PATTERN.test(trimmed) && trimmed.length > 12) {
      return "Non-Latin locale must not present Latin-only copy as translated truth";
    }
  }

  return null;
}

export function validateMultilingualText(
  text: string,
  locale: MultilingualLocaleCode,
  source: AuthoritativeMultilingualSource,
  kind: MultilingualSuggestionKind = "regional_term",
): GovernedMultilingualValidationResult {
  const wrongLanguage = detectWrongLanguagePresentation(text, locale, source, kind);
  if (wrongLanguage) {
    return { ok: false, reason: wrongLanguage };
  }

  if (HINDI_SUPERLATIVE_PATTERN.test(text) && !factsBlob(source).includes("सर्वश्रेष्ठ")) {
    return { ok: false, reason: "unsupported superlative: सर्वश्रेष्ठ" };
  }

  const unsafe = detectUnsafeNamingClaims(text, source);
  if (unsafe.length > 0) {
    return { ok: false, reason: unsafe.join("; ") };
  }

  return {
    ok: true,
    suggestion: suggestion(source, {
      kind,
      locale,
      value: text,
      availability: "available",
    }),
  };
}

export function validateGovernedHindiDescription(
  text: string,
  source: AuthoritativeMultilingualSource,
): { ok: true; value: string } | { ok: false; reason: string } {
  if (hasText(source.approved_hindi_description)) {
    const approved = source.approved_hindi_description!.trim();
    const check = validateMultilingualText(approved, "hi", source, "hindi_description");
    if (!check.ok) return { ok: false, reason: check.reason };
    return { ok: true, value: approved };
  }

  const check = validateMultilingualText(text, "hi", source, "hindi_description");
  if (!check.ok) return { ok: false, reason: check.reason };
  return { ok: true, value: text.trim() };
}

export function resolveTemplateHindiDescription(
  source: AuthoritativeMultilingualSource,
): GovernedMultilingualFieldSuggestion {
  if (hasText(source.approved_hindi_description)) {
    return suggestion(source, {
      kind: "hindi_description",
      locale: "hi",
      value: source.approved_hindi_description!.trim(),
      availability: "available",
    });
  }

  return suggestion(source, {
    kind: "hindi_description",
    locale: "hi",
    value: PENDING_HINDI_DESCRIPTION_MARKER,
    availability: "pending",
  });
}

export function resolveSellingPointForLocale(
  source: AuthoritativeMultilingualSource,
  locale: MultilingualLocaleCode,
): GovernedMultilingualFieldSuggestion {
  if (locale === "en" && hasText(source.approved_short_description)) {
    return suggestion(source, {
      kind: "selling_point",
      locale: "en",
      value: source.approved_short_description!.trim(),
      availability: "available",
    });
  }

  if (locale === "en" && hasText(source.short_description)) {
    return suggestion(source, {
      kind: "selling_point",
      locale: "en",
      value: source.short_description!.trim(),
      availability: "available",
    });
  }

  return suggestion(source, {
    kind: "selling_point",
    locale,
    value: PENDING_SELLING_POINT_MARKER,
    availability: "pending",
  });
}

function aliasSeedsToSuggestions(
  source: AuthoritativeMultilingualSource,
  seeds: AliasSeed[],
): GovernedMultilingualFieldSuggestion[] {
  const out: GovernedMultilingualFieldSuggestion[] = [];
  const seen = new Set<string>();

  for (const seed of seeds) {
    const locale = localeForAliasSeed(seed);
    const key = `${locale}::${seed.alias.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const kind = kindForAliasSeed(seed);
    const check = validateMultilingualText(seed.alias, locale, source, kind);
    if (!check.ok) continue;

    out.push({
      ...check.suggestion,
      kind: kindForAliasSeed(seed),
      script: scriptForSeed(seed, locale),
      term_type: seed.alias_type,
    });
  }

  return out;
}

/** Deterministic multilingual suggestions from Point48 facts + alias seed rules only. */
export function buildHeuristicMultilingualSuggestions(
  source: AuthoritativeMultilingualSource,
  requestedLocales: readonly MultilingualLocaleCode[] = SUPPORTED_MULTILINGUAL_LOCALES,
): GovernedMultilingualSuggestionResult {
  const sourceCheck = validateMultilingualSource(source);
  if (!sourceCheck.ok) {
    return failClosed("heuristic", source, sourceCheck.reason);
  }

  for (const locale of requestedLocales) {
    const resolved = resolveLocale(locale);
    if (resolved.locale === "unsupported") {
      return failClosed("heuristic", source, resolved.reason ?? "Unsupported locale.");
    }
  }

  const seeds = seedAliasesFromName(source.product_name);
  const suggestions: GovernedMultilingualFieldSuggestion[] = [
    ...aliasSeedsToSuggestions(source, seeds),
    resolveTemplateHindiDescription(source),
    ...requestedLocales.map((locale) => resolveSellingPointForLocale(source, locale)),
  ];

  const unique = new Map<string, GovernedMultilingualFieldSuggestion>();
  for (const row of suggestions) {
    unique.set(`${row.kind}::${row.locale}::${row.value}`, row);
  }

  return {
    ok: true,
    suggestion_only: true,
    approved: false,
    human_review_required: true,
    disclaimer: GOVERNED_MULTILINGUAL_DISCLAIMER,
    suggestions: [...unique.values()],
    provenance: provenance("heuristic", source),
  };
}

export function governedAliasSeedsFromSource(
  source: AuthoritativeMultilingualSource,
): { ok: true; aliases: AliasSeed[]; provenance: GovernedMultilingualProvenance } | { ok: false; reason: string; provenance: GovernedMultilingualProvenance } {
  const result = buildHeuristicMultilingualSuggestions(source, ["en", "hi", "ar", "tr"]);
  if (!result.ok) {
    return { ok: false, reason: result.reason, provenance: result.provenance };
  }

  const aliases: AliasSeed[] = result.suggestions
    .filter((s) => s.kind !== "selling_point" && s.kind !== "hindi_description")
    .filter((s) => s.availability === "available")
    .map((s) => ({
      alias: s.value,
      language: s.locale === "en" ? undefined : s.locale,
      script: s.script !== "latin" ? s.script : undefined,
      alias_type: s.term_type,
    }));

  return { ok: true, aliases, provenance: result.provenance };
}

/** Provider envelope must carry human-review handoff markers — same contract as Point48. */
export function validateProviderMultilingualEnvelope(
  payload: unknown,
): { ok: true } | { ok: false; reason: string } {
  if (!payload || typeof payload !== "object") {
    return { ok: false, reason: "Multilingual provider response could not be parsed." };
  }
  const row = payload as Record<string, unknown>;
  if (row.ok !== true) {
    return { ok: false, reason: "Multilingual generation service returned a failure envelope." };
  }
  if (row.human_review_required !== true) {
    return { ok: false, reason: "Multilingual response missing required human_review_required marker." };
  }
  if (row.suggestion_only === false || row.approved === true) {
    return { ok: false, reason: "Multilingual response attempted to bypass review-only contract." };
  }
  if (!hasText(String(row.source_version ?? ""))) {
    return { ok: false, reason: "Multilingual response missing required source_version pin." };
  }
  return { ok: true };
}

export function serializeMultilingualSuggestions(
  suggestions: GovernedMultilingualFieldSuggestion[],
): string {
  return JSON.stringify(
    suggestions.map((s) => ({
      kind: s.kind,
      locale: s.locale,
      script: s.script,
      value: s.value,
      availability: s.availability,
      review_status: s.review_status,
      source_version: s.source_version,
      suggestion_only: s.suggestion_only,
      approved: s.approved,
    })),
  );
}
