import { describe, expect, it } from "vitest";
import type { ProductMediaContext } from "./types";
import {
  bindEnhancementSourceMedia,
  buildEnhancementPolicy,
  buildExactProductEnhancementCensus,
  executeMockEnhancement,
  resolveExactProductEnhancement,
  validateEnhancementHandoff,
  validateEnhancementOperatorInstruction,
  validateEnhancementProviderOutput,
} from "./exactProductEnhancement";

const POINT44_HEAD = "63e2d35afbfe2a48fd6db18dfd54644157320837";

const baklawaProduct: ProductMediaContext = {
  productId: "prod-baklawa-1",
  category: "Baklawa",
  subcategory: "Pyramid",
};

const sourceFixture = {
  sourceMediaId: "media-hero-001",
  contentHash: "sha256:abc123def456",
  uploaderType: "hero_image",
};

describe("exactProductEnhancement", () => {
  describe("source media binding", () => {
    it("binds immutable source media to product + Point 42 slot", () => {
      const bound = bindEnhancementSourceMedia(baklawaProduct, sourceFixture);
      expect(bound.ok).toBe(true);
      if (!bound.ok) return;
      expect(bound.binding.sourceMediaId).toBe("media-hero-001");
      expect(bound.binding.contentHash).toBe("sha256:abc123def456");
      expect(bound.binding.readinessSlot).toBe("primary_image");
      expect(bound.binding.familyKey).toBe("baklawa_small_sweets");
    });

    it("fail-closed when product identity is unresolved", () => {
      const bound = bindEnhancementSourceMedia({ category: "Baklawa" }, sourceFixture);
      expect(bound.ok).toBe(false);
      if (bound.ok) return;
      expect(bound.code).toBe("product_identity_unresolved");
    });

    it("fail-closed when source content hash is missing", () => {
      const bound = bindEnhancementSourceMedia(baklawaProduct, {
        ...sourceFixture,
        contentHash: "",
      });
      expect(bound.ok).toBe(false);
      if (bound.ok) return;
      expect(bound.code).toBe("source_hash_missing");
    });

    it("fail-closed when source media id is missing", () => {
      const bound = bindEnhancementSourceMedia(baklawaProduct, {
        ...sourceFixture,
        sourceMediaId: "",
      });
      expect(bound.ok).toBe(false);
      if (bound.ok) return;
      expect(bound.code).toBe("source_media_unbound");
    });

    it("fail-closed on unknown uploader type", () => {
      const bound = bindEnhancementSourceMedia(baklawaProduct, {
        ...sourceFixture,
        uploaderType: "not_a_real_slot",
      });
      expect(bound.ok).toBe(false);
    });
  });

  describe("enhancement policy and instruction validation", () => {
    it("builds policy with allowed lighting/background operations and preservation requirements", () => {
      const resolved = resolveExactProductEnhancement(baklawaProduct, sourceFixture);
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;

      const policy = buildEnhancementPolicy(resolved.governance);
      expect(policy.allowedOperations).toContain("lighting_balance");
      expect(policy.allowedOperations).toContain("background_cleanup");
      expect(policy.forbiddenOperations).toContain("regenerate_packaging");
      expect(policy.forbiddenOperations).toContain("inpaint_product");
      expect(policy.preservationRequirements.length).toBeGreaterThanOrEqual(5);
      expect(policy.benchmarkConstraints.length).toBeGreaterThan(0);
    });

    it("accepts neutral lighting/background instructions", () => {
      const result = validateEnhancementOperatorInstruction(
        "soften shadows and clean neutral background",
        baklawaProduct,
      );
      expect(result.ok).toBe(true);
    });

    it("rejects instructions that regenerate packaging text", () => {
      const result = validateEnhancementOperatorInstruction(
        "regenerate the packaging label text to be clearer",
        baklawaProduct,
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe("forbidden_enhancement_operation");
    });

    it("rejects instructions that alter product geometry", () => {
      const result = validateEnhancementOperatorInstruction(
        "change the shape of the baklawa pieces",
        baklawaProduct,
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe("forbidden_enhancement_operation");
    });

    it("rejects instructions that conflict with Point 43 benchmark governance", () => {
      const result = validateEnhancementOperatorInstruction("make it look like Bateel", baklawaProduct);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe("conflicts_with_benchmark");
    });
  });

  describe("exact-product enhancement resolution", () => {
    it("resolves point45_v1 contract with Point 42/43/44 upstream chain", () => {
      const resolved = resolveExactProductEnhancement(baklawaProduct, sourceFixture);
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;

      expect(resolved.contract.schema).toBe("point45_v1");
      expect(resolved.contract.familyKey).toBe("baklawa_small_sweets");
      expect(resolved.governance.schema).toBe("point43_v1");
      expect(resolved.contract.upstreamAuthority).toEqual({
        photographyFamilies: "point42",
        benchmarkGovernance: "point43",
        mobileCapture: "point44",
      });
      expect(resolved.contract.outputPolicy.reviewCandidateOnly).toBe(true);
      expect(resolved.contract.outputPolicy.directPublishForbidden).toBe(true);
      expect(resolved.contract.outputPolicy.qaAuthority).toBe("point46");
    });

    it("marks downstream QA and outputs as separate authorities", () => {
      const resolved = resolveExactProductEnhancement(baklawaProduct, sourceFixture);
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;
      expect(resolved.contract.downstreamAuthority).toEqual({
        qa: "point46",
        outputs: "point47",
      });
    });
  });

  describe("provider provenance validation", () => {
    it("accepts mock provider output with matching source binding and preservation attestation", () => {
      const resolved = resolveExactProductEnhancement(baklawaProduct, sourceFixture);
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;

      const mockOutput = executeMockEnhancement(resolved.contract, {
        operations: ["lighting_balance", "background_cleanup"],
      });
      expect("ok" in mockOutput).toBe(false);

      const provenanceCheck = validateEnhancementProviderOutput(
        resolved.contract,
        mockOutput as Exclude<typeof mockOutput, { ok: false }>,
      );
      expect(provenanceCheck.ok).toBe(true);
    });

    it("fail-closed when provider output source hash mismatches bound source", () => {
      const resolved = resolveExactProductEnhancement(baklawaProduct, sourceFixture);
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;

      const mockOutput = executeMockEnhancement(resolved.contract, {
        operations: ["lighting_balance"],
      });
      if ("ok" in mockOutput) return;

      const tampered = {
        ...mockOutput,
        provenance: {
          ...mockOutput.provenance,
          sourceContentHash: "sha256:tampered",
        },
      };

      const check = validateEnhancementProviderOutput(resolved.contract, tampered);
      expect(check.ok).toBe(false);
      if (check.ok) return;
      expect(check.error).toBe("source_hash_mismatch");
    });

    it("fail-closed when preservation attestation is incomplete", () => {
      const resolved = resolveExactProductEnhancement(baklawaProduct, sourceFixture);
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;

      const mockOutput = executeMockEnhancement(resolved.contract, {
        operations: ["lighting_balance"],
      });
      if ("ok" in mockOutput) return;

      const unproven = {
        ...mockOutput,
        provenance: {
          ...mockOutput.provenance,
          preservationAttestation: {
            ...mockOutput.provenance.preservationAttestation,
            packagingTextPreserved: false,
          },
        },
      };

      const check = validateEnhancementProviderOutput(resolved.contract, unproven);
      expect(check.ok).toBe(false);
      if (check.ok) return;
      expect(check.error).toBe("preservation_unproven");
    });

    it("fail-closed when provider output lacks provenance", () => {
      const resolved = resolveExactProductEnhancement(baklawaProduct, sourceFixture);
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;

      const check = validateEnhancementProviderOutput(resolved.contract, {
        candidateMediaRef: "mock://no-provenance",
        provenance: null as never,
      });
      expect(check.ok).toBe(false);
      if (check.ok) return;
      expect(check.error).toBe("provenance_missing");
    });
  });

  describe("enhancement handoff validation", () => {
    it("accepts handoff as pending_review candidate only", () => {
      const resolved = resolveExactProductEnhancement(baklawaProduct, sourceFixture);
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;

      const mockOutput = executeMockEnhancement(resolved.contract, {
        operations: ["exposure_normalization"],
      });
      if ("ok" in mockOutput) return;

      const handoff = validateEnhancementHandoff(resolved.contract, mockOutput);
      expect(handoff.ok).toBe(true);
      if (!handoff.ok) return;
      expect(handoff.candidate.status).toBe("pending_review");
    });

    it("rejects auto-approve attempts", () => {
      const resolved = resolveExactProductEnhancement(baklawaProduct, sourceFixture);
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;

      const mockOutput = executeMockEnhancement(resolved.contract, {
        operations: ["lighting_balance"],
      });
      if ("ok" in mockOutput) return;

      const handoff = validateEnhancementHandoff(resolved.contract, mockOutput, {
        attemptedStatus: "approved",
      });
      expect(handoff.ok).toBe(false);
      if (handoff.ok) return;
      expect(handoff.error).toBe("auto_approve_forbidden");
    });

    it("rejects direct publish attempts", () => {
      const resolved = resolveExactProductEnhancement(baklawaProduct, sourceFixture);
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;

      const mockOutput = executeMockEnhancement(resolved.contract, {
        operations: ["background_cleanup"],
      });
      if ("ok" in mockOutput) return;

      const handoff = validateEnhancementHandoff(resolved.contract, mockOutput, {
        attemptedPublish: true,
      });
      expect(handoff.ok).toBe(false);
      if (handoff.ok) return;
      expect(handoff.error).toBe("direct_publish_forbidden");
    });

    it("mock provider rejects forbidden operations", () => {
      const resolved = resolveExactProductEnhancement(baklawaProduct, sourceFixture);
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;

      const result = executeMockEnhancement(resolved.contract, {
        operations: ["inpaint_product" as never],
      });
      expect("ok" in result && result.ok === false).toBe(true);
    });

    it("mock provider rejects forbidden instructions", () => {
      const resolved = resolveExactProductEnhancement(baklawaProduct, sourceFixture);
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;

      const result = executeMockEnhancement(resolved.contract, {
        operations: ["lighting_balance"],
        instruction: "replace the logo with a new design",
      });
      expect("ok" in result && result.ok === false).toBe(true);
    });
  });

  it("builds census with Point 44 predecessor SHA and risky path evidence", () => {
    const census = buildExactProductEnhancementCensus(POINT44_HEAD, POINT44_HEAD);
    expect(census.schema).toBe("point45_census_v1");
    expect(census.baselineSha).toBe(POINT44_HEAD);
    expect(census.predecessorSha).toBe(POINT44_HEAD);
    expect(census.allowedOperationCount).toBeGreaterThan(0);
    expect(census.forbiddenOperationCount).toBeGreaterThan(0);
    expect(census.riskyPaths.length).toBeGreaterThan(0);
    expect(census.gaps.length).toBeGreaterThan(0);
    expect(census.surfaces.catalogueAiGateway).toContain("no image enhancement");
  });
});
