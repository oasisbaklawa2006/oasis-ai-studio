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
});
