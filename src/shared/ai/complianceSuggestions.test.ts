import { describe, expect, it } from "vitest";
import {
  buildAiComplianceResponse,
  buildHeuristicComplianceSuggestions,
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
});
