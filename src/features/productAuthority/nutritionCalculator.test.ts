import { describe, expect, it } from "vitest";
import { derivePanelForWeight, nutrientPerPiece, nutrientPerServing, type NutritionPanelDraft } from "./nutritionCalculator";

describe("nutrientPerServing", () => {
  it("scales a per-100g value to a serving weight", () => {
    expect(nutrientPerServing(492, 30)).toBe(147.6);
    expect(nutrientPerServing(100, 100)).toBe(100);
  });

  it("returns null for invalid inputs", () => {
    expect(nutrientPerServing(NaN, 30)).toBeNull();
    expect(nutrientPerServing(492, 0)).toBeNull();
    expect(nutrientPerServing(492, -5)).toBeNull();
  });
});

describe("nutrientPerPiece", () => {
  it("is the same scaling as per-serving, applied to a piece weight", () => {
    expect(nutrientPerPiece(492, 20)).toBe(nutrientPerServing(492, 20));
  });
});

describe("derivePanelForWeight", () => {
  const per100g: NutritionPanelDraft = {
    basis: "per_100g",
    servingSizeGrams: null,
    energyKcal: 492,
    proteinG: 7.2,
    carbohydrateG: 54.8,
    totalSugarG: 32.5,
    addedSugarG: 28,
    totalFatG: 27.1,
    saturatedFatG: 11.5,
    transFatG: 0,
    sodiumMg: 42,
    cholesterolMg: 18,
    fibreG: null,
  };

  it("derives a per-serving panel by scaling every scalable field", () => {
    const perServing = derivePanelForWeight(per100g, 30, "per_serving");
    expect(perServing.basis).toBe("per_serving");
    expect(perServing.servingSizeGrams).toBe(30);
    expect(perServing.energyKcal).toBe(nutrientPerServing(492, 30));
    expect(perServing.proteinG).toBe(nutrientPerServing(7.2, 30));
  });

  it("leaves fields that were already null as null", () => {
    const perServing = derivePanelForWeight(per100g, 30, "per_serving");
    expect(perServing.fibreG).toBeNull();
  });

  it("nulls every scalable field when no target weight is available, instead of guessing", () => {
    const perPiece = derivePanelForWeight(per100g, null, "per_piece");
    expect(perPiece.energyKcal).toBeNull();
    expect(perPiece.proteinG).toBeNull();
  });
});
