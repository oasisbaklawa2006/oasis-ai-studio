import { describe, expect, it } from "vitest";
import type { FastCreateDraftSnapshot } from "@/features/fastCreate/fastCreateDraft";
import type { FastCreateSuggestions } from "@/features/fastCreate/fastCreateSuggestions";
import {
  assertMobileProductCreateSaveAllowed,
  assertProductIdentity,
  classifyDeferredFields,
  deriveMobileDraftWorkflowState,
  evaluateMobileProductCreateAuthority,
  extractPoint30Provenance,
  HUMAN_APPROVAL_ROUTE,
  MOBILE_PRODUCT_CREATE_ROUTE,
  SUPPORTED_MOBILE_INTAKE_MODES,
} from "./mobileProductCreateAuthority";

const baseSuggestions: FastCreateSuggestions = {
  formPatch: {
    product_name: "Test Baklawa",
    category: "Baklawa",
    hsn_code: "19059090",
    gst_rate: 5,
    ingredients: "flour, nuts",
  },
  aliases: [],
  whatsappKeywords: [],
  searchKeywords: [],
  labelStarter: {
    product_name: "Test Baklawa",
    ingredients_hint: "",
    allergen_hint: "",
    net_weight_hint: "",
  },
  productTruthStarters: {
    piecesPerKg: null,
    traysPerMasterCarton: null,
    primaryPackSummary: null,
  },
  sources: { defaults: true, heuristicAliases: false, aiCompliance: false, aiAliases: false },
};

describe("Point 51 — mobile product create authority census constants", () => {
  it("declares the canonical mobile route", () => {
    expect(MOBILE_PRODUCT_CREATE_ROUTE).toBe("/products/new/fast");
  });

  it("routes human approval to Approval Inbox (Point 39)", () => {
    expect(HUMAN_APPROVAL_ROUTE).toBe("/approvals");
  });

  it("lists governed intake modes from Point 29 adapters", () => {
    expect(SUPPORTED_MOBILE_INTAKE_MODES).toEqual(["barcode", "ocr", "voice", "text"]);
  });
});

describe("assertProductIdentity — fail closed", () => {
  it("blocks empty product name", () => {
    const block = assertProductIdentity("   ");
    expect(block?.allowed).toBe(false);
    expect(block?.blockReason).toBe("MISSING_PRODUCT_IDENTITY");
  });

  it("allows non-empty product name", () => {
    expect(assertProductIdentity("Cashew Pyramid")).toBeNull();
  });
});

describe("evaluateMobileProductCreateAuthority", () => {
  it("blocks unauthorized roles", () => {
    const result = evaluateMobileProductCreateAuthority({
      productName: "Test",
      roles: ["viewer"],
      canWriteDirectly: false,
      isContributor: false,
      suggestions: null,
    });
    expect(result.allowed).toBe(false);
    expect(result.blockReason).toBe("UNAUTHORIZED_ROLE");
    expect(result.requiresGovernedDraft).toBe(true);
  });

  it("allows catalogue contributor through governed draft only", () => {
    const result = evaluateMobileProductCreateAuthority({
      productName: "Test",
      roles: ["catalogue_contributor"],
      canWriteDirectly: false,
      isContributor: true,
      suggestions: baseSuggestions,
    });
    expect(result.allowed).toBe(true);
    expect(result.requiresGovernedDraft).toBe(true);
    expect(result.workflowState).toBe("READY_FOR_GOVERNED_SUBMIT");
    expect(result.humanApprovalRoute).toBe("/approvals");
  });

  it("allows admin direct write when sale type is supported", () => {
    const result = evaluateMobileProductCreateAuthority({
      productName: "Test",
      roles: ["owner"],
      canWriteDirectly: true,
      isContributor: false,
      suggestions: baseSuggestions,
      saleType: "retail_ready_pack",
      attemptingDirectWrite: true,
    });
    expect(result.allowed).toBe(true);
    expect(result.requiresGovernedDraft).toBe(false);
  });

  it("blocks direct write for unsupported sale types (fail closed to draft)", () => {
    const result = evaluateMobileProductCreateAuthority({
      productName: "Test",
      roles: ["owner"],
      canWriteDirectly: true,
      isContributor: false,
      suggestions: baseSuggestions,
      saleType: "internal_bom",
      attemptingDirectWrite: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.blockReason).toBe("UNSUPPORTED_SALE_TYPE_DIRECT");
    expect(result.requiresGovernedDraft).toBe(true);
  });

  it("blocks when Point 30 provenance marks fail_closed extraction", () => {
    const suggestions: FastCreateSuggestions = {
      ...baseSuggestions,
      extractionProvenance: [
        {
          service: "generate-product-attributes",
          provider_status: "failed",
          used_heuristic_fallback: false,
          fail_closed: true,
          invoked_at: new Date().toISOString(),
        },
      ],
    };
    const result = evaluateMobileProductCreateAuthority({
      productName: "Test",
      roles: ["catalogue_contributor"],
      canWriteDirectly: false,
      isContributor: true,
      suggestions,
    });
    expect(result.allowed).toBe(false);
    expect(result.blockReason).toBe("MALFORMED_EXTRACTION");
  });
});

describe("deriveMobileDraftWorkflowState — Point 38", () => {
  const draft: FastCreateDraftSnapshot = {
    productName: "Test",
    categoryKey: "baklawa",
    saleType: "retail_ready_pack",
    packagingCode: null,
    packagingLabel: null,
    qtyPerPack: "",
    mrp: "",
    b2bPrice: "",
    b2bEnabled: false,
    heroUrl: null,
    resolvedSku: null,
    suggestions: null,
    editedDescription: null,
    editedAliases: null,
    editedWhatsappKeywords: null,
    intakeBarcode: null,
  };

  it("returns INTAKE when name is empty", () => {
    expect(deriveMobileDraftWorkflowState({ ...draft, productName: "" }, false)).toBe("INTAKE");
  });

  it("returns DRAFT_IN_PROGRESS while filling fields", () => {
    expect(deriveMobileDraftWorkflowState(draft, false)).toBe("DRAFT_IN_PROGRESS");
  });

  it("returns READY when suggestions generated", () => {
    expect(
      deriveMobileDraftWorkflowState({ ...draft, suggestions: baseSuggestions }, false),
    ).toBe("READY_FOR_GOVERNED_SUBMIT");
  });

  it("returns SUBMITTED after governed draft submit", () => {
    expect(deriveMobileDraftWorkflowState(draft, true)).toBe("SUBMITTED_AWAITING_HUMAN_APPROVAL");
  });
});

describe("classifyDeferredFields — Point 53 semantics", () => {
  it("marks AI-suggested compliance fields as suggestion_only", () => {
    const suggestions: FastCreateSuggestions = {
      ...baseSuggestions,
      complianceFieldMeta: {
        hsn_code: { source: "ai_suggestion", approved: false },
      },
      pendingAiAliases: [{ alias: "ai alias", alias_type: "search_term" }],
    };
    const deferred = classifyDeferredFields(suggestions);
    expect(deferred.some((d) => d.field === "hsn_code" && d.status === "suggestion_only")).toBe(
      true,
    );
    expect(deferred.some((d) => d.field === "pending_ai_aliases")).toBe(true);
  });

  it("marks missing compliance fields as unknown", () => {
    const suggestions: FastCreateSuggestions = {
      ...baseSuggestions,
      formPatch: { ...baseSuggestions.formPatch, shelf_life_days: undefined },
    };
    const deferred = classifyDeferredFields(suggestions);
    expect(deferred.some((d) => d.field === "shelf_life_days" && d.status === "unknown")).toBe(
      true,
    );
  });
});

describe("extractPoint30Provenance", () => {
  it("returns extraction provenance from suggestions", () => {
    const provenance = [
      {
        service: "heuristic" as const,
        provider_status: "ok" as const,
        used_heuristic_fallback: true,
        fail_closed: false,
        invoked_at: "2026-09-06T00:00:00.000Z",
      },
    ];
    expect(
      extractPoint30Provenance({ ...baseSuggestions, extractionProvenance: provenance }),
    ).toEqual(provenance);
  });
});

describe("assertMobileProductCreateSaveAllowed", () => {
  it("throws for blocked identity", () => {
    expect(() =>
      assertMobileProductCreateSaveAllowed({
        productName: "",
        roles: ["owner"],
        canWriteDirectly: true,
        isContributor: false,
        suggestions: baseSuggestions,
      }),
    ).toThrow(/Product name is required/);
  });
});
