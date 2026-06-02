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

export function responseIncludesRequiredDisclaimer(response: AiComplianceResponse): boolean {
  return (
    response.suggestion_only === true &&
    response.approved === false &&
    typeof response.disclaimer === "string" &&
    response.disclaimer.includes("AI suggestion only") &&
    response.disclaimer.toLowerCase().includes("gst/hsn")
  );
}
