/**
 * Point 37 post-production recert — live Core `products` label-compliance columns.
 * Core release run `34034910469` @ `9c93fc32` landed:
 * - products.fssai_licence_number
 * - products.country_of_origin
 * - products.label_manufacturer_details
 *
 * AI Studio binds via CENTRAL_COMPAT_PRODUCT_COLUMNS until generated types regen.
 * No local schema migration or shadow authority.
 */
import type { LabelReadinessCategory } from "./labelReadiness";

export const POINT_37_LIVE_PRODUCT_COLUMNS = [
  "fssai_licence_number",
  "country_of_origin",
  "label_manufacturer_details",
] as const;

export type Point37LiveProductColumn = (typeof POINT_37_LIVE_PRODUCT_COLUMNS)[number];

/** Columns still blocked on Core — not the recert live trio. */
export const POINT_37_REMAINING_CORE_DEPENDENCIES = {
  batchLot: ["products.batch_lot_number"],
  vegIndicator: ["products.veg_nonveg_indicator"],
  structuredNetQuantity: ["products.net_quantity_structured (label-grade)"],
  labelMrp: ["products.label_mrp (label-grade)"],
} as const;

export type LiveLegalLabelFieldState = "pass" | "missing" | "invalid";

export type LiveLegalLabelFieldResult = {
  field: Point37LiveProductColumn;
  label: string;
  state: LiveLegalLabelFieldState;
  value: string | null;
  publicationBlockers: string[];
};

export type LiveLegalLabelFieldsInput = {
  fssai_licence_number?: string | null;
  country_of_origin?: string | null;
  label_manufacturer_details?: string | null;
};

const FIELD_LABELS: Record<Point37LiveProductColumn, string> = {
  fssai_licence_number: "FSSAI Licence Number",
  country_of_origin: "Country of Origin",
  label_manufacturer_details: "Label Manufacturer Details",
};

const PLACEHOLDER_VALUES = new Set(["tbd", "n/a", "na", "pending", "unknown", "-"]);

function normalizedValue(value: unknown): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function isInvalidPlaceholder(value: string): boolean {
  return PLACEHOLDER_VALUES.has(value.toLowerCase());
}

function evaluateField(field: Point37LiveProductColumn, value: unknown): LiveLegalLabelFieldResult {
  const normalized = normalizedValue(value);
  if (!normalized) {
    return {
      field,
      label: FIELD_LABELS[field],
      state: "missing",
      value: null,
      publicationBlockers: [`${FIELD_LABELS[field]} missing`],
    };
  }
  if (isInvalidPlaceholder(normalized)) {
    return {
      field,
      label: FIELD_LABELS[field],
      state: "invalid",
      value: normalized,
      publicationBlockers: [`${FIELD_LABELS[field]} invalid — placeholder not accepted`],
    };
  }
  return {
    field,
    label: FIELD_LABELS[field],
    state: "pass",
    value: normalized,
    publicationBlockers: [],
  };
}

/** Fail-closed evaluation for the three live Core label-compliance columns. */
export function evaluateLiveLegalLabelFields(
  input: LiveLegalLabelFieldsInput,
): LiveLegalLabelFieldResult[] {
  return POINT_37_LIVE_PRODUCT_COLUMNS.map((field) => evaluateField(field, input[field]));
}

export function liveLegalLabelFieldsFromForm(
  form: Record<string, unknown>,
): LiveLegalLabelFieldsInput {
  return {
    fssai_licence_number: form.fssai_licence_number as string | null | undefined,
    country_of_origin: form.country_of_origin as string | null | undefined,
    label_manufacturer_details: form.label_manufacturer_details as string | null | undefined,
  };
}

export function buildLiveLegalLabelCategory(
  results: LiveLegalLabelFieldResult[],
): LabelReadinessCategory {
  const missing = results.filter((r) => r.state === "missing");
  const invalid = results.filter((r) => r.state === "invalid");
  if (missing.length === results.length) {
    return {
      key: "legal_label_fields",
      label: "Legal Label Fields (live)",
      state: "missing",
      detail: "FSSAI licence, country of origin, and manufacturer details are all blank.",
      nextAction: "Set FSSAI licence, country of origin, and label manufacturer details.",
    };
  }
  if (missing.length > 0 || invalid.length > 0) {
    const parts = [
      ...missing.map((r) => `${r.label} missing`),
      ...invalid.map((r) => `${r.label} invalid`),
    ];
    return {
      key: "legal_label_fields",
      label: "Legal Label Fields (live)",
      state: "warn",
      detail: parts.join("; "),
      nextAction: "Complete all live legal label fields with non-placeholder values.",
    };
  }
  return {
    key: "legal_label_fields",
    label: "Legal Label Fields (live)",
    state: "pass",
    detail: "FSSAI licence, country of origin, and manufacturer details are set.",
    nextAction: null,
  };
}
