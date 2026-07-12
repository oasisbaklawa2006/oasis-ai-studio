import { describe, expect, it } from "vitest";
import { composeCatalogueImagePrompt } from "./catalogueContentGenerators";

describe("composeCatalogueImagePrompt", () => {
  it("returns the governed per-slot template unchanged when no instruction is given", () => {
    const result = composeCatalogueImagePrompt({ product_name: "Pineapple Dragees" }, "hero_image_prompt");
    expect(result).toContain("Pineapple Dragees");
    expect(result).not.toContain("Additional instruction");
  });

  it("appends a trimmed operator instruction as a clearly labeled addendum", () => {
    const result = composeCatalogueImagePrompt(
      { product_name: "Pineapple Dragees" },
      "hero_image_prompt",
      "  darker background  ",
    );
    expect(result).toContain("Additional instruction: darker background");
  });

  it("ignores a blank/whitespace-only instruction", () => {
    const withoutInstruction = composeCatalogueImagePrompt({ product_name: "Pineapple Dragees" }, "hero_image_prompt");
    const withBlankInstruction = composeCatalogueImagePrompt(
      { product_name: "Pineapple Dragees" },
      "hero_image_prompt",
      "   ",
    );
    expect(withBlankInstruction).toBe(withoutInstruction);
  });

  it(
    "never appends an instruction to a missing-field placeholder — there is nothing real to " +
      "attach it to yet",
    () => {
      const result = composeCatalogueImagePrompt({}, "hero_image_prompt", "darker background");
      expect(result).toContain("Add missing field first");
      expect(result).not.toContain("Additional instruction");
    },
  );

  it("dispatches to the correct per-slot template for every image prompt key", () => {
    const product = { product_name: "Pineapple Dragees", category: "Confectionery" };
    expect(composeCatalogueImagePrompt(product, "square_image_prompt")).toContain("Square 1:1 crop");
    expect(composeCatalogueImagePrompt(product, "closeup_image_prompt")).toContain("Macro close-up");
    expect(composeCatalogueImagePrompt(product, "packaging_image_prompt")).toContain("packaging shot");
    expect(composeCatalogueImagePrompt(product, "lifestyle_image_prompt")).toContain("Lifestyle serving-suggestion");
  });
});
