import {
  createManualFieldMeta,
  pickComplianceBaseline,
  type ComplianceBaseline,
  type ComplianceFieldMetaMap,
} from "./complianceApproval";
import {
  PERSISTED_FACTUAL_PRODUCT_COLUMNS,
  UI_ONLY_FACTUAL_FIELDS,
} from "@/features/productTruth/productFactualCompositionCanonical";

/** Columns on `products` that ProductEdit persists on save (Point 34 canonical). */
export const PERSISTED_COMPLIANCE_PRODUCT_COLUMNS = [
  "hsn_code",
  "gst_rate",
  ...PERSISTED_FACTUAL_PRODUCT_COLUMNS.filter(
    (f) => f === "shelf_life_days" || f === "storage_instructions",
  ),
] as const;

export type PersistedComplianceColumn = (typeof PERSISTED_COMPLIANCE_PRODUCT_COLUMNS)[number];

/** Form-only compliance text — not written to `products` until Core ships columns (Point 34). */
export const UI_ONLY_COMPLIANCE_FIELDS = [
  ...UI_ONLY_FACTUAL_FIELDS.filter(
    (f) => f === "ingredients" || f === "allergen_warnings" || f === "nutritional_info",
  ),
] as const;

/**
 * Build session meta from a DB-loaded product row.
 * Persisted columns with values are treated as approved manual edits (saved state).
 * UI-only fields with values remain unapproved until explicitly approved.
 */
export function buildComplianceMetaFromSavedProduct(
  form: Record<string, unknown>,
  baseline?: ComplianceBaseline,
): ComplianceFieldMetaMap {
  const base = baseline ?? pickComplianceBaseline(form);
  const meta: ComplianceFieldMetaMap = {};

  for (const field of PERSISTED_COMPLIANCE_PRODUCT_COLUMNS) {
    const v = base[field];
    if (v !== null && v !== undefined && String(v).trim() !== "") {
      meta[field] = createManualFieldMeta();
    }
  }

  for (const field of UI_ONLY_COMPLIANCE_FIELDS) {
    const v = form[field];
    if (v !== null && v !== undefined && String(v).trim() !== "") {
      meta[field] = { source: "manual", approved: false, suggestion_only: false };
    }
  }

  return meta;
}

/** List/detail readiness: tax compliance is complete when HSN+GST are saved on the product row. */
export function deriveComplianceApprovedForReadiness(form: Record<string, unknown>): boolean {
  const hsn = String(form.hsn_code ?? "").trim();
  const gst = form.gst_rate;
  if (!hsn) return false;
  if (gst === null || gst === undefined || String(gst).trim() === "") return false;
  return true;
}

/** Session approval gate for save — persisted columns only (not UI-only text). */
export function isPersistedComplianceApproved(
  metaMap: ComplianceFieldMetaMap,
  complianceMetaPending: boolean,
): boolean {
  if (complianceMetaPending) return false;
  return PERSISTED_COMPLIANCE_PRODUCT_COLUMNS.every((field) => {
    const meta = metaMap[field];
    if (!meta) return true;
    return !!meta.approved;
  });
}
