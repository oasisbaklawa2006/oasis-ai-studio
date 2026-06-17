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
  disclaimer: string;
  suggestions: AiComplianceSuggestionPayload;
};

export function buildAiComplianceResponse(
  suggestions: AiComplianceSuggestionPayload,
): AiComplianceResponse {
  return {
    suggestion_only: true,
    approved: false,
    disclaimer: AI_COMPLIANCE_LEGAL_DISCLAIMER,
    suggestions,
  };
}

/** Heuristic placeholder until a model provider is wired — always suggestion-only. */
export function buildHeuristicComplianceSuggestions(input: {
  product_name?: string;
  category?: string;
}): AiComplianceResponse {
  const name = (input.product_name ?? "").toLowerCase();
  const isConfectionery = /chocolate|sweet|dragee|baklawa|confection/i.test(name);

  return buildAiComplianceResponse({
    hsn_code: isConfectionery ? "18069090" : "21069099",
    gst_rate: isConfectionery ? "5" : "12",
    shelf_life_days: "180",
    ingredients: "AI draft — verify against recipe sheet.",
    allergen_warnings: "May contain nuts, gluten, dairy — verify.",
    nutritional_info: "Per 100g — values require lab verification.",
    storage_instructions: "Store in a cool, dry place away from direct sunlight.",
  });
}

function normalizeSuggestionPayload(raw: unknown): AiComplianceSuggestionPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const out: AiComplianceSuggestionPayload = {};
  if (row.hsn_code != null) out.hsn_code = String(row.hsn_code);
  if (row.gst_rate != null) out.gst_rate = row.gst_rate as string | number;
  if (row.shelf_life_days != null) out.shelf_life_days = row.shelf_life_days as string | number;
  if (row.ingredients != null) out.ingredients = String(row.ingredients);
  if (row.allergen_warnings != null) out.allergen_warnings = String(row.allergen_warnings);
  if (row.nutritional_info != null) out.nutritional_info = String(row.nutritional_info);
  if (row.storage_instructions != null) out.storage_instructions = String(row.storage_instructions);
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

  if (!suggestionOnly || approved) return null;

  return {
    suggestion_only: true,
    approved: false,
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
    return { response: parsed, usedHeuristic: false };
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
