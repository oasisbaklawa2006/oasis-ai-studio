import { describe, expect, it } from "vitest";
import {
  CATALOGUE_AI_COPY_SERVICE,
  assertOperationalProvenanceComplete,
  extractInferenceProvenanceFromPayload,
  isGovernedCatalogueCopyResponse,
  isLegacyCatalogueAiServiceMarker,
  normalizeCatalogueAiServiceMarker,
} from "./inferenceProvenance";

describe("inferenceProvenance", () => {
  it("extracts provider/model/prompt_version from governed edge payload", () => {
    const provenance = extractInferenceProvenanceFromPayload(
      {
        ok: true,
        human_review_required: true,
        suggestion_only: true,
        provider: "openai",
        model: "gpt-4.1-mini",
        prompt_version: "catalogue-copy-v2",
        content: { catalogue_title: "Test" },
      },
      { service: CATALOGUE_AI_COPY_SERVICE },
    );
    expect(provenance.provider).toBe("openai");
    expect(provenance.model).toBe("gpt-4.1-mini");
    expect(provenance.prompt_version).toBe("catalogue-copy-v2");
    expect(provenance.human_review_required).toBe(true);
    expect(provenance.suggestion_only).toBe(true);
    expect(provenance.service).toBe("catalogue-ai-copy");
  });

  it("accepts nested provenance block from edge responses", () => {
    const provenance = extractInferenceProvenanceFromPayload(
      {
        ok: true,
        human_review_required: true,
        provenance: {
          provider: "openai",
          model: "gpt-4.1-mini",
          prompt_version: "v1",
        },
      },
      { service: CATALOGUE_AI_COPY_SERVICE },
    );
    expect(provenance.model).toBe("gpt-4.1-mini");
    expect(provenance.prompt_version).toBe("v1");
  });

  it("rejects ungoverned catalogue copy responses missing human_review_required", () => {
    expect(isGovernedCatalogueCopyResponse({ ok: true, content: {} })).toBe(false);
    expect(
      isGovernedCatalogueCopyResponse({ ok: true, human_review_required: true, content: {} }),
    ).toBe(true);
  });

  it("normalizes legacy oasis-ai-chat service markers to catalogue-ai-copy", () => {
    expect(isLegacyCatalogueAiServiceMarker("oasis-ai-chat")).toBe(true);
    expect(isLegacyCatalogueAiServiceMarker("catalogue-ai-copy")).toBe(true);
    expect(normalizeCatalogueAiServiceMarker("oasis-ai-chat")).toBe("catalogue-ai-copy");
  });

  it("assertOperationalProvenanceComplete fails when human_review_required absent for catalogue copy", () => {
    const incomplete = extractInferenceProvenanceFromPayload(
      { ok: true, human_review_required: false },
      { service: CATALOGUE_AI_COPY_SERVICE, human_review_required: false },
    );
    const result = assertOperationalProvenanceComplete(incomplete);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.missing).toContain("human_review_required");
  });
});
