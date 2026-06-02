import {
  COMPLIANCE_APPROVER_ROLES,
  COMPLIANCE_SENSITIVE_FIELDS,
  type ComplianceSensitiveField,
} from "./complianceConstants";

export type ComplianceFieldMeta = {
  source: "manual" | "ai_suggestion";
  approved: boolean;
  suggestion_only?: boolean;
  approved_at?: string;
  approved_by_role?: string;
};

export type ComplianceFieldMetaMap = Partial<Record<ComplianceSensitiveField, ComplianceFieldMeta>>;

export type ComplianceBaseline = Partial<Record<ComplianceSensitiveField, unknown>>;

export function canApproveComplianceFields(roles: string[]): boolean {
  return roles.some((r) => (COMPLIANCE_APPROVER_ROLES as readonly string[]).includes(r));
}

export function canGenerateComplianceSuggestions(_roles: string[]): boolean {
  return true;
}

export function createManualFieldMeta(): ComplianceFieldMeta {
  return { source: "manual", approved: true };
}

export function createAiSuggestionFieldMeta(): ComplianceFieldMeta {
  return { source: "ai_suggestion", approved: false, suggestion_only: true };
}

export function approveComplianceFieldMeta(
  meta: ComplianceFieldMeta | undefined,
  role: string,
): ComplianceFieldMeta {
  return {
    source: meta?.source ?? "manual",
    approved: true,
    suggestion_only: false,
    approved_at: new Date().toISOString(),
    approved_by_role: role,
  };
}

export function isComplianceFieldApproved(
  field: ComplianceSensitiveField,
  metaMap: ComplianceFieldMetaMap | undefined,
  roles: string[],
): boolean {
  const meta = metaMap?.[field];
  if (!meta) return true;
  if (meta.source === "manual" && meta.approved) return true;
  if (meta.source === "ai_suggestion" && meta.approved) return true;
  if (canApproveComplianceFields(roles) && meta.approved) return true;
  return false;
}

/**
 * Removes or restores compliance-sensitive values that are not approved for save.
 */
export function prepareFormForComplianceSave<T extends Record<string, unknown>>(
  form: T,
  roles: string[],
  baseline: ComplianceBaseline,
  metaMap: ComplianceFieldMetaMap | undefined,
): T {
  const out = { ...form } as T & Record<string, unknown>;

  for (const field of COMPLIANCE_SENSITIVE_FIELDS) {
    if (isComplianceFieldApproved(field, metaMap, roles)) continue;
    const baselineValue = baseline[field];
    (out as Record<string, unknown>)[field] =
      baselineValue === undefined ? null : baselineValue;
  }

  return out as T;
}

export function stripComplianceFromDraftPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const next = { ...payload };
  const pricing = { ...(next.pricing as Record<string, unknown> | undefined) };
  const compliance = { ...(next.compliance as Record<string, unknown> | undefined) };

  if (pricing) {
    delete pricing.hsn;
    delete pricing.gst_rate;
    next.pricing = pricing;
  }

  if (compliance) {
    for (const key of [
      "ingredients",
      "allergen_information",
      "nutritional_information",
      "shelf_life_days",
      "storage_instructions",
    ]) {
      delete compliance[key];
    }
    compliance.ai_suggestion_only = true;
    compliance.requires_manual_approval = true;
    next.compliance = compliance;
  }

  return next;
}

export function pickComplianceBaseline(form: Record<string, unknown>): ComplianceBaseline {
  const baseline: ComplianceBaseline = {};
  for (const field of COMPLIANCE_SENSITIVE_FIELDS) {
    if (form[field] !== undefined) baseline[field] = form[field];
  }
  return baseline;
}
