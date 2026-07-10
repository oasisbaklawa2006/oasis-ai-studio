import { describe, expect, it } from "vitest";
import { computeLabelReadiness, getLabelDataGaps } from "./labelReadiness";

const COMPLETE_INPUT = {
  product_name: "Cashew Pyramid Baklawa",
  category: "Baklawa",
  shelf_life_days: 30,
  storage_instructions: "Store in a cool, dry place.",
  pack_size: "500g box",
  net_weight_g: 500,
};

describe("computeLabelReadiness", () => {
  it("never reaches Ready/Approved while data gaps exist (current schema always has some)", () => {
    const result = computeLabelReadiness(COMPLETE_INPUT);
    expect(result.overallStatus).toBe("Draft");
  });

  it("flags missing product identity", () => {
    const result = computeLabelReadiness({ ...COMPLETE_INPUT, product_name: "" });
    const identity = result.categories.find((c) => c.key === "identity");
    expect(identity?.state).toBe("missing");
  });

  it("flags a partial quantity declaration as warn", () => {
    const result = computeLabelReadiness({ ...COMPLETE_INPUT, net_weight_g: null });
    const quantity = result.categories.find((c) => c.key === "quantity");
    expect(quantity?.state).toBe("warn");
  });

  it("passes shelf/storage when both fields are set", () => {
    const result = computeLabelReadiness(COMPLETE_INPUT);
    const shelf = result.categories.find((c) => c.key === "shelf_storage");
    expect(shelf?.state).toBe("pass");
  });

  it("reports ingredients/allergens/nutrition as not_persisted data gaps, not scored categories", () => {
    const result = computeLabelReadiness(COMPLETE_INPUT);
    expect(result.categories.some((c) => c.key === "ingredients")).toBe(false);
    expect(result.categories.some((c) => c.key === "nutrition")).toBe(false);
    const gapKeys = result.dataGaps.map((g) => g.key);
    expect(gapKeys).toContain("ingredients");
    expect(gapKeys).toContain("allergen_warnings");
    expect(gapKeys).toContain("nutrition");
    for (const key of ["ingredients", "allergen_warnings", "nutrition"]) {
      expect(result.dataGaps.find((g) => g.key === key)?.severity).toBe("not_persisted");
    }
  });

  // Full Editor's `form` state binds net_weight_g/shelf_life_days to <Input> elements,
  // which always yield strings via e.target.value — the exact shape Bugbot flagged as
  // misread by a strict `typeof value === "number"` check (Defect 4 regression).
  describe("string-form numeric inputs, exactly as the real Full Editor form provides them", () => {
    it("scores quantity as pass when net_weight_g arrives as a numeric string", () => {
      const result = computeLabelReadiness({ ...COMPLETE_INPUT, net_weight_g: "500" });
      expect(result.categories.find((c) => c.key === "quantity")?.state).toBe("pass");
    });

    it("scores shelf_storage as pass when shelf_life_days arrives as a numeric string", () => {
      const result = computeLabelReadiness({ ...COMPLETE_INPUT, shelf_life_days: "90" });
      expect(result.categories.find((c) => c.key === "shelf_storage")?.state).toBe("pass");
    });

    it("treats a blank string net_weight_g the same as missing, not present", () => {
      const result = computeLabelReadiness({ ...COMPLETE_INPUT, net_weight_g: "" });
      expect(result.categories.find((c) => c.key === "quantity")?.state).toBe("warn");
    });

    it("treats a \"0\" string shelf_life_days as missing, not a valid zero", () => {
      const result = computeLabelReadiness({ ...COMPLETE_INPUT, shelf_life_days: "0" });
      expect(result.categories.find((c) => c.key === "shelf_storage")?.state).toBe("warn");
    });

    it("treats non-numeric text as missing, not present", () => {
      const result = computeLabelReadiness({ ...COMPLETE_INPUT, net_weight_g: "abc" });
      expect(result.categories.find((c) => c.key === "quantity")?.state).toBe("warn");
    });

    it("tolerates surrounding whitespace in a numeric string", () => {
      const result = computeLabelReadiness({ ...COMPLETE_INPUT, shelf_life_days: " 90 " });
      expect(result.categories.find((c) => c.key === "shelf_storage")?.state).toBe("pass");
    });
  });

  it("reports FSSAI-mandatory fields as no_column data gaps", () => {
    const gaps = getLabelDataGaps();
    const noColumnKeys = gaps.filter((g) => g.severity === "no_column").map((g) => g.key);
    expect(noColumnKeys).toEqual(
      expect.arrayContaining(["fssai_licence_number", "batch_lot_number", "veg_nonveg_indicator", "country_of_origin"]),
    );
  });
});
