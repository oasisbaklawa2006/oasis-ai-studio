/**
 * Sprint 1 — type-safe AI compliance safety helpers (re-export + aliases).
 * AI may suggest; only authorized roles may approve compliance-sensitive catalogue truth.
 */
import {
  AI_COMPLIANCE_LEGAL_DISCLAIMER,
  AI_COMPLIANCE_UI_DISCLAIMER,
  COMPLIANCE_APPROVER_ROLES,
  COMPLIANCE_SENSITIVE_FIELDS,
  type ComplianceSensitiveField,
} from "@/shared/ai/complianceConstants";
import {
  canApproveComplianceFields,
  prepareFormForComplianceSave,
  stripComplianceFromDraftPayload,
  type ComplianceBaseline,
  type ComplianceFieldMetaMap,
} from "@/shared/ai/complianceApproval";
import {
  buildAiComplianceResponse,
  type AiComplianceResponse,
  type AiComplianceSuggestionPayload,
} from "@/shared/ai/complianceSuggestions";

export {
  AI_COMPLIANCE_LEGAL_DISCLAIMER,
  AI_COMPLIANCE_UI_DISCLAIMER,
  COMPLIANCE_APPROVER_ROLES,
  COMPLIANCE_SENSITIVE_FIELDS,
  type ComplianceSensitiveField,
  type ComplianceFieldMetaMap,
  type ComplianceBaseline,
  type AiComplianceResponse,
};

export const COMPLIANCE_SENSITIVE_FIELD_LIST: readonly ComplianceSensitiveField[] =
  COMPLIANCE_SENSITIVE_FIELDS;

export function buildSuggestionPayload(
  suggestions: AiComplianceSuggestionPayload,
): AiComplianceResponse {
  return buildAiComplianceResponse(suggestions);
}

export function stripUnapprovedComplianceFields<T extends Record<string, unknown>>(
  form: T,
  roles: string[],
  baseline: ComplianceBaseline,
  metaMap: ComplianceFieldMetaMap | undefined,
): T {
  return prepareFormForComplianceSave(form, roles, baseline, metaMap);
}

export function canApproveComplianceFieldsFromRoles(roles: string[]): boolean {
  return canApproveComplianceFields(roles);
}

export { stripComplianceFromDraftPayload, prepareFormForComplianceSave };
