import { describe, expect, it } from "vitest";
import {
  buildCatalogueContentPrompt,
  extractJsonObject,
  mapCatalogueAiTone,
  parseChatCompletionStreamText,
  validateAiCatalogueContent,
} from "./catalogueAiGateway";
import { CATALOGUE_DRAFT_CONTENT_KEYS } from "./catalogueDraftTypes";

describe("buildCatalogueContentPrompt", () => {
  it("includes every given fact and the full expected key list", () => {
    const prompt = buildCatalogueContentPrompt({
      productName: "Pineapple Dragees",
      category: "Confectionery",
      packSize: "500g",
    });
    expect(prompt).toContain("Pineapple Dragees");
    expect(prompt).toContain("Confectionery");
    for (const key of CATALOGUE_DRAFT_CONTENT_KEYS) {
      expect(prompt).toContain(key);
    }
  });

  it("never leaks a compliance instruction that could be mistaken for a fact to restate", () => {
    const prompt = buildCatalogueContentPrompt({ productName: "Test Product" });
    expect(prompt.toLowerCase()).toContain("do not invent");
    expect(prompt.toLowerCase()).toContain("allergens");
  });

  it("marks unset optional facts explicitly rather than omitting them silently", () => {
    const prompt = buildCatalogueContentPrompt({ productName: "Test Product" });
    expect(prompt).toContain("(not set)");
  });

  it("defaults to an Informational tone and honours an explicit tone override", () => {
    const defaultPrompt = buildCatalogueContentPrompt({ productName: "Test Product" });
    expect(defaultPrompt).toContain("Informational tone");
    const premiumPrompt = buildCatalogueContentPrompt({ productName: "Test Product" }, "Premium");
    expect(premiumPrompt).toContain("Premium tone");
  });
});

describe("mapCatalogueAiTone", () => {
  it("maps UI labels to the bounded backend tone contract", () => {
    expect(mapCatalogueAiTone("Premium")).toBe("premium");
    expect(mapCatalogueAiTone("Sales-focused")).toBe("premium");
    expect(mapCatalogueAiTone("Informational")).toBe("warm");
    expect(mapCatalogueAiTone("Concise")).toBe("concise");
    expect(mapCatalogueAiTone("Technical")).toBe("concise");
  });
});

describe("parseChatCompletionStreamText", () => {
  it("assembles content from real streamed chat-completion chunks", () => {
    const raw = [
      'data: {"object":"chat.completion.chunk","choices":[{"delta":{"content":"Hello"}}]}',
      'data: {"object":"chat.completion.chunk","choices":[{"delta":{"content":" world"}}]}',
      "data: [DONE]",
    ].join("\n");
    expect(parseChatCompletionStreamText(raw)).toBe("Hello world");
  });

  it("skips malformed chunk lines instead of aborting the whole response", () => {
    const raw = [
      'data: {"object":"chat.completion.chunk","choices":[{"delta":{"content":"Good"}}]}',
      "data: {not valid json",
      'data: {"object":"chat.completion.chunk","choices":[{"delta":{"content":" part"}}]}',
    ].join("\n");
    expect(parseChatCompletionStreamText(raw)).toBe("Good part");
  });

  it("falls back to the raw text when there are no data: lines at all", () => {
    expect(parseChatCompletionStreamText('{"catalogue_title":"X"}')).toBe(
      '{"catalogue_title":"X"}',
    );
  });
});

describe("extractJsonObject", () => {
  it("parses a plain JSON object", () => {
    expect(extractJsonObject('{"a":"b"}')).toEqual({ a: "b" });
  });

  it("strips markdown code fences", () => {
    expect(extractJsonObject('```json\n{"a":"b"}\n```')).toEqual({ a: "b" });
  });

  it("returns null for text with no JSON object, rather than throwing", () => {
    expect(extractJsonObject("no json here")).toBeNull();
    expect(extractJsonObject("")).toBeNull();
  });

  it("extracts the object even with leading/trailing prose", () => {
    expect(extractJsonObject('Sure, here it is: {"a":"b"} — hope that helps!')).toEqual({ a: "b" });
  });
});

describe("validateAiCatalogueContent", () => {
  const validPayload = Object.fromEntries(
    CATALOGUE_DRAFT_CONTENT_KEYS.map((k) => [k, `value for ${k}`]),
  );

  it("accepts a payload with every required key as a non-empty string", () => {
    const result = validateAiCatalogueContent(validPayload);
    expect(result.ok).toBe(true);
    if (result.ok) {
      for (const key of CATALOGUE_DRAFT_CONTENT_KEYS) {
        expect(result.content[key]).toBe(`value for ${key}`);
      }
    }
  });

  it("rejects a non-object payload", () => {
    expect(validateAiCatalogueContent(null).ok).toBe(false);
    expect(validateAiCatalogueContent("a string").ok).toBe(false);
    expect(validateAiCatalogueContent(["array"]).ok).toBe(false);
  });

  it("rejects a payload missing a required key, naming it in the reason", () => {
    const { catalogue_title, ...rest } = validPayload;
    const result = validateAiCatalogueContent(rest);
    expect(result.ok).toBe(false);
    if (result.ok === false) expect(result.reason).toContain("catalogue_title");
  });

  it("rejects a payload where a required key is an empty or non-string value", () => {
    const result = validateAiCatalogueContent({ ...validPayload, short_description: "" });
    expect(result.ok).toBe(false);
    const result2 = validateAiCatalogueContent({ ...validPayload, short_description: 123 });
    expect(result2.ok).toBe(false);
  });
});
