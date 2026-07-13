import { AI_COMPLIANCE_LEGAL_DISCLAIMER } from "./complianceConstants";

export type AiComplianceSuggestionPayload = {
  hsn_code?: string | null;
  gst_rate?: string | number | null;
  shelf_life_days?: string | number | null;
  ingredients?: string | null;
  allergen_warnings?: string | null;
  nutritional_info?: string | null;
  storage_instructions?: string | null;
};

export type AiComplianceResponse = {
  suggestion_only: true;
  approved: false;
  source: "model" | "heuristic";
  disclaimer: string;
  suggestions: AiComplianceSuggestionPayload;
};

export function buildAiComplianceResponse(
  suggestions: AiComplianceSuggestionPayload,
  source: "model" | "heuristic" = "heuristic",
): AiComplianceResponse {
  return {
    suggestion_only: true,
    approved: false,
    source,
    disclaimer: AI_COMPLIANCE_LEGAL_DISCLAIMER,
    suggestions,
  };
}

/** Heuristic placeholder until a model provider is wired — always suggestion-only. */
export function buildHeuristicComplianceSuggestions(_input: {
  product_name?: string;
  category?: string;
}): AiComplianceResponse {
  return buildAiComplianceResponse({
    hsn_code: null,
    gst_rate: null,
    shelf_life_days: null,
    ingredients: "Draft unavailable — verify against the approved recipe or supplier specification.",
    allergen_warnings: "Verify allergens against the approved recipe and cross-contamination controls.",
    nutritional_info: "Nutrition values require an approved calculation or laboratory report.",
    storage_instructions: "Verify storage instructions against the approved product specification.",
  });
}

function normalizeSuggestionPayload(raw: unknown): AiComplianceSuggestionPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const out: AiComplianceSuggestionPayload = {};
  const hsn = String(row.hsn_code ?? "").trim();
  if (/^\d{4,8}$/.test(hsn)) out.hsn_code = hsn;
  const gst = Number(row.gst_rate);
  if ([0, 5, 12, 18, 28].includes(gst)) out.gst_rate = gst;
  const shelfLife = Number(row.shelf_life_days);
  if (Number.isInteger(shelfLife) && shelfLife > 0 && shelfLife <= 3_650) out.shelf_life_days = shelfLife;
  const bounded = (value: unknown, max: number): string | null => {
    if (typeof value !== "string") return null;
    const text = Array.from(value, (character) => {
      const code = character.charCodeAt(0);
      return code <= 31 || code === 127 ? " " : character;
    }).join("").trim();
    return text ? text.slice(0, max) : null;
  };
  out.ingredients = bounded(row.ingredients, 2_000);
  out.allergen_warnings = bounded(row.allergen_warnings, 1_000);
  out.nutritional_info = bounded(row.nutritional_info, 2_000);
  out.storage_instructions = bounded(row.storage_instructions, 500);
  return Object.keys(out).length ? out : null;
}

/** Parse edge-function payload; null when shape is unusable. */
export function parseAiComplianceResponse(data: unknown): AiComplianceResponse | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  if (row.ok === false) return null;

  const suggestions = normalizeSuggestionPayload(row.suggestions);
  if (!suggestions) return null;

  const suggestionOnly = row.suggestion_only !== false;
  const approved = row.approved === true;
  const source = row.source === "model" ? "model" : "heuristic";

  if (!suggestionOnly || approved) return null;

  return {
    suggestion_only: true,
    approved: false,
    source,
    disclaimer: String(row.disclaimer ?? AI_COMPLIANCE_LEGAL_DISCLAIMER),
    suggestions,
  };
}

/**
 * Use AI response when valid; otherwise heuristic suggestions (never throws).
 */
export function resolveAiComplianceResponse(
  data: unknown,
  input: { product_name?: string; category?: string },
): { response: AiComplianceResponse; usedHeuristic: boolean } {
  const parsed = parseAiComplianceResponse(data);
  if (parsed) {
    return { response: parsed, usedHeuristic: parsed.source !== "model" };
  }
  return {
    response: buildHeuristicComplianceSuggestions(input),
    usedHeuristic: true,
  };
}

export function responseIncludesRequiredDisclaimer(response: AiComplianceResponse): boolean {
  return (
    response.suggestion_only === true &&
    response.approved === false &&
    typeof response.disclaimer === "string" &&
    response.disclaimer.includes("AI suggestion only") &&
    response.disclaimer.toLowerCase().includes("gst/hsn")
  );
}
