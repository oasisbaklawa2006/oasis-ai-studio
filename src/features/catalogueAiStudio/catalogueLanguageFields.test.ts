import { describe, expect, it } from "vitest";
import { isLanguageMessagingField, LANGUAGE_MESSAGING_CONTENT_KEYS } from "./catalogueLanguageFields";
import { CATALOGUE_DRAFT_CONTENT_KEYS } from "./catalogueDraftTypes";
import { DRAFT_BLOCK_META } from "./catalogueContentGenerators";
import { computeCatalogueProductReadiness, type ReadinessProductInput } from "./catalogueProductReadiness";

describe("catalogueLanguageFields", () => {
  it("classifies hindi_description and whatsapp_product_message as language/messaging fields", () => {
    expect(isLanguageMessagingField("hindi_description")).toBe(true);
    expect(isLanguageMessagingField("whatsapp_product_message")).toBe(true);
  });

  it("classifies every other content key as general content, not language/messaging", () => {
    const generalKeys = CATALOGUE_DRAFT_CONTENT_KEYS.filter(
      (k) => !LANGUAGE_MESSAGING_CONTENT_KEYS.includes(k),
    );
    expect(generalKeys.length).toBeGreaterThan(0);
    for (const key of generalKeys) {
      expect(isLanguageMessagingField(key)).toBe(false);
    }
  });

  it("every field renders in exactly one tab — the two groups partition DRAFT_BLOCK_META with no overlap and no gaps", () => {
    const allKeys = DRAFT_BLOCK_META.map((b) => b.key);
    const languageKeys = allKeys.filter(isLanguageMessagingField);
    const generalKeys = allKeys.filter((k) => !isLanguageMessagingField(k));
    expect(languageKeys.length + generalKeys.length).toBe(allKeys.length);
    expect(new Set([...languageKeys, ...generalKeys]).size).toBe(allKeys.length);
  });

  it("language/messaging fields are non-blocking — catalogue readiness scoring never reads them", () => {
    const base: ReadinessProductInput = {
      product_name: "Sample Product",
      description: "A sample description",
      sku: "SKU-1",
      category: "Snacks",
      hero_image_url: "https://cdn.example/hero.jpg",
      mrp: 100,
      is_active: true,
    };
    const withoutLanguage = computeCatalogueProductReadiness(base);
    const withLanguage = computeCatalogueProductReadiness({
      ...base,
      // Not part of ReadinessProductInput by design — cast proves readiness ignores them even if present.
      hindi_description: "नमूना विवरण",
      whatsapp_product_message: "Draft WhatsApp text",
    } as ReadinessProductInput);
    expect(withLanguage.score).toBe(withoutLanguage.score);
    expect(withLanguage.overallLabel).toBe(withoutLanguage.overallLabel);
    expect(withLanguage.categories.some((c) => c.key === "hindi_description" || c.key === "whatsapp_product_message")).toBe(false);
  });
});
