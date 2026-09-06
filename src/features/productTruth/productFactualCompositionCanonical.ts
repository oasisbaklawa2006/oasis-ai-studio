/**
 * Point 34 — ingredients / allergens / shelf-life / storage canonical closure.
 * Factual product composition fields only — Point 37 owns FSSAI label issuance.
 */

export type FactualPersistence =
  | "products_row"
  | "structured_table"
  | "form_only"
  | "core_blocked"
  | "pdf_import_only";

export type FactualReviewState = "known" | "deferred" | "unknown";

export type FactualFieldKey =
  | "shelf_life_days"
  | "frozen_shelf_life_days"
  | "post_processing_shelf_life_days"
  | "storage_instructions"
  | "temperature_requirement"
  | "thawing_instruction"
  | "ingredients"
  | "allergen_warnings"
  | "nutritional_info"
  | "nutrition_facts"
  | "pdf_shelf_life"
  | "pdf_storage_condition";

export type FactualFieldSpec = {
  key: FactualFieldKey;
  label: string;
  unit: string | null;
  persistence: FactualPersistence;
  reviewRequired: boolean;
  /** Core column or structured table target when persistence is not form_only. */
  authorityTarget: string;
};

export const POINT_34_CORE_DEPENDENCIES = {
  productTextCompliance: [
    "products.ingredients",
    "products.allergen_warnings",
    "products.nutrition_facts (Central compat) OR products.nutritional_info",
  ],
  structuredIngredients: ["ingredients master + product_ingredients junction"],
  nutritionPanels: ["nutrition_panels per product_id"],
} as const;

export const FACTUAL_FIELD_REGISTRY: ReadonlyArray<FactualFieldSpec> = [
  {
    key: "shelf_life_days",
    label: "Shelf life",
    unit: "days",
    persistence: "products_row",
    reviewRequired: true,
    authorityTarget: "products.shelf_life_days",
  },
  {
    key: "frozen_shelf_life_days",
    label: "Frozen shelf life",
    unit: "days",
    persistence: "products_row",
    reviewRequired: true,
    authorityTarget: "products.frozen_shelf_life_days",
  },
  {
    key: "post_processing_shelf_life_days",
    label: "Post-processing shelf life",
    unit: "days",
    persistence: "products_row",
    reviewRequired: true,
    authorityTarget: "products.post_processing_shelf_life_days",
  },
  {
    key: "storage_instructions",
    label: "Storage instructions",
    unit: null,
    persistence: "products_row",
    reviewRequired: true,
    authorityTarget: "products.storage_instructions",
  },
  {
    key: "temperature_requirement",
    label: "Temperature requirement",
    unit: null,
    persistence: "products_row",
    reviewRequired: true,
    authorityTarget: "products.temperature_requirement",
  },
  {
    key: "thawing_instruction",
    label: "Thawing instruction",
    unit: null,
    persistence: "products_row",
    reviewRequired: true,
    authorityTarget: "products.thawing_instruction",
  },
  {
    key: "ingredients",
    label: "Ingredients",
    unit: null,
    persistence: "core_blocked",
    reviewRequired: true,
    authorityTarget: "products.ingredients OR product_ingredients + ingredients",
  },
  {
    key: "allergen_warnings",
    label: "Allergen warnings",
    unit: null,
    persistence: "core_blocked",
    reviewRequired: true,
    authorityTarget: "products.allergen_warnings OR ingredients.allergen_group",
  },
  {
    key: "nutritional_info",
    label: "Nutrition information (text)",
    unit: null,
    persistence: "core_blocked",
    reviewRequired: true,
    authorityTarget: "products.nutritional_info OR nutrition_panels",
  },
  {
    key: "nutrition_facts",
    label: "Nutrition facts (Central compat)",
    unit: null,
    persistence: "core_blocked",
    reviewRequired: true,
    authorityTarget: "products.nutrition_facts",
  },
  {
    key: "pdf_shelf_life",
    label: "PDF shelf life",
    unit: null,
    persistence: "pdf_import_only",
    reviewRequired: true,
    authorityTarget: "products.pdf_shelf_life",
  },
  {
    key: "pdf_storage_condition",
    label: "PDF storage condition",
    unit: null,
    persistence: "pdf_import_only",
    reviewRequired: true,
    authorityTarget: "products.pdf_storage_condition",
  },
];

export const PERSISTED_FACTUAL_PRODUCT_COLUMNS = FACTUAL_FIELD_REGISTRY.filter(
  (f) => f.persistence === "products_row",
).map((f) => f.key) as Array<
  | "shelf_life_days"
  | "frozen_shelf_life_days"
  | "post_processing_shelf_life_days"
  | "storage_instructions"
  | "temperature_requirement"
  | "thawing_instruction"
>;

export const UI_ONLY_FACTUAL_FIELDS = FACTUAL_FIELD_REGISTRY.filter(
  (f) => f.persistence === "core_blocked" || f.persistence === "form_only",
).map((f) => f.key);

function hasText(v: unknown): boolean {
  return v != null && String(v).trim().length > 0;
}

function positiveInt(v: unknown): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && Number.isInteger(n) ? n : null;
}

function toNum(v: unknown): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  return s || null;
}

/** Canonical nutrition text — nutritional_info wins; nutrition_facts is Central compat alias. */
export function normalizeNutritionText(form: Record<string, unknown>): string | null {
  const primary = str(form.nutritional_info);
  if (primary) return primary;
  return str(form.nutrition_facts);
}

export type FactualFieldState = {
  key: FactualFieldKey;
  persistence: FactualPersistence;
  reviewState: FactualReviewState;
  value: string | number | null;
  present: boolean;
};

export type CanonicalFactualComposition = {
  fields: FactualFieldState[];
  validation: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
  coreDependencies: string[];
  point37LabelAuthority: true;
};

export function resolveFactualFieldState(
  key: FactualFieldKey,
  form: Record<string, unknown>,
): FactualFieldState {
  const spec = FACTUAL_FIELD_REGISTRY.find((f) => f.key === key)!;
  let value: string | number | null = null;
  let present = false;

  if (key === "nutritional_info" || key === "nutrition_facts") {
    const normalized = normalizeNutritionText(form);
    value = normalized;
    present = normalized != null;
  } else if (key.endsWith("_days")) {
    const n = positiveInt(form[key]);
    value = n;
    present = n != null;
  } else {
    const s = str(form[key]);
    value = s;
    present = s != null;
  }

  let reviewState: FactualReviewState = "unknown";
  if (!present) {
    reviewState = "unknown";
  } else if (spec.persistence === "core_blocked" || spec.persistence === "form_only") {
    reviewState = "deferred";
  } else {
    reviewState = "known";
  }

  return {
    key,
    persistence: spec.persistence,
    reviewState,
    value,
    present,
  };
}

export function buildCanonicalFactualComposition(
  form: Record<string, unknown>,
): CanonicalFactualComposition {
  const fields = FACTUAL_FIELD_REGISTRY.map((spec) => resolveFactualFieldState(spec.key, form));
  const errors: string[] = [];
  const warnings: string[] = [];

  const shelf = positiveInt(form.shelf_life_days);
  const frozen = positiveInt(form.frozen_shelf_life_days);
  const post = positiveInt(form.post_processing_shelf_life_days);

  if (form.shelf_life_days !== "" && form.shelf_life_days != null && shelf == null) {
    errors.push("shelf_life_days must be a positive whole number of days");
  }
  if (
    form.frozen_shelf_life_days !== "" &&
    form.frozen_shelf_life_days != null &&
    frozen == null
  ) {
    errors.push("frozen_shelf_life_days must be a positive whole number of days");
  }
  if (
    form.post_processing_shelf_life_days !== "" &&
    form.post_processing_shelf_life_days != null &&
    post == null
  ) {
    errors.push("post_processing_shelf_life_days must be a positive whole number of days");
  }

  if (hasText(form.nutritional_info) && hasText(form.nutrition_facts)) {
    const info = String(form.nutritional_info).trim();
    const facts = String(form.nutrition_facts).trim();
    if (info !== facts) {
      warnings.push(
        "nutritional_info and nutrition_facts conflict — nutritional_info is canonical on read",
      );
    }
  }

  if (hasText(form.ingredients) && !hasText(form.allergen_warnings)) {
    warnings.push("ingredients present without allergen_warnings — allergen safety review required");
  }

  const coreDependencies = [
    ...POINT_34_CORE_DEPENDENCIES.productTextCompliance,
    ...POINT_34_CORE_DEPENDENCIES.structuredIngredients,
    ...POINT_34_CORE_DEPENDENCIES.nutritionPanels,
  ];

  return {
    fields,
    validation: { valid: errors.length === 0, errors, warnings },
    coreDependencies,
    point37LabelAuthority: true,
  };
}

/** UI form → persisted products-row factual fields (Point 34 owned columns only). */
export function factualCompositionToDbPayload(
  form: Record<string, unknown>,
): Record<string, unknown> {
  return {
    shelf_life_days: toNum(form.shelf_life_days),
    frozen_shelf_life_days: toNum(form.frozen_shelf_life_days),
    post_processing_shelf_life_days: toNum(form.post_processing_shelf_life_days),
    storage_instructions: form.storage_instructions ?? null,
    temperature_requirement: form.temperature_requirement ?? null,
    thawing_instruction: form.thawing_instruction ?? null,
  };
}

/** DB row → UI factual composition fields (includes form-only reads when present on row). */
export function factualCompositionFromDbRow(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const nutrition = normalizeNutritionText({
    nutritional_info: data.nutritional_info,
    nutrition_facts: data.nutrition_facts,
  });

  return {
    shelf_life_days: data.shelf_life_days ?? "",
    frozen_shelf_life_days: data.frozen_shelf_life_days ?? "",
    post_processing_shelf_life_days: data.post_processing_shelf_life_days ?? "",
    storage_instructions: data.storage_instructions ?? "",
    temperature_requirement: data.temperature_requirement ?? "",
    thawing_instruction: data.thawing_instruction ?? "",
    ingredients: data.ingredients ?? "",
    allergen_warnings: data.allergen_warnings ?? "",
    nutritional_info: nutrition ?? "",
    nutrition_facts: data.nutrition_facts ?? "",
  };
}

/** Contributor draft / snapshot compliance block — never invent placeholders. */
export function factualCompositionDraftPayload(form: Record<string, unknown>): {
  ingredients: string | null;
  allergen_information: string | null;
  nutritional_information: string | null;
  shelf_life_days: string | number | null;
  storage_instructions: string | null;
} {
  return {
    ingredients: str(form.ingredients),
    allergen_information: str(form.allergen_warnings),
    nutritional_information: normalizeNutritionText(form),
    shelf_life_days: form.shelf_life_days ?? null,
    storage_instructions: str(form.storage_instructions),
  };
}

export type SnapshotFactualComposition = {
  schema: "point34_v1";
  fields: Array<{
    key: FactualFieldKey;
    persistence: FactualPersistence;
    review_state: FactualReviewState;
    value: string | number | null;
    unit: string | null;
  }>;
  validation: CanonicalFactualComposition["validation"];
  core_dependencies: string[];
  nutrition_canonical_field: "nutritional_info";
  point37_label_authority: true;
};

export function serializeFactualCompositionForSnapshot(
  form: Record<string, unknown>,
): SnapshotFactualComposition {
  const canonical = buildCanonicalFactualComposition(form);

  return {
    schema: "point34_v1",
    fields: canonical.fields.map((f) => {
      const spec = FACTUAL_FIELD_REGISTRY.find((s) => s.key === f.key)!;
      return {
        key: f.key,
        persistence: f.persistence,
        review_state: f.reviewState,
        value: f.value,
        unit: spec.unit,
      };
    }),
    validation: canonical.validation,
    core_dependencies: [...canonical.coreDependencies],
    nutrition_canonical_field: "nutritional_info",
    point37_label_authority: true,
  };
}

/** Category-rule prefeed meta for shelf/storage — deferred until explicit human approval. */
export const CATEGORY_RULE_DEFERRED_FACTUAL_FIELDS: ReadonlyArray<FactualFieldKey> = [
  "shelf_life_days",
  "storage_instructions",
];
