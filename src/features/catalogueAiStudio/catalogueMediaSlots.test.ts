import { describe, expect, it } from "vitest";
import {
  catalogueBenchmarkGovernance,
  catalogueBenchmarkGovernanceView,
  catalogueDerivativeOutput,
  catalogueDerivativeOutputView,
  catalogueEvaluateQaReadiness,
  catalogueExecuteMockDerivativeTransform,
  catalogueExactProductEnhancement,
  catalogueExactProductEnhancementView,
  catalogueGuidedCaptureView,
  catalogueGuidedMobileCapture,
  catalogueImageQaValidation,
  catalogueImageQaView,
  catalogueMediaTabDeepLink,
  cataloguePhotographyFamily,
  cataloguePhotographyFamilyView,
  catalogueRecordQaDisposition,
  catalogueRequiredMediaSlots,
  catalogueRunAutomatedQaChecks,
  catalogueValidateCaptureHandoff,
  catalogueValidateDerivativePersistenceHandoff,
  catalogueValidateDerivativeTransformOutput,
  catalogueValidateEnhancementHandoff,
  catalogueValidateEnhancementInstruction,
  catalogueValidateImagePromptInstruction,
} from "./catalogueMediaSlots";

describe("catalogueMediaTabDeepLink", () => {
  it("always deep-links to the literal Media tab path for the given product, regardless of slot type", () => {
    expect(catalogueMediaTabDeepLink("p1")).toBe("/products/p1?tab=media");
    expect(catalogueMediaTabDeepLink("abc-123")).toBe("/products/abc-123?tab=media");
  });
});

describe("cataloguePhotographyFamily", () => {
  it("resolves baklawa family from category signals", () => {
    const resolved = cataloguePhotographyFamily({ category: "Baklawa", subcategory: "Pyramid" });
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.contract.familyKey).toBe("baklawa_small_sweets");
    }
  });

  it("fail-closed view surfaces resolution errors for unknown explicit keys via contract guard", () => {
    const view = cataloguePhotographyFamilyView({ category: "Baklawa", subcategory: "Pyramid" });
    expect(view.family?.familyKey).toBe("baklawa_small_sweets");
    expect(view.resolutionError).toBeNull();
  });
});

describe("catalogueBenchmarkGovernance", () => {
  it("resolves Point 43 governance from product signals via Point 42 chain", () => {
    const resolved = catalogueBenchmarkGovernance({ category: "Baklawa", subcategory: "Pyramid" });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.contract.schema).toBe("point43_v1");
    expect(resolved.contract.familyKey).toBe("baklawa_small_sweets");
    expect(resolved.familyContract.schema).toBe("point42_v1");
  });

  it("view surfaces governance contract and family together", () => {
    const view = catalogueBenchmarkGovernanceView({ category: "Baklawa", subcategory: "Pyramid" });
    expect(view.governance?.schema).toBe("point43_v1");
    expect(view.family?.familyKey).toBe("baklawa_small_sweets");
    expect(view.resolutionError).toBeNull();
  });

  it("rejects forbidden brand references in image prompt instructions", () => {
    const result = catalogueValidateImagePromptInstruction("make it look like Bateel", {
      category: "Baklawa",
    });
    expect(result.ok).toBe(false);
  });

  it("accepts neutral operator instructions", () => {
    const result = catalogueValidateImagePromptInstruction("warmer background tone", {
      category: "Baklawa",
    });
    expect(result.ok).toBe(true);
  });
});

describe("catalogueGuidedMobileCapture", () => {
  const product = { productId: "p1", category: "Baklawa", subcategory: "Pyramid" };

  it("resolves Point 44 guided capture via Point 42/43 chain", () => {
    const resolved = catalogueGuidedMobileCapture(product, "hero_image");
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.contract.schema).toBe("point44_v1");
    expect(resolved.contract.familyKey).toBe("baklawa_small_sweets");
  });

  it("view surfaces contract and resolution errors", () => {
    const okView = catalogueGuidedCaptureView(product, "hero_image");
    expect(okView.contract?.binding.uploaderType).toBe("hero_image");
    expect(okView.resolutionError).toBeNull();

    const failView = catalogueGuidedCaptureView({ category: "Baklawa" }, "hero_image");
    expect(failView.contract).toBeNull();
    expect(failView.resolutionError).toContain("Product identity");
  });

  it("validates capture handoff through adapter", () => {
    const resolved = catalogueGuidedMobileCapture(product, "hero_image");
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    const handoff = catalogueValidateCaptureHandoff(resolved.contract, {
      uploaderType: "hero_image",
      mimeType: "image/jpeg",
      source: "guided_camera",
    });
    expect(handoff.ok).toBe(true);
  });
});

describe("catalogueExactProductEnhancement", () => {
  const product = { productId: "p1", category: "Baklawa", subcategory: "Pyramid" };
  const source = {
    sourceMediaId: "media-001",
    contentHash: "sha256:testhash",
    uploaderType: "hero_image",
  };

  it("resolves Point 45 exact-product enhancement via Point 42/43/44 chain", () => {
    const resolved = catalogueExactProductEnhancement(product, source);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.contract.schema).toBe("point45_v1");
    expect(resolved.contract.sourceBinding.readinessSlot).toBe("primary_image");
  });

  it("view surfaces contract and resolution errors", () => {
    const okView = catalogueExactProductEnhancementView(product, source);
    expect(okView.contract?.sourceBinding.sourceMediaId).toBe("media-001");
    expect(okView.resolutionError).toBeNull();

    const failView = catalogueExactProductEnhancementView(
      { category: "Baklawa" },
      source,
    );
    expect(failView.contract).toBeNull();
    expect(failView.resolutionError).toContain("Product identity");
  });

  it("rejects forbidden enhancement instructions through adapter", () => {
    const result = catalogueValidateEnhancementInstruction(
      "regenerate the packaging label",
      product,
    );
    expect(result.ok).toBe(false);
  });

  it("validates enhancement handoff as pending_review through adapter", () => {
    const resolved = catalogueExactProductEnhancement(product, source);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    const handoff = catalogueValidateEnhancementHandoff(resolved.contract, {
      candidateMediaRef: "mock://candidate",
      provenance: {
        providerName: "mock",
        policySchema: "point45_v1",
        sourceContentHash: source.contentHash,
        sourceMediaId: source.sourceMediaId,
        productId: product.productId!,
        readinessSlot: "primary_image",
        requestedOperations: ["lighting_balance"],
        preservationAttestation: {
          packagingTextPreserved: true,
          productGeometryPreserved: true,
          pieceCountPreserved: true,
          logoArtworkPreserved: true,
          productColorPreserved: true,
        },
        executedAt: new Date(0).toISOString(),
      },
    });
    expect(handoff.ok).toBe(true);
    if (!handoff.ok) return;
    expect(handoff.candidate.status).toBe("pending_review");
  });
});

describe("catalogueImageQaValidation", () => {
  const product = { productId: "p1", category: "Baklawa", subcategory: "Pyramid" };
  const candidate = {
    mediaRef: "mock://qa/candidate-001",
    origin: "capture" as const,
    productId: "p1",
    sourceMediaId: "media-001",
    sourceContentHash: "sha256:qahash",
    readinessSlot: "primary_image" as const,
    uploaderType: "hero_image",
    metadata: {
      mimeType: "image/jpeg",
      widthPx: 1200,
      heightPx: 1200,
      fileSizeBytes: 500_000,
    },
  };

  it("resolves Point 46 image QA via Point 42/43/44/45 chain", () => {
    const resolved = catalogueImageQaValidation(product, candidate);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.contract.schema).toBe("point46_v1");
    expect(resolved.contract.familyKey).toBe("baklawa_small_sweets");
  });

  it("view surfaces contract and resolution errors", () => {
    const okView = catalogueImageQaView(product, candidate);
    expect(okView.contract?.candidate.mediaRef).toBe("mock://qa/candidate-001");
    expect(okView.resolutionError).toBeNull();

    const failView = catalogueImageQaView({ category: "Baklawa" }, candidate);
    expect(failView.contract).toBeNull();
    expect(failView.resolutionError).toContain("Product identity");
  });

  it("runs automated checks and evaluates readiness through adapter", () => {
    const resolved = catalogueImageQaValidation(product, candidate);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    const checks = catalogueRunAutomatedQaChecks(resolved.contract);
    const readiness = catalogueEvaluateQaReadiness(checks);
    expect(readiness.ok).toBe(true);
  });

  it("records governed disposition with audit through adapter", () => {
    const resolved = catalogueImageQaValidation(product, candidate);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    const checks = catalogueRunAutomatedQaChecks(resolved.contract);
    const disposition = catalogueRecordQaDisposition(resolved.contract, checks, {
      disposition: "approved",
      reviewer: {
        reviewerId: "reviewer-1",
        role: "media_qa_reviewer",
        authorizedAt: new Date(0).toISOString(),
      },
    });
    expect(disposition.ok).toBe(true);
    if (!disposition.ok) return;
    expect(disposition.audit.schema).toBe("point46_audit_v1");
  });
});

describe("catalogueDerivativeOutput", () => {
  const product = { productId: "p1", category: "Baklawa", subcategory: "Pyramid" };
  const candidate = {
    mediaRef: "mock://qa/approved-001",
    origin: "capture" as const,
    productId: "p1",
    sourceMediaId: "media-001",
    sourceContentHash: "sha256:qahash",
    readinessSlot: "primary_image" as const,
    uploaderType: "hero_image",
    metadata: {
      mimeType: "image/jpeg",
      widthPx: 3000,
      heightPx: 4000,
      fileSizeBytes: 2_000_000,
    },
  };

  it("resolves Point 47 derivative contract from approved Point 46 QA source", () => {
    const qaResolved = catalogueImageQaValidation(product, candidate);
    expect(qaResolved.ok).toBe(true);
    if (!qaResolved.ok) return;

    const checks = catalogueRunAutomatedQaChecks(qaResolved.contract);
    const disposition = catalogueRecordQaDisposition(qaResolved.contract, checks, {
      disposition: "approved",
      reviewer: {
        reviewerId: "reviewer-1",
        role: "media_qa_reviewer",
        authorizedAt: new Date(0).toISOString(),
      },
    });
    expect(disposition.ok).toBe(true);
    if (!disposition.ok) return;

    const resolved = catalogueDerivativeOutput(
      product,
      {
        approvedMediaId: "media-approved-001",
        approvedMediaRef: candidate.mediaRef,
        sourceMediaId: candidate.sourceMediaId,
        sourceContentHash: candidate.sourceContentHash,
        productId: candidate.productId,
        readinessSlot: candidate.readinessSlot,
        uploaderType: candidate.uploaderType,
        familyKey: "baklawa_small_sweets",
      },
      disposition.audit,
      "web_hero_webp",
    );
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.contract.schema).toBe("point47_v1");
    expect(resolved.contract.profile.mimeType).toBe("image/webp");
  });

  it("view surfaces contract and resolution errors", () => {
    const okView = catalogueDerivativeOutputView(
      product,
      {
        approvedMediaId: "media-approved-001",
        approvedMediaRef: candidate.mediaRef,
        sourceMediaId: candidate.sourceMediaId,
        sourceContentHash: candidate.sourceContentHash,
        productId: candidate.productId,
        readinessSlot: candidate.readinessSlot,
        uploaderType: candidate.uploaderType,
        familyKey: "baklawa_small_sweets",
      },
      {
        schema: "point46_audit_v1",
        candidateMediaRef: candidate.mediaRef,
        productId: candidate.productId,
        readinessSlot: candidate.readinessSlot,
        origin: "capture",
        disposition: "pending_review",
        automatedChecks: [],
        recordedAt: new Date(0).toISOString(),
      },
      "web_hero_webp",
    );
    expect(okView.contract).toBeNull();
    expect(okView.resolutionError).toContain("approved disposition");
  });

  it("runs mock transform and persistence handoff through adapter", () => {
    const qaResolved = catalogueImageQaValidation(product, candidate);
    expect(qaResolved.ok).toBe(true);
    if (!qaResolved.ok) return;

    const checks = catalogueRunAutomatedQaChecks(qaResolved.contract);
    const disposition = catalogueRecordQaDisposition(qaResolved.contract, checks, {
      disposition: "approved",
      reviewer: {
        reviewerId: "reviewer-1",
        role: "media_qa_reviewer",
        authorizedAt: new Date(0).toISOString(),
      },
    });
    expect(disposition.ok).toBe(true);
    if (!disposition.ok) return;

    const resolved = catalogueDerivativeOutput(
      product,
      {
        approvedMediaId: "media-approved-001",
        approvedMediaRef: candidate.mediaRef,
        sourceMediaId: candidate.sourceMediaId,
        sourceContentHash: candidate.sourceContentHash,
        productId: candidate.productId,
        readinessSlot: candidate.readinessSlot,
        uploaderType: candidate.uploaderType,
        familyKey: "baklawa_small_sweets",
      },
      disposition.audit,
      "print_ready_jpeg",
    );
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    const output = catalogueExecuteMockDerivativeTransform(resolved.contract);
    expect("ok" in output).toBe(false);
    if ("ok" in output) return;

    const provenance = catalogueValidateDerivativeTransformOutput(resolved.contract, output);
    expect(provenance.ok).toBe(true);

    const handoff = catalogueValidateDerivativePersistenceHandoff(resolved.contract, output, {
      persistenceResult: { ok: true, storagePath: output.storagePath },
    });
    expect(handoff.ok).toBe(true);
  });
});

// environment — see mediaGovernanceMode.ts) — required slots reduce to hero_image only. This
// test is intentionally about the *wiring* (does the adapter correctly pass rows/context through
// to evaluateMediaReadiness() and shape its output), not a re-test of that engine's own formula —
// mediaReadinessEngine.test.ts already covers required/optional classification and approval rules.
describe("catalogueRequiredMediaSlots", () => {
  it("marks the required slot missing when no matching approved media row exists", () => {
    const slots = catalogueRequiredMediaSlots({ productId: "p1" }, []);
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((s) => s.status === "missing")).toBe(true);
  });

  it("marks the required slot satisfied only when an approved row of the matching type exists", () => {
    const slots = catalogueRequiredMediaSlots({ productId: "p1" }, [
      {
        id: "h1",
        type: "hero_image",
        status: "approved",
        file_url: "https://cdn.example/hero.jpg",
      },
    ]);
    expect(slots.some((s) => s.status === "satisfied")).toBe(true);
  });

  it("a pending/draft/rejected row does NOT satisfy a required slot (approved-only authority)", () => {
    const pending = catalogueRequiredMediaSlots({ productId: "p1" }, [
      {
        id: "h1",
        type: "hero_image",
        status: "pending_approval",
        file_url: "https://cdn.example/hero.jpg",
      },
    ]);
    expect(pending.every((s) => s.status === "missing")).toBe(true);

    const rejected = catalogueRequiredMediaSlots({ productId: "p1" }, [
      {
        id: "h1",
        type: "hero_image",
        status: "rejected",
        file_url: "https://cdn.example/hero.jpg",
      },
    ]);
    expect(rejected.every((s) => s.status === "missing")).toBe(true);
  });

  it("every returned slot carries a human label, not just a raw type", () => {
    const slots = catalogueRequiredMediaSlots({ productId: "p1" }, []);
    for (const slot of slots) {
      expect(slot.label).toBeTruthy();
      expect(typeof slot.label).toBe("string");
    }
  });

  // Bugbot-caught: a product with an approved legacy hero_image_url/media_status but zero
  // product_media rows must not disagree with the anchor/media preview, which already falls back
  // to that same legacy column via resolveProductCardHeroUrl().
  it("falls back to the legacy hero_image_url/media_status when there are no product_media rows", () => {
    const satisfied = catalogueRequiredMediaSlots({ productId: "p1" }, [], {
      hero_image_url: "https://cdn.example/legacy-hero.jpg",
      media_status: "approved",
    });
    expect(satisfied.some((s) => s.status === "satisfied")).toBe(true);
  });

  it("does not satisfy a slot from a legacy hero that isn't approved", () => {
    const pending = catalogueRequiredMediaSlots({ productId: "p1" }, [], {
      hero_image_url: "https://cdn.example/legacy-hero.jpg",
      media_status: "pending_approval",
    });
    expect(pending.every((s) => s.status === "missing")).toBe(true);
  });

  it("product_media rows take priority over the legacy hero fallback when rows exist", () => {
    const slots = catalogueRequiredMediaSlots(
      { productId: "p1" },
      [
        {
          id: "h1",
          type: "hero_image",
          status: "pending_approval",
          file_url: "https://cdn.example/hero.jpg",
        },
      ],
      { hero_image_url: "https://cdn.example/legacy-hero.jpg", media_status: "approved" },
    );
    expect(slots.every((s) => s.status === "missing")).toBe(true);
  });
});
