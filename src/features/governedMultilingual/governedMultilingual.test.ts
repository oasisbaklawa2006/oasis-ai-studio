import { describe, expect, it } from "vitest";
import { GOVERNED_NAMING_PROMPT_VERSION } from "@/features/governedProductNaming";
import {
  buildHeuristicMultilingualSuggestions,
  detectWrongLanguagePresentation,
  governedAliasSeedsFromSource,
  PENDING_HINDI_DESCRIPTION_MARKER,
  PENDING_SELLING_POINT_MARKER,
  resolveLocale,
  resolveSellingPointForLocale,
  resolveTemplateHindiDescription,
  serializeMultilingualSuggestions,
  validateGovernedHindiDescription,
  validateMultilingualSource,
  validateMultilingualText,
  validateProviderMultilingualEnvelope,
} from "./governedMultilingualContract";
import { mockMultilingualProvider } from "./governedMultilingualProvider";
import type { AuthoritativeMultilingualSource } from "./types";

const BASE_SOURCE: AuthoritativeMultilingualSource = {
  product_name: "Cashew Pyramid Baklawa",
  category: "Baklawa",
  product_type: "Arabic sweets",
  pack_size: "500g",
  source_version: GOVERNED_NAMING_PROMPT_VERSION,
  approved_short_description: "Layered filo with cashew filling.",
};

describe("validateMultilingualSource", () => {
  it("fails closed without source_version pin", () => {
    const result = validateMultilingualSource({
      product_name: "Test",
      source_version: "",
    });
    expect(result.ok).toBe(false);
  });

  it("accepts Point48 identity with pinned source version", () => {
    expect(validateMultilingualSource(BASE_SOURCE).ok).toBe(true);
  });
});

describe("resolveLocale", () => {
  it("resolves supported locales", () => {
    expect(resolveLocale("hi").availability).toBe("available");
    expect(resolveLocale("ar").locale).toBe("ar");
  });

  it("fails closed on unsupported locale", () => {
    const result = resolveLocale("fr");
    expect(result.locale).toBe("unsupported");
    expect(result.availability).toBe("unsupported");
  });
});

describe("detectWrongLanguagePresentation", () => {
  it("flags Latin-only text presented as Hindi description", () => {
    expect(
      detectWrongLanguagePresentation(
        "Cashew Pyramid Baklawa is available now.",
        "hi",
        BASE_SOURCE,
        "hindi_description",
      ),
    ).toContain("Devanagari");
  });

  it("flags embedded English product_name in Hindi description copy", () => {
    expect(
      detectWrongLanguagePresentation(
        "Cashew Pyramid Baklawa — समीक्षा के लिए ड्राफ्ट।",
        "hi",
        BASE_SOURCE,
        "hindi_description",
      ),
    ).toContain("product_name");
  });

  it("allows explicit pending marker for Hindi description", () => {
    expect(
      detectWrongLanguagePresentation(PENDING_HINDI_DESCRIPTION_MARKER, "hi", BASE_SOURCE, "hindi_description"),
    ).toBeNull();
  });

  it("allows Devanagari Hindi copy", () => {
    expect(
      detectWrongLanguagePresentation("काजू पिरामिड बकलावा उपलब्ध है।", "hi", BASE_SOURCE, "hindi_description"),
    ).toBeNull();
  });
});

describe("resolveTemplateHindiDescription", () => {
  it("returns pending marker when no approved Hindi source exists", () => {
    const row = resolveTemplateHindiDescription(BASE_SOURCE);
    expect(row.availability).toBe("pending");
    expect(row.value).toBe(PENDING_HINDI_DESCRIPTION_MARKER);
    expect(row.review_status).toBe("pending_review");
    expect(row.source_version).toBe(GOVERNED_NAMING_PROMPT_VERSION);
  });

  it("uses approved Hindi source when provided", () => {
    const row = resolveTemplateHindiDescription({
      ...BASE_SOURCE,
      approved_hindi_description: "काजू पिरामिड बकलावा उपलब्ध है।",
    });
    expect(row.availability).toBe("available");
    expect(row.value).toContain("काजू");
  });
});

describe("resolveSellingPointForLocale", () => {
  it("grounds English selling point in approved short description", () => {
    const row = resolveSellingPointForLocale(BASE_SOURCE, "en");
    expect(row.value).toBe("Layered filo with cashew filling.");
    expect(row.availability).toBe("available");
  });

  it("marks non-English selling points pending without approved locale copy", () => {
    const row = resolveSellingPointForLocale(BASE_SOURCE, "hi");
    expect(row.availability).toBe("pending");
    expect(row.value).toBe(PENDING_SELLING_POINT_MARKER);
  });
});

describe("buildHeuristicMultilingualSuggestions", () => {
  it("returns review-only suggestions with provenance and source version", () => {
    const result = buildHeuristicMultilingualSuggestions(BASE_SOURCE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.suggestion_only).toBe(true);
    expect(result.approved).toBe(false);
    expect(result.human_review_required).toBe(true);
    expect(result.provenance.source_version).toBe(GOVERNED_NAMING_PROMPT_VERSION);
    expect(result.provenance.source_identity).toContain("cashew pyramid");
    expect(result.suggestions.some((s) => s.locale === "ar" && s.script === "arabic")).toBe(true);
    expect(result.suggestions.some((s) => s.kind === "hindi_description")).toBe(true);
  });

  it("fails closed on unsupported requested locale", () => {
    const result = buildHeuristicMultilingualSuggestions(BASE_SOURCE, ["fr" as "hi"]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("not in the governed support matrix");
    expect(result.provenance.fail_closed).toBe(true);
  });
});

describe("governedAliasSeedsFromSource", () => {
  it("maps governed suggestions to alias seeds without auto-publish", () => {
    const result = governedAliasSeedsFromSource(BASE_SOURCE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.aliases.length).toBeGreaterThan(0);
    expect(result.aliases.some((a) => a.language === "hi")).toBe(true);
    expect(result.provenance.service).toBe("heuristic");
  });
});

describe("validateMultilingualText", () => {
  it("rejects unsafe superlative claims in translated copy", () => {
    const result = validateMultilingualText("सर्वश्रेष्ठ बकलावा", "hi", BASE_SOURCE, "hindi_description");
    expect(result.ok).toBe(false);
  });
});

describe("validateGovernedHindiDescription", () => {
  it("prefers approved Hindi source over provider text", () => {
    const result = validateGovernedHindiDescription("English fallback", {
      ...BASE_SOURCE,
      approved_hindi_description: "काजू पिरामिड बकलावा।",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain("काजू");
  });
});

describe("validateProviderMultilingualEnvelope", () => {
  it("requires review markers and source_version", () => {
    expect(
      validateProviderMultilingualEnvelope({
        ok: true,
        human_review_required: true,
        suggestion_only: true,
        approved: false,
        source_version: GOVERNED_NAMING_PROMPT_VERSION,
      }).ok,
    ).toBe(true);

    expect(
      validateProviderMultilingualEnvelope({
        ok: true,
        human_review_required: false,
        suggestion_only: true,
        approved: false,
        source_version: GOVERNED_NAMING_PROMPT_VERSION,
      }).ok,
    ).toBe(false);
  });
});

describe("serializeMultilingualSuggestions", () => {
  it("serializes review state and source version for every suggestion", () => {
    const result = buildHeuristicMultilingualSuggestions(BASE_SOURCE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const serialized = serializeMultilingualSuggestions(result.suggestions);
    const parsed = JSON.parse(serialized) as Array<Record<string, unknown>>;
    expect(parsed.length).toBeGreaterThan(0);
    for (const row of parsed) {
      expect(row.review_status).toBe("pending_review");
      expect(row.source_version).toBe(GOVERNED_NAMING_PROMPT_VERSION);
      expect(row.suggestion_only).toBe(true);
      expect(row.approved).toBe(false);
    }
  });
});

describe("mockMultilingualProvider", () => {
  it("returns ok scenario with deterministic Hindi draft", () => {
    const { parseResult } = mockMultilingualProvider(BASE_SOURCE, "ok");
    expect(parseResult.ok).toBe(true);
  });

  it("fails on missing review marker", () => {
    const { parseResult } = mockMultilingualProvider(BASE_SOURCE, "missing_review_marker");
    expect(parseResult.ok).toBe(false);
  });

  it("fails on wrong-language Hindi presentation", () => {
    const { parseResult } = mockMultilingualProvider(BASE_SOURCE, "wrong_language_hindi");
    expect(parseResult.ok).toBe(false);
    if (parseResult.ok) return;
    expect(parseResult.reason).toContain("Devanagari");
  });

  it("fails on unsafe superlative in Hindi copy", () => {
    const { parseResult } = mockMultilingualProvider(BASE_SOURCE, "unsafe_superlative");
    expect(parseResult.ok).toBe(false);
  });

  it("fails on unsupported locale", () => {
    const { parseResult } = mockMultilingualProvider(BASE_SOURCE, "unsupported_locale");
    expect(parseResult.ok).toBe(false);
    if (parseResult.ok) return;
    expect(parseResult.reason).toContain("fr");
  });
});
