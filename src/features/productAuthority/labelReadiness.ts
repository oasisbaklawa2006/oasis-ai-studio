/**
 * Label Readiness — deliberately separate from catalogue readiness (buildMeter.ts /
 * computeCatalogueProductReadiness). Catalogue readiness answers "can this appear in the
 * catalogue"; label readiness answers "can this move to label design / packaging print".
 * They must never be merged into one toggle — a product can be catalogue-ready while
 * legally required label data is still missing.
 *
 * Only `identity`, `quantity`, and `shelf_storage` are scored from real, actually-persisted
 * product fields. Ingredients, allergen warnings, and nutritional info are deliberately
 * NOT scored as pass/warn/missing here, even though `products.ingredients` /
 * `allergen_warnings` / `nutritional_info` exist as columns — `formToDbProductPayload`
 * (productSchemaAdapter.ts) intentionally excludes them from every save, per its own
 * comment: "Compliance text fields (ingredients, allergens) are UI-only until
 * label/nutrition tables own them." Scoring them as real data would be misleading, since
 * whatever staff types into the Full Editor for these three fields today is never actually
 * saved. They're reported as `dataGaps` with severity "not_persisted", not scored.
 *
 * FSSAI licence number, batch/lot number, mfg/best-before dates, veg/non-veg indicator,
 * structured net quantity, serving size, and manufacturer/marketer/packed-by/country-of-
 * origin/claims fields have no column at all — reported as `dataGaps` with severity
 * "no_column". Both gap severities cap the overall status at "Draft" since a product
 * cannot honestly be "ready for label design" while legally mandatory data has nowhere
 * reliable to live yet.
 */
import { hasNumber, hasText } from "@/features/catalogueAiStudio/catalogueFieldUtils";

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
  shelf_life_days?: number | null;
  storage_instructions?: string | null;
  pack_size?: string | null;
  net_weight_g?: number | null;
  /** Pieces per retail pack — lets pack declarations read as "6 pcs box · 500g". */
  pcs_per_pack?: number | string | null;
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
  return { key: "identity", label: "Product Identity", state: "pass", detail: "Name and category are set.", nextAction: null };
}

function buildQuantity(p: LabelReadinessProductInput): LabelReadinessCategory {
  const hasPack = hasText(p.pack_size);
  const hasWeight = hasNumber(p.net_weight_g);
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
  const hasShelf = hasNumber(p.shelf_life_days);
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
      detail: !hasShelf ? "Storage is set, Shelf Life is blank." : "Shelf life is set, Storage is blank.",
      nextAction: !hasShelf ? "Set Shelf Life (days)." : "Set Storage Instructions.",
    };
  }
  return { key: "shelf_storage", label: "Shelf Life / Storage", state: "pass", detail: `${p.shelf_life_days} days · ${p.storage_instructions}`, nextAction: null };
}

const DATA_GAPS: LabelDataGap[] = [
  {
    key: "ingredients",
    label: "Ingredient Declaration",
    severity: "not_persisted",
    note: "products.ingredients exists but formToDbProductPayload excludes it from every save — UI-only until a label/nutrition table owns it.",
  },
  {
    key: "allergen_warnings",
    label: "Allergen Declaration",
    severity: "not_persisted",
    note: "products.allergen_warnings exists but formToDbProductPayload excludes it from every save — UI-only until a label/nutrition table owns it.",
  },
  {
    key: "nutrition",
    label: "Nutrition Information",
    severity: "not_persisted",
    note: `products.nutritional_info exists but formToDbProductPayload excludes it from every save. ${NUTRITION_REVIEW_NOTICE}`,
  },
  { key: "fssai_licence_number", label: "FSSAI Licence Number", severity: "no_column", note: "No column on products — needs a Supabase Core migration." },
  { key: "batch_lot_number", label: "Batch / Lot Number", severity: "no_column", note: "No column on products — needs a Supabase Core migration." },
  { key: "mfg_best_before_dates", label: "Manufacturing / Best Before Dates", severity: "no_column", note: "No date columns for label purposes — needs a Supabase Core migration." },
  { key: "veg_nonveg_indicator", label: "Veg / Non-Veg / Vegan Indicator", severity: "no_column", note: "No column on products — needs a Supabase Core migration." },
  { key: "net_quantity_structured", label: "Net Quantity (structured, label-grade)", severity: "no_column", note: "Only free-text pack_size/net_weight_g exist — no discrete net-quantity + unit field for label print." },
  { key: "serving_size", label: "Serving Size", severity: "no_column", note: "No column on products — needs a Supabase Core migration." },
  { key: "manufacturer_marketer_details", label: "Manufacturer / Marketer / Packed-by / Imported-by", severity: "no_column", note: "No columns on products — needs a Supabase Core migration." },
  { key: "country_of_origin", label: "Country of Origin", severity: "no_column", note: "No column on products — needs a Supabase Core migration." },
  { key: "claims_flag", label: "Marketing Claims Review Flag", severity: "no_column", note: "No structured way to flag/approve claims like \"organic\" or \"sugar free\" — needs a Supabase Core migration." },
];

export function getLabelDataGaps(): LabelDataGap[] {
  return DATA_GAPS;
}

export function computeLabelReadiness(product: LabelReadinessProductInput): LabelReadinessResult {
  const categories = [buildIdentity(product), buildQuantity(product), buildShelfStorage(product)];

  const hasMissing = categories.some((c) => c.state === "missing");
  const hasWarn = categories.some((c) => c.state === "warn");

  // Ingredients/allergens/nutrition are never truly persisted today, and legally mandatory
  // FSSAI fields have no column at all — this can never honestly reach "Ready for label
  // designer" or "Approved" until that changes. See module docblock.
  let overallStatus: LabelOverallStatus;
  if (hasMissing || DATA_GAPS.length > 0) {
    overallStatus = "Draft";
  } else {
    overallStatus = hasWarn ? "Needs review" : "Ready for label designer";
  }

  return {
    categories,
    dataGaps: DATA_GAPS,
    overallStatus,
    nutritionReviewNotice: NUTRITION_REVIEW_NOTICE,
  };
}
