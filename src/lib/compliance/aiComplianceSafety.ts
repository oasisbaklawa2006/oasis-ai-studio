/**
 * Sprint 1 — type-safe AI compliance safety helpers (re-export + aliases).
 * AI may suggest; only authorized roles may approve compliance-sensitive catalogue truth.
 */

import {
  type ComplianceBaseline,
  type ComplianceFieldMetaMap,
  canApproveComplianceFields,
  prepareFormForComplianceSave,
  stripComplianceFromDraftPayload,
} from "@/shared/ai/complianceApproval";
import {
  AI_COMPLIANCE_LEGAL_DISCLAIMER,
  AI_COMPLIANCE_UI_DISCLAIMER,
  COMPLIANCE_APPROVER_ROLES,
  COMPLIANCE_SENSITIVE_FIELDS,
  type ComplianceSensitiveField,
} from "@/shared/ai/complianceConstants";
import {
  type AiComplianceResponse,
  type AiComplianceSuggestionPayload,
  buildAiComplianceResponse,
} from "@/shared/ai/complianceSuggestions";

export {
  type AiComplianceResponse,
  COMPLIANCE_SENSITIVE_FIELDS,
  type ComplianceBaseline,
  type ComplianceFieldMetaMap,
  type ComplianceSensitiveField,
};

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
