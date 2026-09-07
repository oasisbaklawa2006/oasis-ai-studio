/**
 * Point 34 — deterministic ProductEdit save→reload certification (synthetic data only).
 * Models: compliance strip → formToDbProductPayload → db row → dbRowToProductForm.
 */
import { describe, expect, it } from "vitest";
import {
  dbRowToProductForm,
  formToDbProductPayload,
} from "@/features/productAuthority/productSchemaAdapter";
import { factualCompositionSaveValidation } from "@/features/productTruth/productFactualCompositionCanonical";
import { stripUnapprovedComplianceFields } from "@/lib/compliance/aiComplianceSafety";
import {
  type ComplianceFieldMetaMap,
  createAiSuggestionFieldMeta,
  createCategoryRuleFieldMeta,
  createManualFieldMeta,
} from "@/shared/ai/complianceApproval";

const EDITOR_EMPTY: Record<string, unknown> = {
  product_name: "",
  shelf_life_days: "",
  storage_instructions: "",
  frozen_shelf_life_days: "",
  post_processing_shelf_life_days: "",
  temperature_requirement: "",
  thawing_instruction: "",
  ingredients: "",
  allergen_warnings: "",
  nutritional_info: "",
  nutrition_facts: "",
};

const SYNTHETIC_SAVED_ROW = {
  product_name: "Synthetic Baklawa SKU",
  sku: "OAS-AS-BKL-0099-0001",
  main_department: "ready_goods_store",
  production_department: "arabic_sweets",
  shelf_life_days: 90,
  storage_instructions: "Store in a cool, dry place.",
  frozen_shelf_life_days: 180,
  post_processing_shelf_life_days: 30,
  temperature_requirement: "Ambient",
  thawing_instruction: "Thaw at room temperature",
  ingredients: "Cashew, sugar, clarified butter, filo pastry",
  allergen_warnings: "Contains nuts, gluten, dairy",
  nutrition_facts: "Per 100g: energy 450 kcal",
};

function editorSavePayload(
  form: Record<string, unknown>,
  roles: string[],
  baseline: Record<string, unknown>,
  metaMap: ComplianceFieldMetaMap,
): Record<string, unknown> {
  const validation = factualCompositionSaveValidation(form);
  if (!validation.ok) throw new Error(validation.message);
  const safe = stripUnapprovedComplianceFields(form, roles, baseline, metaMap);
  return formToDbProductPayload(safe);
}

function editorReloadForm(dbRow: Record<string, unknown>): Record<string, unknown> {
  return dbRowToProductForm(dbRow, EDITOR_EMPTY);
}

describe("Point34 editor save→reload certification (synthetic)", () => {
  it("round-trips approved composition + shelf/storage through save adapter and reload", () => {
    const baseline = {
      shelf_life_days: "",
      storage_instructions: "",
      ingredients: "",
      allergen_warnings: "",
      nutritional_info: "",
    };

    const editorForm: Record<string, unknown> = {
      ...EDITOR_EMPTY,
      product_name: SYNTHETIC_SAVED_ROW.product_name,
      sku: SYNTHETIC_SAVED_ROW.sku,
      main_department: SYNTHETIC_SAVED_ROW.main_department,
      production_department: SYNTHETIC_SAVED_ROW.production_department,
      shelf_life_days: String(SYNTHETIC_SAVED_ROW.shelf_life_days),
      storage_instructions: SYNTHETIC_SAVED_ROW.storage_instructions,
      frozen_shelf_life_days: String(SYNTHETIC_SAVED_ROW.frozen_shelf_life_days),
      post_processing_shelf_life_days: String(SYNTHETIC_SAVED_ROW.post_processing_shelf_life_days),
      temperature_requirement: SYNTHETIC_SAVED_ROW.temperature_requirement,
      thawing_instruction: SYNTHETIC_SAVED_ROW.thawing_instruction,
      ingredients: SYNTHETIC_SAVED_ROW.ingredients,
      allergen_warnings: SYNTHETIC_SAVED_ROW.allergen_warnings,
      nutritional_info: SYNTHETIC_SAVED_ROW.nutrition_facts,
    };

    const metaMap: ComplianceFieldMetaMap = {
      shelf_life_days: createManualFieldMeta(),
      storage_instructions: createManualFieldMeta(),
      ingredients: createManualFieldMeta(),
      allergen_warnings: createManualFieldMeta(),
      nutritional_info: createManualFieldMeta(),
    };

    const savedRow = editorSavePayload(editorForm, ["owner"], baseline, metaMap);
    expect(savedRow.ingredients).toBe(SYNTHETIC_SAVED_ROW.ingredients);
    expect(savedRow.allergen_warnings).toBe(SYNTHETIC_SAVED_ROW.allergen_warnings);
    expect(savedRow.nutrition_facts).toBe(SYNTHETIC_SAVED_ROW.nutrition_facts);
    expect(savedRow.shelf_life_days).toBe(90);
    expect(savedRow.storage_instructions).toBe(SYNTHETIC_SAVED_ROW.storage_instructions);

    const reloaded = editorReloadForm(savedRow);
    expect(reloaded.ingredients).toBe(SYNTHETIC_SAVED_ROW.ingredients);
    expect(reloaded.allergen_warnings).toBe(SYNTHETIC_SAVED_ROW.allergen_warnings);
    expect(reloaded.nutritional_info).toBe(SYNTHETIC_SAVED_ROW.nutrition_facts);
    expect(reloaded.shelf_life_days).toBe("90");
    expect(reloaded.storage_instructions).toBe(SYNTHETIC_SAVED_ROW.storage_instructions);
    expect(reloaded.frozen_shelf_life_days).toBe("180");
    expect(reloaded.post_processing_shelf_life_days).toBe("30");
  });

  it("does not persist unapproved AI composition suggestions (reverts to baseline)", () => {
    const baseline = {
      ingredients: "Approved baseline recipe",
      allergen_warnings: "Contains nuts",
      nutritional_info: "",
      shelf_life_days: "60",
      storage_instructions: "Keep cool",
    };

    const editorForm: Record<string, unknown> = {
      ...EDITOR_EMPTY,
      product_name: "Synthetic Product",
      sku: "OAS-AS-BKL-0001-0001",
      main_department: "ready_goods_store",
      production_department: "arabic_sweets",
      ingredients: "AI invented recipe — must not save",
      allergen_warnings: "AI invented allergens",
      nutritional_info: "AI invented nutrition",
      shelf_life_days: "999",
      storage_instructions: "AI invented storage",
    };

    const metaMap: ComplianceFieldMetaMap = {
      ingredients: createAiSuggestionFieldMeta(),
      allergen_warnings: createAiSuggestionFieldMeta(),
      nutritional_info: createAiSuggestionFieldMeta(),
      shelf_life_days: createAiSuggestionFieldMeta(),
      storage_instructions: createAiSuggestionFieldMeta(),
    };

    const savedRow = editorSavePayload(editorForm, ["catalogue_contributor"], baseline, metaMap);
    expect(savedRow.ingredients).toBe("Approved baseline recipe");
    expect(savedRow.allergen_warnings).toBe("Contains nuts");
    expect(savedRow.nutrition_facts).toBeNull();
    expect(savedRow.shelf_life_days).toBe(60);
    expect(savedRow.storage_instructions).toBe("Keep cool");
  });

  it("does not persist category-rule shelf/storage defaults without approval", () => {
    const baseline = {
      shelf_life_days: "",
      storage_instructions: "",
    };

    const editorForm: Record<string, unknown> = {
      ...EDITOR_EMPTY,
      product_name: "Fast Create Handoff",
      sku: "OAS-AS-BKL-0002-0001",
      main_department: "ready_goods_store",
      production_department: "arabic_sweets",
      shelf_life_days: "90",
      storage_instructions: "Store in a cool, dry place away from direct sunlight.",
    };

    const metaMap: ComplianceFieldMetaMap = {
      shelf_life_days: createCategoryRuleFieldMeta(),
      storage_instructions: createCategoryRuleFieldMeta(),
    };

    const savedRow = editorSavePayload(editorForm, ["catalogue_contributor"], baseline, metaMap);
    expect(savedRow.shelf_life_days).toBeNull();
    expect(savedRow.storage_instructions).toBeNull();

    const reloaded = editorReloadForm({
      product_name: "Fast Create Handoff",
      sku: "OAS-AS-BKL-0002-0001",
      shelf_life_days: null,
      storage_instructions: null,
    });
    expect(reloaded.shelf_life_days).toBe("");
    expect(reloaded.storage_instructions).toBe("");
  });

  it("keeps unknown composition fields empty on reload when DB row has no values", () => {
    const reloaded = editorReloadForm({
      product_name: "Empty Composition SKU",
      sku: "OAS-AS-BKL-0003-0001",
      shelf_life_days: null,
      storage_instructions: null,
      ingredients: null,
      allergen_warnings: null,
      nutrition_facts: null,
    });

    expect(reloaded.ingredients).toBe("");
    expect(reloaded.allergen_warnings).toBe("");
    expect(reloaded.nutritional_info).toBe("");
    expect(reloaded.shelf_life_days).toBe("");
    expect(reloaded.storage_instructions).toBe("");
  });

  it("blocks invalid shelf-life from reaching products payload (save-path regression)", () => {
    const editorForm: Record<string, unknown> = {
      ...EDITOR_EMPTY,
      product_name: "Invalid Shelf Life SKU",
      sku: "OAS-AS-BKL-0099-0002",
      main_department: "ready_goods_store",
      production_department: "arabic_sweets",
      shelf_life_days: "-5",
      frozen_shelf_life_days: "2.5",
      post_processing_shelf_life_days: "0",
    };

    expect(() => editorSavePayload(editorForm, ["owner"], {}, {})).toThrow(/shelf_life_days/);
    expect(() => editorSavePayload(editorForm, ["owner"], {}, {})).toThrow(
      /frozen_shelf_life_days/,
    );
    expect(() => editorSavePayload(editorForm, ["owner"], {}, {})).toThrow(
      /post_processing_shelf_life_days/,
    );
  });

  it("does not persist unapproved extended factual fields (frozen shelf, temperature, thawing)", () => {
    const baseline = {
      frozen_shelf_life_days: "120",
      post_processing_shelf_life_days: "",
      temperature_requirement: "Ambient baseline",
      thawing_instruction: "",
    };

    const editorForm: Record<string, unknown> = {
      ...EDITOR_EMPTY,
      product_name: "Extended Factual Fields",
      sku: "OAS-AS-BKL-0099-0003",
      main_department: "ready_goods_store",
      production_department: "arabic_sweets",
      frozen_shelf_life_days: "999",
      post_processing_shelf_life_days: "45",
      temperature_requirement: "AI invented temp",
      thawing_instruction: "AI invented thaw",
    };

    const metaMap: ComplianceFieldMetaMap = {
      frozen_shelf_life_days: createAiSuggestionFieldMeta(),
      post_processing_shelf_life_days: createAiSuggestionFieldMeta(),
      temperature_requirement: createAiSuggestionFieldMeta(),
      thawing_instruction: createAiSuggestionFieldMeta(),
    };

    const savedRow = editorSavePayload(editorForm, ["catalogue_contributor"], baseline, metaMap);
    expect(savedRow.frozen_shelf_life_days).toBe(120);
    expect(savedRow.post_processing_shelf_life_days).toBeNull();
    expect(savedRow.temperature_requirement).toBe("Ambient baseline");
    expect(savedRow.thawing_instruction).toBeNull();
  });
});
