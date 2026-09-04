import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastCreateSuggestions } from "@/features/fastCreate/fastCreateSuggestions";
import { createAiSuggestionFieldMeta, createManualFieldMeta } from "@/shared/ai/complianceApproval";
import {
  applyGovernedComplianceToForm,
  enrichFastCreateWithGovernedAi,
  extractGovernedAliases,
  extractGovernedCompliance,
  getPersistableFastCreateAliases,
  mergeGovernedComplianceSuggestions,
} from "./index";

const invokeMock = vi.fn();
const fetchMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => invokeMock(...args),
    },
  },
}));

beforeEach(() => {
  invokeMock.mockReset();
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as typeof fetch;
  import.meta.env.VITE_SUPABASE_URL = "https://test-project.supabase.co";
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";
});

afterEach(() => {
  fetchMock.mockReset();
});

function buildBaseSuggestions(): FastCreateSuggestions {
  return {
    formPatch: { ingredients: "", allergen_warnings: "" },
    aliases: [{ alias: "heuristic alias", alias_type: "search_term" }],
    whatsappKeywords: ["heuristic"],
    searchKeywords: ["heuristic alias"],
    labelStarter: {
      product_name: "Pyramid Baklawa",
      ingredients_hint: "base ingredients",
      allergen_hint: "base allergens",
      net_weight_hint: "500g",
    },
    productTruthStarters: {
      piecesPerKg: null,
      traysPerMasterCarton: null,
      primaryPackSummary: null,
    },
    sources: {
      defaults: true,
      heuristicAliases: true,
      aiCompliance: false,
      aiAliases: false,
    },
  };
}

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

  it("preserves unapproved manual compliance fields from AI overwrite", () => {
    const result = mergeGovernedComplianceSuggestions({
      currentForm: { ingredients: "Operator typed recipe" },
      suggestions: { ingredients: "AI draft ingredients" },
      metaMap: {
        ingredients: { source: "manual", approved: false, suggestion_only: false },
      },
    });

    expect(result.merged.ingredients).toBe("Operator typed recipe");
    expect(result.preservedFields).toEqual(["ingredients"]);
    expect(result.appliedFields).toEqual([]);
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

describe("enrichFastCreateWithGovernedAi", () => {
  it("does not mutate caller-owned labelStarter on enrichment", async () => {
    const base = buildBaseSuggestions();
    invokeMock.mockResolvedValue({
      data: {
        suggestion_only: true,
        approved: false,
        disclaimer: "AI suggestion only.",
        suggestions: { ingredients: "AI ingredients", allergen_warnings: "AI allergens" },
      },
      error: null,
    });
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => "pyramid baklawa, cashew pyramid",
    });

    const { suggestions } = await enrichFastCreateWithGovernedAi(
      base,
      "Pyramid Baklawa",
      "baklawa",
    );

    expect(base.labelStarter.ingredients_hint).toBe("base ingredients");
    expect(base.labelStarter.allergen_hint).toBe("base allergens");
    expect(suggestions.labelStarter.ingredients_hint).toBe("AI ingredients");
    expect(suggestions.labelStarter.allergen_hint).toBe("AI allergens");
  });

  it("records degraded provenance when alias fetch times out", async () => {
    const base = buildBaseSuggestions();
    invokeMock.mockResolvedValue({ data: null, error: { message: "offline" } });
    const controller = new AbortController();
    const timeoutDescriptor = Object.getOwnPropertyDescriptor(AbortSignal, "timeout");
    Object.defineProperty(AbortSignal, "timeout", {
      configurable: true,
      value: vi.fn().mockReturnValue(controller.signal),
    });
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        const signal = init?.signal;
        if (!signal) {
          reject(new DOMException("The operation timed out.", "TimeoutError"));
          return;
        }
        const onAbort = () => {
          reject(new DOMException("The operation timed out.", "TimeoutError"));
        };
        if (signal.aborted) {
          onAbort();
          return;
        }
        signal.addEventListener("abort", onAbort, { once: true });
      });
    });

    try {
      const enrichmentPromise = enrichFastCreateWithGovernedAi(base, "Pyramid Baklawa", "baklawa");
      await Promise.resolve();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
      controller.abort();

      const { provenance } = await enrichmentPromise;

      expect(provenance.some((entry) => entry.service === "oasis-ai-chat")).toBe(true);
      expect(
        provenance.some(
          (entry) =>
            entry.service === "oasis-ai-chat" &&
            entry.provider_status === "degraded" &&
            entry.fail_closed === true,
        ),
      ).toBe(true);
    } finally {
      if (timeoutDescriptor) {
        Object.defineProperty(AbortSignal, "timeout", timeoutDescriptor);
      } else {
        Reflect.deleteProperty(AbortSignal, "timeout");
      }
    }
  });

  it("keeps AI aliases pending instead of merging them into persistable aliases", async () => {
    const base = buildBaseSuggestions();
    invokeMock.mockResolvedValue({ data: null, error: { message: "offline" } });
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => "pyramid baklawa, cashew pyramid",
    });

    const { suggestions, provenance } = await enrichFastCreateWithGovernedAi(
      base,
      "Pyramid Baklawa",
      "baklawa",
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      provenance.some(
        (entry) => entry.service === "oasis-ai-chat" && entry.provider_status === "ok",
      ),
    ).toBe(true);
    expect(suggestions.pendingAiAliases?.map((alias) => alias.alias)).toEqual([
      "pyramid baklawa",
      "cashew pyramid",
    ]);
    expect(suggestions.aliases).toEqual(base.aliases);
    expect(suggestions.whatsappKeywords).toEqual(base.whatsappKeywords);
    expect(suggestions.searchKeywords).toEqual(base.searchKeywords);
  });
});

describe("getPersistableFastCreateAliases", () => {
  it("excludes pending AI aliases and derived keywords from persistence", () => {
    const payload = getPersistableFastCreateAliases({
      ...buildBaseSuggestions(),
      aliases: [
        { alias: "heuristic alias", alias_type: "search_term" },
        { alias: "ai alias one", alias_type: "search_term" },
      ],
      pendingAiAliases: [{ alias: "ai alias one", alias_type: "search_term" }],
      whatsappKeywords: ["heuristic", "ai alias one"],
      searchKeywords: ["heuristic alias", "ai alias one"],
      sources: {
        defaults: true,
        heuristicAliases: true,
        aiCompliance: false,
        aiAliases: true,
      },
    });

    expect(payload.aliases.map((alias) => alias.alias)).toEqual(["heuristic alias"]);
    expect(payload.whatsappKeywords).toEqual(["heuristic"]);
    expect(payload.searchKeywords).toEqual(["heuristic alias"]);
  });
});
