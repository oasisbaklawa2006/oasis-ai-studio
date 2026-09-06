import { describe, expect, it } from "vitest";
import {
  buildCanonicalFactualComposition,
  factualCompositionDraftPayload,
  factualCompositionFromDbRow,
  factualCompositionToDbPayload,
  normalizeNutritionText,
  PERSISTED_FACTUAL_PRODUCT_COLUMNS,
  serializeFactualCompositionForSnapshot,
} from "./productFactualCompositionCanonical";

describe("productFactualCompositionCanonical", () => {
  it("maps persisted shelf/storage fields round-trip through adapter helpers", () => {
    const form = {
      shelf_life_days: "90",
      storage_instructions: "Store in a cool, dry place.",
      frozen_shelf_life_days: "180",
      post_processing_shelf_life_days: "30",
      temperature_requirement: "Ambient",
      thawing_instruction: "Thaw at room temperature",
    };

    const payload = factualCompositionToDbPayload(form);
    expect(payload.shelf_life_days).toBe(90);
    expect(payload.storage_instructions).toBe("Store in a cool, dry place.");
    expect(payload.frozen_shelf_life_days).toBe(180);
    expect(payload.post_processing_shelf_life_days).toBe(30);

    const loaded = factualCompositionFromDbRow(payload);
    expect(loaded.shelf_life_days).toBe(90);
    expect(loaded.storage_instructions).toBe("Store in a cool, dry place.");
  });

  it("keeps unknown/deferred state for core-blocked ingredients/allergens/nutrition", () => {
    const canonical = buildCanonicalFactualComposition({
      shelf_life_days: 90,
      storage_instructions: "Cool dry place",
      ingredients: "Cashew, sugar",
      allergen_warnings: "Contains nuts",
      nutritional_info: "Per 100g draft",
    });

    const ingredients = canonical.fields.find((f) => f.key === "ingredients");
    const allergens = canonical.fields.find((f) => f.key === "allergen_warnings");
    const nutrition = canonical.fields.find((f) => f.key === "nutritional_info");

    expect(ingredients?.reviewState).toBe("deferred");
    expect(ingredients?.persistence).toBe("core_blocked");
    expect(allergens?.reviewState).toBe("deferred");
    expect(nutrition?.reviewState).toBe("deferred");
    expect(canonical.coreDependencies.length).toBeGreaterThan(0);
  });

  it("normalizes nutritional_info over nutrition_facts when both exist", () => {
    expect(
      normalizeNutritionText({
        nutritional_info: "Per 100g: energy 450 kcal",
        nutrition_facts: "Legacy facts text",
      }),
    ).toBe("Per 100g: energy 450 kcal");

    expect(
      normalizeNutritionText({
        nutrition_facts: "Legacy only",
      }),
    ).toBe("Legacy only");
  });

  it("warns on conflicting nutrition sources", () => {
    const canonical = buildCanonicalFactualComposition({
      nutritional_info: "Info A",
      nutrition_facts: "Info B",
    });
    expect(canonical.validation.warnings.some((w) => w.includes("conflict"))).toBe(true);
  });

  it("warns when ingredients exist without allergen warnings", () => {
    const canonical = buildCanonicalFactualComposition({
      ingredients: "Cashew, sugar, butter",
    });
    expect(canonical.validation.warnings.some((w) => w.includes("allergen"))).toBe(true);
  });

  it("rejects non-positive shelf-life units", () => {
    const canonical = buildCanonicalFactualComposition({
      shelf_life_days: "0",
      frozen_shelf_life_days: -5,
    });
    expect(canonical.validation.valid).toBe(false);
    expect(canonical.validation.errors.length).toBeGreaterThan(0);
  });

  it("never invents draft payload placeholders for missing allergens/nutrition", () => {
    const draft = factualCompositionDraftPayload({
      shelf_life_days: 90,
      storage_instructions: "Cool dry place",
    });
    expect(draft.ingredients).toBeNull();
    expect(draft.allergen_information).toBeNull();
    expect(draft.nutritional_information).toBeNull();
    expect(draft.shelf_life_days).toBe(90);
  });

  it("serializes point34_v1 snapshot block with review states", () => {
    const snap = serializeFactualCompositionForSnapshot({
      shelf_life_days: 60,
      storage_instructions: "Refrigerate",
      ingredients: "Draft only",
    });
    expect(snap.schema).toBe("point34_v1");
    expect(snap.nutrition_canonical_field).toBe("nutritional_info");
    expect(snap.point37_label_authority).toBe(true);
    const ing = snap.fields.find((f) => f.key === "ingredients");
    expect(ing?.review_state).toBe("deferred");
    expect(ing?.persistence).toBe("core_blocked");
  });

  it("documents all persisted product columns in registry", () => {
    expect(PERSISTED_FACTUAL_PRODUCT_COLUMNS).toContain("shelf_life_days");
    expect(PERSISTED_FACTUAL_PRODUCT_COLUMNS).toContain("storage_instructions");
    expect(PERSISTED_FACTUAL_PRODUCT_COLUMNS).not.toContain("ingredients");
  });
});
