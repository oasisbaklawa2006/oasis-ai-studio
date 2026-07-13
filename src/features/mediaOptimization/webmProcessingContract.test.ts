import { describe, expect, it } from "vitest";
import { evaluateWebMReadiness } from "./webmProcessingContract";

describe("WebM readiness contract", () => {
  it("accepts an existing WebM without claiming processing", () => {
    expect(evaluateWebMReadiness({ type: "video/webm", size: 100 })).toMatchObject({
      status: "ready_for_upload",
      canUploadNow: true,
      requiresBackend: false,
    });
  });

  it("requires a real backend job for other video codecs", () => {
    expect(evaluateWebMReadiness({ type: "video/mp4", size: 100 })).toMatchObject({
      status: "backend_processing_required",
      canUploadNow: false,
      requiresBackend: true,
    });
  });

  it("rejects invalid input", () => {
    expect(evaluateWebMReadiness({ type: "image/jpeg", size: 100 }).status).toBe("invalid_input");
  });
});
