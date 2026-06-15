import {
  createManualFieldMeta,
  pickComplianceBaseline,
  type ComplianceBaseline,
  type ComplianceFieldMetaMap,
} from "./complianceApproval";

/** Columns on `products` that ProductEdit persists on save. */
export const PERSISTED_COMPLIANCE_PRODUCT_COLUMNS = [
  "hsn_code",
  "gst_rate",
  "shelf_life_days",
  "storage_instructions",
] as const;

export type PersistedComplianceColumn = (typeof PERSISTED_COMPLIANCE_PRODUCT_COLUMNS)[number];

/** Form-only compliance text — not written to `products` until structured tables are wired. */
export const UI_ONLY_COMPLIANCE_FIELDS = [
  "ingredients",
  "allergen_warnings",
  "nutritional_info",
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
