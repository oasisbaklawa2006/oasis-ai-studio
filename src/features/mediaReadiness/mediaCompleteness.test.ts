import { describe, expect, it } from "vitest";
import { evaluateCatalogueMediaCompleteness, mediaKindFromRowType, requiredMediaKinds } from "./mediaCompleteness";

describe("requiredMediaKinds", () => {
  it("catalogue-visible retail products require more than hero", () => {
    expect(requiredMediaKinds("retail_ready_pack")).toEqual(["hero", "square", "closeup", "packaging"]);
  });

  it("internal products require no catalogue media", () => {
    expect(requiredMediaKinds("internal_bom")).toEqual([]);
  });
});

describe("evaluateCatalogueMediaCompleteness", () => {
  it("is NOT complete when only a hero image exists for a retail pack", () => {
    const result = evaluateCatalogueMediaCompleteness("retail_ready_pack", [
      { type: "hero", file_url: "https://x/hero.jpg" },
    ]);
    expect(result.complete).toBe(false);
    expect(result.missingKinds).toEqual(["square", "closeup", "packaging"]);
  });

  it("is complete when all required kinds are present", () => {
    const result = evaluateCatalogueMediaCompleteness("retail_ready_pack", [
      { type: "hero", file_url: "https://x/1.jpg" },
      { type: "square", file_url: "https://x/2.jpg" },
      { type: "close-up", file_url: "https://x/3.jpg" },
      { type: "packaging", file_url: "https://x/4.jpg" },
    ]);
    expect(result.complete).toBe(true);
  });

  it("counts a fallback hero URL as hero presence", () => {
    const result = evaluateCatalogueMediaCompleteness("b2b_horeca", [], { fallbackHeroUrl: "https://x/h.jpg" });
    expect(result.complete).toBe(true);
  });

  it("ignores rows without a file URL", () => {
    const result = evaluateCatalogueMediaCompleteness("b2b_horeca", [{ type: "hero", file_url: "" }]);
    expect(result.complete).toBe(false);
  });
});

describe("mediaKindFromRowType", () => {
  it("maps synonyms onto kinds", () => {
    expect(mediaKindFromRowType("main")).toBe("hero");
    expect(mediaKindFromRowType("close_up")).toBe("closeup");
    expect(mediaKindFromRowType("catalog")).toBe("square");
    expect(mediaKindFromRowType("unknown-type")).toBeNull();
  });
});
