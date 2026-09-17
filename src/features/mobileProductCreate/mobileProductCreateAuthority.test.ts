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

describe("Point51 mobile product-create authority", () => {
  it("locks the canonical route and governed intake modes", () => {
    expect(MOBILE_PRODUCT_CREATE_ROUTE).toBe("/products/new/fast");
    expect(HUMAN_APPROVAL_ROUTE).toBe("/approvals");
    expect(SUPPORTED_MOBILE_INTAKE_MODES).toEqual(["barcode", "ocr", "voice", "text"]);
  });

  it("fails closed without product identity", () => {
    const block = assertProductIdentity("   ");
    expect(block?.allowed).toBe(false);
    expect(block?.blockReason).toBe("MISSING_PRODUCT_IDENTITY");
  });

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

  it("routes contributors through human approval", () => {
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

  it("does not let privileged roles bypass Point27 draft governance", () => {
    const result = evaluateMobileProductCreateAuthority({
      productName: "Test",
      roles: ["owner"],
      canWriteDirectly: true,
      isContributor: false,
      suggestions: baseSuggestions,
      saleType: "retail_ready_pack",
    });
    expect(result.allowed).toBe(true);
    expect(result.requiresGovernedDraft).toBe(true);
    expect(result.humanApprovalRoute).toBe("/approvals");
  });

  it("fails closed for unsupported internal-only sale type", () => {
    const result = evaluateMobileProductCreateAuthority({
      productName: "Test",
      roles: ["owner"],
      canWriteDirectly: true,
      isContributor: false,
      suggestions: baseSuggestions,
      saleType: "internal_bom",
    });
    expect(result.allowed).toBe(false);
    expect(result.blockReason).toBe("UNSUPPORTED_SALE_TYPE");
    expect(result.requiresGovernedDraft).toBe(true);
  });

  it("blocks failed-closed AI extraction provenance", () => {
    const suggestions: FastCreateSuggestions = {
      ...baseSuggestions,
      extractionProvenance: [
        {
          service: "generate-product-attributes",
          provider_status: "failed",
          used_heuristic_fallback: false,
          fail_closed: true,
          invoked_at: "2026-09-14T00:00:00.000Z",
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

  it("derives the governed mobile workflow states", () => {
    expect(deriveMobileDraftWorkflowState({ ...draft, productName: "" }, false)).toBe("INTAKE");
    expect(deriveMobileDraftWorkflowState(draft, false)).toBe("DRAFT_IN_PROGRESS");
    expect(deriveMobileDraftWorkflowState({ ...draft, suggestions: baseSuggestions }, false)).toBe(
      "READY_FOR_GOVERNED_SUBMIT",
    );
    expect(deriveMobileDraftWorkflowState(draft, true)).toBe("SUBMITTED_AWAITING_HUMAN_APPROVAL");
  });

  it("classifies Point34 category-rule facts as deferred", () => {
    const suggestions: FastCreateSuggestions = {
      ...baseSuggestions,
      formPatch: { ...baseSuggestions.formPatch, shelf_life_days: 90 },
      complianceFieldMeta: {
        shelf_life_days: { source: "category_rule", approved: false, suggestion_only: true },
      },
    };
    expect(
      classifyDeferredFields(suggestions).some(
        (entry) => entry.field === "shelf_life_days" && entry.status === "deferred",
      ),
    ).toBe(true);
  });

  it("classifies AI facts and pending aliases as suggestion-only", () => {
    const suggestions: FastCreateSuggestions = {
      ...baseSuggestions,
      formPatch: { ...baseSuggestions.formPatch, hsn_code: "19059090" },
      complianceFieldMeta: {
        hsn_code: { source: "ai_suggestion", approved: false, suggestion_only: true },
      },
      pendingAiAliases: [{ alias: "ai alias", alias_type: "search_term" }],
    };
    const entries = classifyDeferredFields(suggestions);
    expect(
      entries.some((entry) => entry.field === "hsn_code" && entry.status === "suggestion_only"),
    ).toBe(true);
    expect(entries.some((entry) => entry.field === "pending_ai_aliases")).toBe(true);
  });

  it("marks missing compliance details unknown", () => {
    const entries = classifyDeferredFields(baseSuggestions);
    expect(entries.some((entry) => entry.status === "unknown")).toBe(true);
  });

  it("preserves Point30 provenance", () => {
    const provenance = [
      {
        service: "heuristic" as const,
        provider_status: "ok" as const,
        used_heuristic_fallback: true,
        fail_closed: false,
        invoked_at: "2026-09-14T00:00:00.000Z",
      },
    ];
    expect(
      extractPoint30Provenance({ ...baseSuggestions, extractionProvenance: provenance }),
    ).toEqual(provenance);
  });

  it("save guard throws on blocked identity", () => {
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
