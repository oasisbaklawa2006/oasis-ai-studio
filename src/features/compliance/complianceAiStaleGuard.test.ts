import { describe, expect, it } from "vitest";
import {
  bumpComplianceManualEditGeneration,
  captureComplianceAiRequestGuard,
  complianceFormRevisionFingerprint,
  isStaleComplianceAiRequest,
  isStaleComplianceFormRevision,
} from "./complianceAiStaleGuard";

describe("complianceAiStaleGuard", () => {
  it("discards AI responses after manual compliance edits", () => {
    const guardAtStart = captureComplianceAiRequestGuard();
    bumpComplianceManualEditGeneration();
    expect(isStaleComplianceAiRequest(guardAtStart)).toBe(true);
  });

  it("discards AI responses when compliance form values change during the request", () => {
    const fingerprintAtStart = complianceFormRevisionFingerprint({
      ingredients: "Manual recipe",
      hsn_code: "12345678",
    });
    const changedForm = {
      ingredients: "Operator edited recipe",
      hsn_code: "12345678",
    };

    expect(isStaleComplianceFormRevision(fingerprintAtStart, changedForm)).toBe(true);
    expect(
      isStaleComplianceFormRevision(fingerprintAtStart, {
        ingredients: "Manual recipe",
        hsn_code: "12345678",
      }),
    ).toBe(false);
  });

  it("discards AI responses when product_name or category changes during the request", () => {
    const fingerprintAtStart = complianceFormRevisionFingerprint({
      product_name: "Pyramid Baklawa",
      category: "baklawa",
      ingredients: "Manual recipe",
    });

    expect(
      isStaleComplianceFormRevision(fingerprintAtStart, {
        product_name: "Cashew Pyramid",
        category: "baklawa",
        ingredients: "Manual recipe",
      }),
    ).toBe(true);
    expect(
      isStaleComplianceFormRevision(fingerprintAtStart, {
        product_name: "Pyramid Baklawa",
        category: "sweets",
        ingredients: "Manual recipe",
      }),
    ).toBe(true);
    expect(
      isStaleComplianceFormRevision(fingerprintAtStart, {
        product_name: "Pyramid Baklawa",
        category: "baklawa",
        ingredients: "Manual recipe",
      }),
    ).toBe(false);
  });
});
