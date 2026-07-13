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
    expect(response.source).toBe("heuristic");
    expect(response.suggestions.hsn_code).toBeNull();
    expect(response.suggestions.gst_rate).toBeNull();
  });

  it("parseAiComplianceResponse accepts edge function shape", () => {
    const parsed = parseAiComplianceResponse({
      suggestion_only: true,
      approved: false,
      source: "model",
      disclaimer: "AI suggestion only. Final GST/HSN must be approved manually by authorized user.",
      suggestions: { hsn_code: "18069090", gst_rate: "5" },
    });
    expect(parsed?.suggestions.hsn_code).toBe("18069090");
    expect(parsed?.source).toBe("model");
  });

  it("resolveAiComplianceResponse falls back to heuristic on invalid payload", () => {
    const { response, usedHeuristic } = resolveAiComplianceResponse(
      { ok: false, message: "down" },
      { product_name: "Baklawa" },
    );
    expect(usedHeuristic).toBe(true);
    expect(response.suggestions.hsn_code).toBeNull();
  });

  it("drops disruptive or invalid compliance values before they reach form state", () => {
    const parsed = parseAiComplianceResponse({
      suggestion_only: true,
      approved: false,
      source: "model",
      suggestions: {
        hsn_code: "<script>alert(1)</script>",
        gst_rate: 13,
        shelf_life_days: -10,
        ingredients: `Valid start${"x".repeat(3_000)}`,
      },
    });
    expect(parsed?.suggestions.hsn_code).toBeUndefined();
    expect(parsed?.suggestions.gst_rate).toBeUndefined();
    expect(parsed?.suggestions.shelf_life_days).toBeUndefined();
    expect(parsed?.suggestions.ingredients).toHaveLength(2_000);
  });
});
