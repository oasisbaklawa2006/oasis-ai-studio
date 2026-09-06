import { PERSISTED_FACTUAL_PRODUCT_COLUMNS } from "@/features/productTruth/productFactualCompositionCanonical";
import {
  type ComplianceBaseline,
  type ComplianceFieldMetaMap,
  createManualFieldMeta,
  pickComplianceBaseline,
} from "./complianceApproval";

const FACTUAL_COMPLIANCE_FORM_KEYS = PERSISTED_FACTUAL_PRODUCT_COLUMNS.filter(
  (key) => key !== "nutrition_facts",
);

/** Columns on `products` that ProductEdit persists on save (Point 34 canonical, approval-gated). */
export const PERSISTED_COMPLIANCE_PRODUCT_COLUMNS = [
  "hsn_code",
  "gst_rate",
  ...FACTUAL_COMPLIANCE_FORM_KEYS,
] as const;

export type PersistedComplianceColumn = (typeof PERSISTED_COMPLIANCE_PRODUCT_COLUMNS)[number];

/** DB column alias — UI edits `nutritional_info`, writes `nutrition_facts`. */
export const UI_ONLY_COMPLIANCE_FIELDS = ["nutrition_facts"] as const;

/**
 * Build session meta from a DB-loaded product row.
 * Persisted columns with values are treated as approved manual edits (saved state).
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

/** Session approval gate for save — all persisted compliance columns require approval when meta exists. */
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
