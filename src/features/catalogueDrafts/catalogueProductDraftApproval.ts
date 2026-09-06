/**
 * Contributor product draft → Central approval mapping contract (AI Studio).
 * Preserves Point 37 live legal-label columns through grouped draft payloads and
 * both create/update approval paths. No Core schema mutation — mapping only.
 */
import {
  evaluateLiveLegalLabelFields,
  POINT_37_LIVE_PRODUCT_COLUMNS,
  type Point37LiveProductColumn,
} from "@/features/productAuthority/labelComplianceLiveColumns";

export const POINT37_LIVE_LEGAL_COMPLIANCE_DRAFT_KEYS = POINT_37_LIVE_PRODUCT_COLUMNS;

export type ProductDraftApprovalOperation = "create" | "update";

export type LiveLegalLabelDraftFields = Partial<Record<Point37LiveProductColumn, string | null>>;

export type ApprovedDraftLegalLabelValidation = {
  fields: LiveLegalLabelDraftFields;
  ready: boolean;
  publicationBlockers: string[];
};

function nestedRead(payload: Record<string, unknown>, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (acc, key) =>
        acc != null && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined,
      payload,
    );
}

/** Fail-closed: only string values pass; null stays null; malformed types become null. */
export function normalizeDraftLegalLabelFieldValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

/** Merge live legal-label columns from a product save payload into draft compliance. */
export function appendLiveLegalFieldsToContributorCompliance(
  compliance: Record<string, unknown>,
  productPayload: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...compliance,
    fssai_licence_number: normalizeDraftLegalLabelFieldValue(productPayload.fssai_licence_number),
    country_of_origin: normalizeDraftLegalLabelFieldValue(productPayload.country_of_origin),
    label_manufacturer_details: normalizeDraftLegalLabelFieldValue(
      productPayload.label_manufacturer_details,
    ),
  };
}

/** Read live legal-label fields from a grouped contributor draft payload. */
export function extractLiveLegalLabelFieldsFromDraftPayload(
  payload: Record<string, unknown>,
): LiveLegalLabelDraftFields {
  const fields: LiveLegalLabelDraftFields = {};
  for (const field of POINT37_LIVE_LEGAL_COMPLIANCE_DRAFT_KEYS) {
    const value = nestedRead(payload, `compliance.${field}`);
    if (value !== undefined) {
      fields[field] = normalizeDraftLegalLabelFieldValue(value);
    }
  }
  return fields;
}

/**
 * Maps approved contributor draft payload to product-row legal-label columns.
 * Create and update paths share the same compliance extraction — lossless round-trip.
 */
export function mapApprovedProductDraftLegalLabelFields(
  payload: Record<string, unknown>,
  operation: ProductDraftApprovalOperation,
): LiveLegalLabelDraftFields {
  void operation;
  return extractLiveLegalLabelFieldsFromDraftPayload(payload);
}

/** Fail-closed approval validation — malformed/non-string draft values block publication. */
export function validateApprovedDraftLegalLabelFields(
  payload: Record<string, unknown>,
  operation: ProductDraftApprovalOperation,
): ApprovedDraftLegalLabelValidation {
  const fields = mapApprovedProductDraftLegalLabelFields(payload, operation);
  const results = evaluateLiveLegalLabelFields(fields);
  const publicationBlockers = results.flatMap((result) => result.publicationBlockers);
  return {
    fields,
    ready: publicationBlockers.length === 0,
    publicationBlockers,
  };
}
