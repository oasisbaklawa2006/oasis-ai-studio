import { describe, expect, it } from "vitest";
import { isJsonLikeFragment, sanitizeAiFragments } from "./aiOutputSanitizer";

describe("isJsonLikeFragment", () => {
  it("rejects raw stream JSON artifacts", () => {
    expect(isJsonLikeFragment('"object":"chat.completion.chunk"')).toBe(true);
    expect(isJsonLikeFragment('"model":"google/gemini-2.5-flash"')).toBe(true);
    expect(isJsonLikeFragment('"choices":[{"delta":{"content":"hi"}}]')).toBe(true);
    expect(isJsonLikeFragment("finish_reason")).toBe(true);
    expect(isJsonLikeFragment("{}")).toBe(true);
    expect(isJsonLikeFragment("[1,2,3]")).toBe(true);
  });

  it("accepts normal alias-like text", () => {
    expect(isJsonLikeFragment("Cashew Baklawa")).toBe(false);
    expect(isJsonLikeFragment("wholesale sweets")).toBe(false);
    expect(isJsonLikeFragment("B2B pistachio box")).toBe(false);
  });
});

describe("sanitizeAiFragments", () => {
  it("filters JSON-shaped stream noise out of a mixed candidate list", () => {
    const raw = [
      '{"object":"chat.completion.chunk"',
      '"model":"google/gemini-2.5-flash"',
      "Cashew Baklawa",
      '"choices":[{"delta":{"content":"pistachio"}}]',
      "Pistachio Gift Box",
      "role",
      "usage",
    ];
    expect(sanitizeAiFragments(raw)).toEqual(["Cashew Baklawa", "Pistachio Gift Box"]);
  });

  it("dedupes case-insensitively and caps to the limit", () => {
    const raw = Array.from({ length: 20 }, (_, i) => `Alias ${i % 3}`);
    const result = sanitizeAiFragments(raw, { limit: 2 });
    expect(result.length).toBeLessThanOrEqual(2);
    expect(new Set(result.map((s) => s.toLowerCase())).size).toBe(result.length);
  });

  it("drops fragments outside the length bounds", () => {
    expect(sanitizeAiFragments(["a", "ok alias", "x".repeat(60)])).toEqual(["ok alias"]);
  });
});
