/**
 * Label Readiness — deliberately separate from catalogue readiness (buildMeter.ts /
 * computeCatalogueProductReadiness). Catalogue readiness answers "can this appear in the
 * catalogue"; label readiness answers "can this move to label design / packaging print".
 * They must never be merged into one toggle — a product can be catalogue-ready while
 * legally required label data is still missing.
 *
 * Scores identity, quantity, shelf/storage, product-composition text (Point 34), and
 * live legal-label columns (Point 37 recert). Remaining label-grade fields without a live
 * Core column are reported as `dataGaps` with severity "no_column".
 *
 * Live @ Core #Point37 recert (release run `34034910469` @ `9c93fc32`):
 * `fssai_licence_number`, `country_of_origin`, `label_manufacturer_details` — scored via
 * `legal_label_fields` category; persisted through `formToDbProductPayload` compat columns.
 */
import { hasNumericInput, hasText } from "@/features/catalogueAiStudio/catalogueFieldUtils";
import { normalizeNutritionText } from "@/features/productTruth/productFactualCompositionCanonical";
import {
  buildLiveLegalLabelCategory,
  evaluateLiveLegalLabelFields,
} from "./labelComplianceLiveColumns";

export type LabelReadinessState = "pass" | "warn" | "missing";

export interface LabelReadinessCategory {
  key: string;
  label: string;
  state: LabelReadinessState;
  detail: string;
  nextAction: string | null;
}

export type LabelDataGapSeverity = "no_column" | "not_persisted";

export interface LabelDataGap {
  key: string;
  label: string;
  severity: LabelDataGapSeverity;
  note: string;
}

export type LabelOverallStatus = "Draft" | "Needs review" | "Ready for label designer" | "Approved";

export interface LabelReadinessResult {
  categories: LabelReadinessCategory[];
  dataGaps: LabelDataGap[];
  overallStatus: LabelOverallStatus;
  nutritionReviewNotice: string;
}

export interface LabelReadinessProductInput {
  product_name?: string | null;
  category?: string | null;
  /** Full Editor form state binds this to a text input — arrives as a string like "90". */
  shelf_life_days?: number | string | null;
  storage_instructions?: string | null;
  pack_size?: string | null;
  /** Full Editor form state binds this to a text input — arrives as a string like "500". */
  net_weight_g?: number | string | null;
  /** Pieces per retail pack — lets pack declarations read as "6 pcs box · 500g". */
  pcs_per_pack?: number | string | null;
  /** Live Core label-compliance columns (Point 37 recert). */
  fssai_licence_number?: string | null;
  country_of_origin?: string | null;
  label_manufacturer_details?: string | null;
  /** Point 34 factual composition — persisted on products row when approved. */
  ingredients?: string | null;
  allergen_warnings?: string | null;
  nutritional_info?: string | null;
  nutrition_facts?: string | null;
}

const NUTRITION_REVIEW_NOTICE = "Draft nutrition data — requires compliance review.";

function buildIdentity(p: LabelReadinessProductInput): LabelReadinessCategory {
  if (!hasText(p.product_name) || !hasText(p.category)) {
    return {
      key: "identity",
      label: "Product Identity",
      state: "missing",
      detail: "Product name and/or category is blank.",
      nextAction: "Set Product Name and Category.",
    };
  }
  return {
    key: "identity",
    label: "Product Identity",
    state: "pass",
    detail: "Name and category are set.",
    nextAction: null,
  };
}

function buildQuantity(p: LabelReadinessProductInput): LabelReadinessCategory {
  const hasPack = hasText(p.pack_size);
  const hasWeight = hasNumericInput(p.net_weight_g);
  if (!hasPack && !hasWeight) {
    return {
      key: "quantity",
      label: "Quantity / Pack Declaration",
      state: "missing",
      detail: "No pack size or net weight set.",
      nextAction: "Set Pack Size and/or Net Weight.",
    };
  }
  if (!hasPack || !hasWeight) {
    return {
      key: "quantity",
      label: "Quantity / Pack Declaration",
      state: "warn",
      detail: "Only one of Pack Size / Net Weight is set.",
      nextAction: "Set both Pack Size and Net Weight for a complete declaration.",
    };
  }
  const pcs = Number(p.pcs_per_pack);
  const pcsPrefix = Number.isFinite(pcs) && pcs > 0 ? `${pcs} pcs · ` : "";
  return {
    key: "quantity",
    label: "Quantity / Pack Declaration",
    state: "pass",
    detail: `${pcsPrefix}${p.pack_size} · ${p.net_weight_g}g`,
    nextAction: null,
  };
}

function buildShelfStorage(p: LabelReadinessProductInput): LabelReadinessCategory {
  const hasShelf = hasNumericInput(p.shelf_life_days);
  const hasStorage = hasText(p.storage_instructions);
  if (!hasShelf && !hasStorage) {
    return {
      key: "shelf_storage",
      label: "Shelf Life / Storage",
      state: "missing",
      detail: "No shelf life or storage instructions set.",
      nextAction: "Set Shelf Life (days) and Storage Instructions.",
    };
  }
  if (!hasShelf || !hasStorage) {
    return {
      key: "shelf_storage",
      label: "Shelf Life / Storage",
      state: "warn",
      detail: !hasShelf
        ? "Storage is set, Shelf Life is blank."
        : "Shelf life is set, Storage is blank.",
      nextAction: !hasShelf ? "Set Shelf Life (days)." : "Set Storage Instructions.",
    };
  }
  return {
    key: "shelf_storage",
    label: "Shelf Life / Storage",
    state: "pass",
    detail: `${p.shelf_life_days} days · ${p.storage_instructions}`,
    nextAction: null,
  };
}

function buildIngredients(p: LabelReadinessProductInput): LabelReadinessCategory {
  if (!hasText(p.ingredients)) {
    return {
      key: "ingredients",
      label: "Ingredient Declaration",
      state: "missing",
      detail: "No ingredient declaration set.",
      nextAction: "Set Ingredients and approve before save.",
    };
  }
  return {
    key: "ingredients",
    label: "Ingredient Declaration",
    state: "pass",
    detail: "Ingredient text is set.",
    nextAction: null,
  };
}

function buildAllergens(p: LabelReadinessProductInput): LabelReadinessCategory {
  if (!hasText(p.allergen_warnings)) {
    return {
      key: "allergen_warnings",
      label: "Allergen Declaration",
      state: "missing",
      detail: "No allergen warnings set.",
      nextAction: "Set Allergen warnings and approve before save.",
    };
  }
  return {
    key: "allergen_warnings",
    label: "Allergen Declaration",
    state: "pass",
    detail: "Allergen warnings are set.",
    nextAction: null,
  };
}

function buildNutrition(p: LabelReadinessProductInput): LabelReadinessCategory {
  const nutrition = normalizeNutritionText(p);
  if (!nutrition) {
    return {
      key: "nutrition",
      label: "Nutrition Information",
      state: "missing",
      detail: "No nutrition information set.",
      nextAction: "Set Nutrition and approve before save.",
    };
  }
  return {
    key: "nutrition",
    label: "Nutrition Information",
    state: "pass",
    detail: NUTRITION_REVIEW_NOTICE,
    nextAction: null,
  };
}

const DATA_GAPS: LabelDataGap[] = [
  {
    key: "batch_lot_number",
    label: "Batch / Lot Number",
    severity: "no_column",
    note: "No column on products — needs a Supabase Core migration.",
  },
  {
    key: "mfg_best_before_dates",
    label: "Manufacturing / Best Before Dates",
    severity: "no_column",
    note: "No date columns for label purposes — needs a Supabase Core migration.",
  },
  {
    key: "veg_nonveg_indicator",
    label: "Veg / Non-Veg / Vegan Indicator",
    severity: "no_column",
    note: "No column on products — needs a Supabase Core migration.",
  },
  {
    key: "net_quantity_structured",
    label: "Net Quantity (structured, label-grade)",
    severity: "no_column",
    note: "Only free-text pack_size/net_weight_g exist — no discrete net-quantity + unit field for label print.",
  },
  {
    key: "label_mrp",
    label: "MRP (label-grade)",
    severity: "no_column",
    note: "Pricing MRP exists on products/channel rules; discrete label-print MRP field not on products — needs Core migration.",
  },
  {
    key: "serving_size",
    label: "Serving Size",
    severity: "no_column",
    note: "No column on products — needs a Supabase Core migration.",
  },
  {
    key: "claims_flag",
    label: "Marketing Claims Review Flag",
    severity: "no_column",
    note: 'No structured way to flag/approve claims like "organic" or "sugar free" — needs a Supabase Core migration.',
  },
];

export function getLabelDataGaps(): LabelDataGap[] {
  return DATA_GAPS;
}

export function computeLabelReadiness(product: LabelReadinessProductInput): LabelReadinessResult {
  const liveLegalResults = evaluateLiveLegalLabelFields(product);
  const categories = [
    buildIdentity(product),
    buildQuantity(product),
    buildShelfStorage(product),
    buildLiveLegalLabelCategory(liveLegalResults),
    buildIngredients(product),
    buildAllergens(product),
    buildNutrition(product),
  ];

  const dataGaps = getLabelDataGaps();
  const hasMissing = categories.some((c) => c.state === "missing");
  const hasWarn = categories.some((c) => c.state === "warn");

  let overallStatus: LabelOverallStatus;
  if (hasMissing || dataGaps.length > 0) {
    overallStatus = "Draft";
  } else {
    overallStatus = hasWarn ? "Needs review" : "Ready for label designer";
  }

  return {
    categories,
    dataGaps,
    overallStatus,
    nutritionReviewNotice: NUTRITION_REVIEW_NOTICE,
  };
}
