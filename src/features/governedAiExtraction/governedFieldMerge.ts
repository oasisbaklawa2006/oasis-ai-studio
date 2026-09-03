import {
  type ComplianceFieldMeta,
  type ComplianceFieldMetaMap,
  createAiSuggestionFieldMeta,
} from "@/shared/ai/complianceApproval";
import type { ComplianceSensitiveField } from "@/shared/ai/complianceConstants";

function hasCanonicalValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  return String(value).trim().length > 0;
}

function isLockedCanonicalField(
  field: ComplianceSensitiveField,
  currentValue: unknown,
  metaMap: ComplianceFieldMetaMap | undefined,
): boolean {
  const meta = metaMap?.[field];
  if (meta?.approved) return true;
  if (meta?.source === "manual" && meta.approved !== false) return true;
  if (!meta && hasCanonicalValue(currentValue)) return true;
  return false;
}

export type MergeGovernedComplianceOptions = {
  currentForm: Record<string, unknown>;
  suggestions: Partial<Record<ComplianceSensitiveField, string | null | undefined>>;
  metaMap?: ComplianceFieldMetaMap;
};

/**
 * Merge AI compliance suggestions into a form without overwriting canonical Product Master
 * facts. Locked fields (approved manual values, or any pre-existing non-empty value without
 * ai_suggestion meta) are preserved.
 */
export function mergeGovernedComplianceSuggestions(options: MergeGovernedComplianceOptions): {
  merged: Record<string, unknown>;
  appliedFields: ComplianceSensitiveField[];
  preservedFields: ComplianceSensitiveField[];
  complianceFieldMeta: ComplianceFieldMetaMap;
} {
  const { currentForm, suggestions, metaMap } = options;
  const merged = { ...currentForm };
  const nextMeta: ComplianceFieldMetaMap = { ...(metaMap ?? {}) };
  const appliedFields: ComplianceSensitiveField[] = [];
  const preservedFields: ComplianceSensitiveField[] = [];

  for (const [field, rawValue] of Object.entries(suggestions) as Array<
    [ComplianceSensitiveField, string | null | undefined]
  >) {
    if (rawValue == null || String(rawValue).trim() === "") continue;

    if (isLockedCanonicalField(field, currentForm[field], metaMap)) {
      preservedFields.push(field);
      continue;
    }

    merged[field] = String(rawValue);
    nextMeta[field] = createAiSuggestionFieldMeta();
    appliedFields.push(field);
  }

  return { merged, appliedFields, preservedFields, complianceFieldMeta: nextMeta };
}

export function mergeComplianceMetaMaps(
  base: ComplianceFieldMetaMap | undefined,
  patch: ComplianceFieldMetaMap,
): ComplianceFieldMetaMap {
  return { ...(base ?? {}), ...patch };
}

export function fieldMetaRequiresApproval(meta: ComplianceFieldMeta | undefined): boolean {
  return meta?.source === "ai_suggestion" && !meta.approved;
}
