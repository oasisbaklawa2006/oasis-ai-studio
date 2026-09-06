import { describe, expect, it } from "vitest";
import { applyCreationBaselineDefaults } from "@/features/productDefaults/applyDefaults";
import { seedAliasesFromName } from "@/features/productLanguage/aliasSeedRules";
import { buildHeuristicSuggestions } from "./fastCreateSuggestions";

describe("fastCreateSuggestions", () => {
  it("applies category defaults and heuristic aliases", () => {
    const result = buildHeuristicSuggestions("Cashew Pyramid Baklawa", "baklawa");
    expect(result.formPatch.hsn_code).toBe("19059090");
    expect(result.formPatch.gst_rate).toBe("18");
    expect(result.formPatch.main_department).toBe("ready_goods_store");
    expect(result.formPatch.production_department).toBe("arabic_sweets");
    expect(result.aliases.length).toBeGreaterThan(0);
    expect(result.whatsappKeywords.length).toBeGreaterThan(0);
    expect(result.sources.defaults).toBe(true);
  });

  it("builds description from product name without ungoverned marketing filler", () => {
    const result = buildHeuristicSuggestions("Premium Dates Box", "dates_chocolate");
    expect(String(result.formPatch.description)).toContain("Premium Dates Box");
    expect(String(result.formPatch.description).toLowerCase()).not.toContain(
      "crafted with quality ingredients",
    );
    expect(String(result.formPatch.short_description).toLowerCase()).not.toContain("signature");
    expect(result.namingProvenance?.service).toBe("heuristic");
    expect(result.namingProvenance?.fail_closed).toBe(false);
    expect(result.multilingualProvenance?.service).toBe("heuristic");
    expect(result.multilingualProvenance?.source_version).toBeTruthy();
  });
});

describe("applyCreationBaselineDefaults", () => {
  it("fills empty compliance defaults", () => {
    const out = applyCreationBaselineDefaults({ product_name: "Test" });
    expect(out.hsn_code).toBe("19059090");
    expect(out.gst_rate).toBe("18");
    expect(out.shelf_life_days).toBe("90");
  });
});

describe("aliasSeedRules", () => {
  it("seeds pyramid baklawa aliases", () => {
    const aliases = seedAliasesFromName("Cashew Pyramid Baklawa");
    expect(aliases.some((a) => /pyramid/i.test(a.alias))).toBe(true);
  });
});
