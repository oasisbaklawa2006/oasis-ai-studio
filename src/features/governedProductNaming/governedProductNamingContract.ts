import {
  CATALOGUE_DRAFT_CONTENT_KEYS,
  type CatalogueDraftContent,
  type CatalogueDraftContentKey,
} from "@/features/catalogueAiStudio/catalogueDraftTypes";
import type {
  AuthoritativeProductFacts,
  GovernedCatalogueCopyValidationResult,
  GovernedNamingDescriptionResult,
  GovernedNamingDescriptionSuggestions,
  GovernedNamingFieldSuggestion,
  GovernedNamingProvenance,
  GovernedNamingService,
} from "./types";

export const GOVERNED_NAMING_DISCLAIMER =
  "AI naming/description suggestion only. Review and approve before publication — never canonical product truth.";

export const GOVERNED_NAMING_PROMPT_VERSION = "point48-v1";

const SUPERLATIVE_PATTERN =
  /\b(best|finest|premium|signature|world[- ]class|award[- ]winning|#1|number one|top[- ]quality|healthiest)\b/i;
const MEDICAL_PATTERN = /\b(cures?|treats?|prevents?|medicinal|therapeutic|clinically)\b/i;
const NUTRITION_CLAIM_PATTERN =
  /\b(low fat|high protein|sugar[- ]free|gluten[- ]free|organic|vegan|keto|diabetic|calorie[- ]free)\b/i;
const COMPETITOR_BRAND_PATTERN =
  /\b(ferrero|lindt|godiva|haribo|nestl[eé]|cadbury|toblerone|patchi|bateel)\b/i;
const INVENTED_INGREDIENT_PATTERN =
  /\b(crafted with|made with|contains?|includes?)\s+[\w\s,]+(nuts?|dairy|gluten|butter|sugar|honey|pistachio|almond)/i;

function hasText(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function factsBlob(facts: AuthoritativeProductFacts): string {
  return JSON.stringify(facts).toLowerCase();
}

function provenance(
  service: GovernedNamingService,
  options: {
    provider_status?: GovernedNamingProvenance["provider_status"];
    used_heuristic_fallback?: boolean;
    fail_closed?: boolean;
    uncertainty_reason?: string;
  } = {},
): GovernedNamingProvenance {
  return {
    service,
    provider_status: options.provider_status ?? "ok",
    prompt_version: GOVERNED_NAMING_PROMPT_VERSION,
    used_heuristic_fallback: options.used_heuristic_fallback ?? service === "heuristic",
    fail_closed: options.fail_closed ?? false,
    uncertainty_reason: options.uncertainty_reason,
    invoked_at: new Date().toISOString(),
  };
}

function failClosed(
  service: GovernedNamingService,
  reason: string,
  options: Partial<GovernedNamingProvenance> = {},
): GovernedNamingDescriptionResult {
  return {
    ok: false,
    suggestion_only: true,
    approved: false,
    human_review_required: true,
    disclaimer: GOVERNED_NAMING_DISCLAIMER,
    reason,
    provenance: {
      ...provenance(service, { fail_closed: true, provider_status: "failed", ...options }),
      ...options,
    },
  };
}

/** Fail closed when product identity is missing or blank. */
export function validateProductIdentity(
  facts: AuthoritativeProductFacts,
): { ok: true } | { ok: false; reason: string } {
  if (!hasText(facts.product_name)) {
    return { ok: false, reason: "Unresolved product identity — product_name is required." };
  }
  return { ok: true };
}

/**
 * Detect restricted factual claims not present in authoritative facts.
 * Extracted compliance fields (Point 30) are inputs only — they do not permit hallucination.
 */
export function detectUnsafeNamingClaims(text: string, facts: AuthoritativeProductFacts): string[] {
  const reasons: string[] = [];
  const blob = factsBlob(facts);

  const checkPattern = (pattern: RegExp, label: string) => {
    const match = text.match(pattern);
    if (!match) return;
    const token = match[0].toLowerCase();
    if (!blob.includes(token)) reasons.push(`${label}: ${match[0]}`);
  };

  checkPattern(SUPERLATIVE_PATTERN, "unsupported superlative");
  checkPattern(MEDICAL_PATTERN, "medical/legal claim");
  checkPattern(NUTRITION_CLAIM_PATTERN, "nutritional claim");
  checkPattern(COMPETITOR_BRAND_PATTERN, "competitor-brand imitation");

  if (INVENTED_INGREDIENT_PATTERN.test(text) && !hasText(facts.description)) {
    reasons.push("invented ingredient/origin claim without authoritative description");
  }

  return reasons;
}

export function validateNamingText(
  text: string,
  facts: AuthoritativeProductFacts,
): { ok: true } | { ok: false; reason: string } {
  const unsafe = detectUnsafeNamingClaims(text, facts);
  if (unsafe.length > 0) {
    return { ok: false, reason: unsafe.join("; ") };
  }
  return { ok: true };
}

/** Deterministic, fact-only naming/description suggestions — no provider call. */
export function buildHeuristicNamingSuggestions(
  facts: AuthoritativeProductFacts,
): GovernedNamingDescriptionResult {
  const identity = validateProductIdentity(facts);
  if (!identity.ok) {
    return failClosed("heuristic", identity.reason);
  }

  const name = facts.product_name.trim();
  const categoryLabel =
    facts.category?.trim() || facts.subcategory?.trim() || facts.product_type?.trim() || "";
  const shortName = name.split(/[/,|]/)[0]?.trim() || name;

  const shortDescription = hasText(facts.short_description)
    ? (facts.short_description?.trim() ?? "")
    : categoryLabel
      ? `${name} — ${categoryLabel}.`
      : `${name}.`;

  const description = hasText(facts.description)
    ? (facts.description?.trim() ?? "")
    : categoryLabel
      ? `${name} is listed under ${categoryLabel}. Add authoritative product description for fuller copy.`
      : `${name}. Add authoritative product description for fuller copy.`;

  const catalogueTitle = hasText(facts.pack_size)
    ? `${name} (${facts.pack_size?.trim() ?? ""})`
    : name;

  const suggestions: GovernedNamingDescriptionSuggestions = {
    short_name: shortName,
    short_description: shortDescription,
    description,
    catalogue_title: catalogueTitle,
  };

  for (const value of Object.values(suggestions)) {
    const check = validateNamingText(value, facts);
    if (!check.ok) {
      return failClosed("heuristic", check.reason, { provider_status: "failed" });
    }
  }

  return {
    ok: true,
    suggestion_only: true,
    approved: false,
    human_review_required: true,
    disclaimer: GOVERNED_NAMING_DISCLAIMER,
    suggestions,
    provenance: provenance("heuristic"),
  };
}

export function governedNamingSuggestionsToFields(
  suggestions: GovernedNamingDescriptionSuggestions,
): GovernedNamingFieldSuggestion[] {
  const out: GovernedNamingFieldSuggestion[] = [];
  for (const [field, value] of Object.entries(suggestions)) {
    if (!value?.trim()) continue;
    out.push({
      field: field as GovernedNamingFieldSuggestion["field"],
      value: value.trim(),
      suggestion_only: true,
      approved: false,
    });
  }
  return out;
}

/** Validates provider catalogue copy against schema + factual grounding contract. */
export function validateGovernedCatalogueCopy(
  content: CatalogueDraftContent,
  facts: AuthoritativeProductFacts,
): GovernedCatalogueCopyValidationResult {
  const identity = validateProductIdentity(facts);
  if (!identity.ok) {
    return { ok: false, reason: identity.reason };
  }

  const unsafeFields: CatalogueDraftContentKey[] = [];
  for (const key of CATALOGUE_DRAFT_CONTENT_KEYS) {
    const value = content[key];
    if (!hasText(value)) {
      return { ok: false, reason: `AI response was missing or had an invalid value for: ${key}.` };
    }
    const check = validateNamingText(value, facts);
    if (!check.ok) unsafeFields.push(key);
  }

  if (unsafeFields.length > 0) {
    return {
      ok: false,
      reason: `AI output contained restricted claims in: ${unsafeFields.join(", ")}.`,
      unsafe_fields: unsafeFields,
    };
  }

  return { ok: true, content };
}

/** Provider envelope must carry human-review handoff markers. */
export function validateProviderReviewEnvelope(
  payload: unknown,
): { ok: true } | { ok: false; reason: string } {
  if (!payload || typeof payload !== "object") {
    return { ok: false, reason: "AI response could not be parsed as structured content." };
  }
  const row = payload as Record<string, unknown>;
  if (row.ok !== true) {
    return { ok: false, reason: "AI generation service returned a failure envelope." };
  }
  if (row.human_review_required !== true) {
    return { ok: false, reason: "AI response missing required human_review_required marker." };
  }
  if (row.suggestion_only === false || row.approved === true) {
    return { ok: false, reason: "AI response attempted to bypass review-only contract." };
  }
  return { ok: true };
}
