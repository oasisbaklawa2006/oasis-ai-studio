import { describe, expect, it } from "vitest";
import { createAiSuggestionFieldMeta, createManualFieldMeta } from "@/shared/ai/complianceApproval";
import {
  applyGovernedComplianceToForm,
  extractGovernedAliases,
  extractGovernedCompliance,
  mergeGovernedComplianceSuggestions,
} from "./index";

describe("governedFieldMerge", () => {
  it("does not overwrite approved canonical compliance fields", () => {
    const result = mergeGovernedComplianceSuggestions({
      currentForm: { hsn_code: "12345678", gst_rate: "18" },
      suggestions: { hsn_code: "99999999", gst_rate: "5" },
      metaMap: {
        hsn_code: createManualFieldMeta(),
        gst_rate: createManualFieldMeta(),
      },
    });

    expect(result.merged.hsn_code).toBe("12345678");
    expect(result.merged.gst_rate).toBe("18");
    expect(result.appliedFields).toEqual([]);
    expect(result.preservedFields).toEqual(["hsn_code", "gst_rate"]);
  });

  it("does not overwrite pre-existing non-empty values without ai meta", () => {
    const result = mergeGovernedComplianceSuggestions({
      currentForm: { ingredients: "Human recipe sheet" },
      suggestions: { ingredients: "AI draft ingredients" },
      metaMap: {},
    });

    expect(result.merged.ingredients).toBe("Human recipe sheet");
    expect(result.preservedFields).toEqual(["ingredients"]);
  });

  it("applies AI suggestions only to empty or prior ai_suggestion fields", () => {
    const result = mergeGovernedComplianceSuggestions({
      currentForm: { hsn_code: "", ingredients: "old ai text" },
      suggestions: { hsn_code: "18069090", ingredients: "new ai text" },
      metaMap: { ingredients: createAiSuggestionFieldMeta() },
    });

    expect(result.merged.hsn_code).toBe("18069090");
    expect(result.merged.ingredients).toBe("new ai text");
    expect(result.appliedFields).toEqual(["hsn_code", "ingredients"]);
    expect(result.complianceFieldMeta.hsn_code?.source).toBe("ai_suggestion");
  });
});

describe("extractGovernedCompliance", () => {
  it("marks valid edge response as provider ok", () => {
    const result = extractGovernedCompliance({
      product_name: "Chocolate Truffle",
      category: "chocolates",
      edgeData: {
        suggestion_only: true,
        approved: false,
        disclaimer:
          "AI suggestion only. Final GST/HSN must be approved manually by authorized user.",
        suggestions: { hsn_code: "18069090", gst_rate: "5" },
      },
      edgeError: null,
    });

    expect(result.provenance.provider_status).toBe("ok");
    expect(result.provenance.fail_closed).toBe(false);
    expect(result.suggestions.some((s) => s.field === "hsn_code")).toBe(true);
  });

  it("fail-closes on edge error and uses heuristic suggestions", () => {
    const result = extractGovernedCompliance({
      product_name: "Chocolate Truffle",
      category: "chocolates",
      edgeData: null,
      edgeError: { message: "Function timeout" },
    });

    expect(result.provenance.provider_status).toBe("degraded");
    expect(result.provenance.fail_closed).toBe(true);
    expect(result.provenance.used_heuristic_fallback).toBe(true);
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestion_only).toBe(true);
    expect(result.approved).toBe(false);
  });

  it("rejects non-governed AI response that claims approval", () => {
    const result = extractGovernedCompliance({
      product_name: "Test",
      edgeData: {
        suggestion_only: true,
        approved: true,
        suggestions: { hsn_code: "12345678" },
      },
      edgeError: null,
    });

    expect(result.provenance.provider_status).toBe("failed");
    expect(result.provenance.fail_closed).toBe(true);
  });
});

describe("applyGovernedComplianceToForm", () => {
  it("preserves canonical product master values during enrichment apply", () => {
    const extraction = extractGovernedCompliance({
      product_name: "Baklawa",
      edgeData: {
        suggestion_only: true,
        approved: false,
        disclaimer:
          "AI suggestion only. Final GST/HSN must be approved manually by authorized user.",
        suggestions: { hsn_code: "19059090", ingredients: "AI draft" },
      },
      edgeError: null,
    });

    const { form, preservedFields } = applyGovernedComplianceToForm(
      { hsn_code: "11111111" },
      extraction,
      { hsn_code: createManualFieldMeta() },
    );

    expect(form.hsn_code).toBe("11111111");
    expect(form.ingredients).toBe("AI draft");
    expect(preservedFields).toContain("hsn_code");
  });
});

describe("extractGovernedAliases", () => {
  it("rejects JSON stream artifacts and fails closed", () => {
    const result = extractGovernedAliases([
      '{"object":"chat.completion.chunk"',
      '"choices":[{"delta":{"content":"pyramid baklawa"}}]',
    ]);

    expect(result.aliases).toEqual([]);
    expect(result.provenance.fail_closed).toBe(true);
    expect(result.provenance.provider_status).toBe("failed");
  });

  it("returns sanitized aliases when fragments are valid", () => {
    const result = extractGovernedAliases(["pyramid baklawa", "cashew pyramid", "pyramid baklawa"]);

    expect(result.aliases).toEqual(["pyramid baklawa", "cashew pyramid"]);
    expect(result.provenance.provider_status).toBe("ok");
    expect(result.provenance.fail_closed).toBe(false);
  });
});
