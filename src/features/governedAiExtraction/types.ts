import type { ComplianceFieldMetaMap } from "@/shared/ai/complianceApproval";
import type { ComplianceSensitiveField } from "@/shared/ai/complianceConstants";

/** Confidence band for AI-derived field suggestions (aligned with Point 29 intake contract). */
export type GovernedAiConfidence = "high" | "medium" | "low" | "unresolved";

export type GovernedAiProviderStatus = "ok" | "degraded" | "failed";

export type GovernedAiService = "generate-product-attributes" | "oasis-ai-chat" | "heuristic";

export type GovernedAiFieldSuggestion = {
  field: ComplianceSensitiveField | "alias";
  value: string;
  confidence: GovernedAiConfidence;
  source: GovernedAiService;
  suggestion_only: true;
  approved: false;
};

export type GovernedAiProvenance = {
  service: GovernedAiService;
  provider_status: GovernedAiProviderStatus;
  used_heuristic_fallback: boolean;
  fail_closed: boolean;
  uncertainty_reason?: string;
  invoked_at: string;
};

export type GovernedComplianceExtraction = {
  suggestion_only: true;
  approved: false;
  disclaimer: string;
  suggestions: GovernedAiFieldSuggestion[];
  provenance: GovernedAiProvenance;
  complianceFieldMeta: ComplianceFieldMetaMap;
};

export type GovernedFieldMergeResult = {
  merged: Record<string, unknown>;
  appliedFields: ComplianceSensitiveField[];
  preservedFields: ComplianceSensitiveField[];
  complianceFieldMeta: ComplianceFieldMetaMap;
};
