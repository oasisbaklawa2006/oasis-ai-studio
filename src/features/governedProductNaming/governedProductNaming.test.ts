import { describe, expect, it } from "vitest";
import { CATALOGUE_DRAFT_CONTENT_KEYS } from "@/features/catalogueAiStudio/catalogueDraftTypes";
import {
  buildHeuristicNamingSuggestions,
  detectUnsafeNamingClaims,
  governedNamingSuggestionsToFields,
  validateGovernedCatalogueCopy,
  validateNamingText,
  validateProductIdentity,
  validateProviderReviewEnvelope,
} from "./governedProductNamingContract";
import { mockCatalogueAiCopyProvider } from "./governedProductNamingProvider";

const BASE_FACTS = {
  product_name: "Cashew Pyramid Baklawa",
  category: "Baklawa",
  product_type: "Arabic sweets",
  pack_size: "500g",
};

describe("validateProductIdentity", () => {
  it("fails closed on blank product name", () => {
    expect(validateProductIdentity({ product_name: "  " }).ok).toBe(false);
  });

  it("accepts a non-empty product name", () => {
    expect(validateProductIdentity({ product_name: "Test" }).ok).toBe(true);
  });
});

describe("detectUnsafeNamingClaims", () => {
  it("flags unsupported superlatives not present in authoritative facts", () => {
    const reasons = detectUnsafeNamingClaims("The finest baklawa in the world.", BASE_FACTS);
    expect(reasons.some((r) => r.includes("superlative"))).toBe(true);
  });

  it("allows superlatives that appear in authoritative product_name", () => {
    const facts = { product_name: "Premium Dates Box", category: "Dates" };
    const reasons = detectUnsafeNamingClaims("Premium Dates Box — dates.", facts);
    expect(reasons.some((r) => r.includes("superlative"))).toBe(false);
  });

  it("flags medical and nutritional claims", () => {
    expect(
      detectUnsafeNamingClaims("Treats diabetes naturally.", BASE_FACTS).length,
    ).toBeGreaterThan(0);
    expect(detectUnsafeNamingClaims("Sugar-free indulgence.", BASE_FACTS).length).toBeGreaterThan(
      0,
    );
  });

  it("flags competitor-brand imitation", () => {
    const reasons = detectUnsafeNamingClaims("Like Godiva truffles but better.", BASE_FACTS);
    expect(reasons.some((r) => r.includes("competitor"))).toBe(true);
  });
});

describe("buildHeuristicNamingSuggestions", () => {
  it("grounds copy in authoritative facts only", () => {
    const result = buildHeuristicNamingSuggestions(BASE_FACTS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.suggestion_only).toBe(true);
    expect(result.approved).toBe(false);
    expect(result.human_review_required).toBe(true);
    expect(result.suggestions.short_description).toContain("Cashew Pyramid Baklawa");
    expect(result.suggestions.description).toContain("Baklawa");
    expect(result.suggestions.catalogue_title).toContain("500g");
    expect(result.provenance.service).toBe("heuristic");
    expect(result.provenance.fail_closed).toBe(false);
  });

  it("reuses authoritative description when provided", () => {
    const result = buildHeuristicNamingSuggestions({
      ...BASE_FACTS,
      description: "Hand-layered filo with cashew filling.",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.suggestions.description).toBe("Hand-layered filo with cashew filling.");
  });

  it("fails closed without product identity", () => {
    const result = buildHeuristicNamingSuggestions({ product_name: "" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.provenance.fail_closed).toBe(true);
    expect(result.reason).toContain("product_name");
  });

  it("never emits Premium/signature marketing filler", () => {
    const result = buildHeuristicNamingSuggestions(BASE_FACTS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const blob = JSON.stringify(result.suggestions).toLowerCase();
    expect(blob).not.toContain("premium oasis");
    expect(blob).not.toContain("signature");
    expect(blob).not.toContain("crafted with quality ingredients");
  });
});

describe("validateGovernedCatalogueCopy", () => {
  const validContent = Object.fromEntries(
    CATALOGUE_DRAFT_CONTENT_KEYS.map((k) => [k, `Grounded copy for ${k}`]),
  ) as Record<(typeof CATALOGUE_DRAFT_CONTENT_KEYS)[number], string>;

  it("accepts fact-grounded provider output", () => {
    const result = validateGovernedCatalogueCopy(validContent, BASE_FACTS);
    expect(result.ok).toBe(true);
  });

  it("rejects unsafe superlative output", () => {
    const unsafe = {
      ...validContent,
      long_description: "The best baklawa you will ever taste.",
    };
    const result = validateGovernedCatalogueCopy(unsafe, BASE_FACTS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.unsafe_fields).toContain("long_description");
  });

  it("rejects empty fields", () => {
    const result = validateGovernedCatalogueCopy(
      { ...validContent, short_description: "" },
      BASE_FACTS,
    );
    expect(result.ok).toBe(false);
  });
});

describe("validateProviderReviewEnvelope", () => {
  it("requires human_review_required and review-only markers", () => {
    expect(
      validateProviderReviewEnvelope({
        ok: true,
        human_review_required: true,
        suggestion_only: true,
        approved: false,
      }).ok,
    ).toBe(true);
    expect(validateProviderReviewEnvelope({ ok: true, human_review_required: false }).ok).toBe(
      false,
    );
    expect(
      validateProviderReviewEnvelope({
        ok: true,
        human_review_required: true,
        approved: true,
      }).ok,
    ).toBe(false);
  });
});

describe("mockCatalogueAiCopyProvider", () => {
  it("returns reviewable suggestions on ok scenario", () => {
    const { envelope, parseResult } = mockCatalogueAiCopyProvider(BASE_FACTS, "ok");
    expect(envelope.human_review_required).toBe(true);
    expect(parseResult.ok).toBe(true);
  });

  it("fails closed on missing review marker", () => {
    const { parseResult } = mockCatalogueAiCopyProvider(BASE_FACTS, "missing_review_marker");
    expect(parseResult.ok).toBe(false);
  });

  it("fails closed on unsafe superlative output", () => {
    const { parseResult } = mockCatalogueAiCopyProvider(BASE_FACTS, "unsafe_superlative");
    expect(parseResult.ok).toBe(false);
  });

  it("fails closed on invalid schema", () => {
    const { parseResult } = mockCatalogueAiCopyProvider(BASE_FACTS, "invalid_schema");
    expect(parseResult.ok).toBe(false);
  });
});

describe("governedNamingSuggestionsToFields", () => {
  it("marks every emitted field as suggestion-only and unapproved", () => {
    const result = buildHeuristicNamingSuggestions(BASE_FACTS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const fields = governedNamingSuggestionsToFields(result.suggestions);
    expect(fields.length).toBeGreaterThan(0);
    for (const field of fields) {
      expect(field.suggestion_only).toBe(true);
      expect(field.approved).toBe(false);
    }
  });
});

describe("validateNamingText", () => {
  it("passes grounded factual copy", () => {
    expect(validateNamingText("Cashew Pyramid Baklawa — Baklawa.", BASE_FACTS).ok).toBe(true);
  });

  it("rejects invented ingredient claims without authoritative description", () => {
    const check = validateNamingText("Crafted with premium pistachio and honey.", {
      product_name: "Test Product",
    });
    expect(check.ok).toBe(false);
  });
});
