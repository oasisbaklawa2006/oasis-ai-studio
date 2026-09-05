import { describe, expect, it } from "vitest";
import {
  buildAiComplianceResponse,
  buildHeuristicComplianceSuggestions,
  parseAiComplianceResponse,
  resolveAiComplianceResponse,
  responseIncludesRequiredDisclaimer,
} from "./complianceSuggestions";

describe("complianceSuggestions", () => {
  it("marks GST/HSN AI output as suggestion only with disclaimer", () => {
    const response = buildAiComplianceResponse({ hsn_code: "18069090", gst_rate: "5" });
    expect(response.suggestion_only).toBe(true);
    expect(response.approved).toBe(false);
    expect(responseIncludesRequiredDisclaimer(response)).toBe(true);
    expect(response.disclaimer).toContain("GST/HSN");
  });

  it("heuristic response is never auto-approved", () => {
    const response = buildHeuristicComplianceSuggestions({ product_name: "Chocolate Truffle" });
    expect(response.suggestion_only).toBe(true);
    expect(response.approved).toBe(false);
    expect(response.suggestions.hsn_code).toBeTruthy();
  });

  it("parseAiComplianceResponse accepts edge function shape", () => {
    const parsed = parseAiComplianceResponse({
      suggestion_only: true,
      approved: false,
      disclaimer: "AI suggestion only. Final GST/HSN must be approved manually by authorized user.",
      suggestions: { hsn_code: "18069090", gst_rate: "5" },
    });
    expect(parsed?.suggestions.hsn_code).toBe("18069090");
  });

  it("parseAiComplianceResponse accepts live Central flat payload", () => {
    const parsed = parseAiComplianceResponse({
      hsn_code: "19059090",
      gst_percentage: 18,
      ingredients: "Synthetic ingredients",
      allergen_warnings: "Synthetic allergens",
      nutrition_facts: "Per 100g synthetic",
    });
    expect(parsed?.approved).toBe(false);
    expect(parsed?.suggestion_only).toBe(true);
    expect(parsed?.suggestions.hsn_code).toBe("19059090");
    expect(parsed?.suggestions.gst_rate).toBe(18);
    expect(parsed?.suggestions.nutritional_info).toBe("Per 100g synthetic");
  });

  it("resolveAiComplianceResponse falls back to heuristic on invalid payload", () => {
    const { response, usedHeuristic } = resolveAiComplianceResponse(
      { ok: false, message: "down" },
      { product_name: "Baklawa" },
    );
    expect(usedHeuristic).toBe(true);
    expect(response.suggestions.hsn_code).toBeTruthy();
  });
});
