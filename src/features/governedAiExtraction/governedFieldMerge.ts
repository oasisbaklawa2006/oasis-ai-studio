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

function isLockedFieldMeta(meta: ComplianceFieldMeta | undefined, currentValue: unknown): boolean {
  if (meta?.approved) return true;
  if (meta?.source === "manual") return true;
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

  const tryMerge = (
    field: ComplianceSensitiveField,
    rawValue: string | null | undefined,
    currentValue: unknown,
    fieldMeta: ComplianceFieldMeta | undefined,
    apply: () => void,
  ) => {
    if (rawValue == null || String(rawValue).trim() === "") return;
    if (isLockedFieldMeta(fieldMeta, currentValue)) {
      preservedFields.push(field);
      return;
    }
    apply();
    appliedFields.push(field);
  };

  tryMerge("hsn_code", suggestions.hsn_code, currentForm.hsn_code, metaMap?.hsn_code, () => {
    merged.hsn_code = String(suggestions.hsn_code);
    nextMeta.hsn_code = createAiSuggestionFieldMeta();
  });
  tryMerge("gst_rate", suggestions.gst_rate, currentForm.gst_rate, metaMap?.gst_rate, () => {
    merged.gst_rate = String(suggestions.gst_rate);
    nextMeta.gst_rate = createAiSuggestionFieldMeta();
  });
  tryMerge(
    "shelf_life_days",
    suggestions.shelf_life_days,
    currentForm.shelf_life_days,
    metaMap?.shelf_life_days,
    () => {
      merged.shelf_life_days = String(suggestions.shelf_life_days);
      nextMeta.shelf_life_days = createAiSuggestionFieldMeta();
    },
  );
  tryMerge(
    "ingredients",
    suggestions.ingredients,
    currentForm.ingredients,
    metaMap?.ingredients,
    () => {
      merged.ingredients = String(suggestions.ingredients);
      nextMeta.ingredients = createAiSuggestionFieldMeta();
    },
  );
  tryMerge(
    "allergen_warnings",
    suggestions.allergen_warnings,
    currentForm.allergen_warnings,
    metaMap?.allergen_warnings,
    () => {
      merged.allergen_warnings = String(suggestions.allergen_warnings);
      nextMeta.allergen_warnings = createAiSuggestionFieldMeta();
    },
  );
  tryMerge(
    "nutritional_info",
    suggestions.nutritional_info,
    currentForm.nutritional_info,
    metaMap?.nutritional_info,
    () => {
      merged.nutritional_info = String(suggestions.nutritional_info);
      nextMeta.nutritional_info = createAiSuggestionFieldMeta();
    },
  );
  tryMerge(
    "nutrition_facts",
    suggestions.nutrition_facts,
    currentForm.nutrition_facts,
    metaMap?.nutrition_facts,
    () => {
      merged.nutrition_facts = String(suggestions.nutrition_facts);
      nextMeta.nutrition_facts = createAiSuggestionFieldMeta();
    },
  );
  tryMerge(
    "storage_instructions",
    suggestions.storage_instructions,
    currentForm.storage_instructions,
    metaMap?.storage_instructions,
    () => {
      merged.storage_instructions = String(suggestions.storage_instructions);
      nextMeta.storage_instructions = createAiSuggestionFieldMeta();
    },
  );
  tryMerge(
    "country_of_origin",
    suggestions.country_of_origin,
    currentForm.country_of_origin,
    metaMap?.country_of_origin,
    () => {
      merged.country_of_origin = String(suggestions.country_of_origin);
      nextMeta.country_of_origin = createAiSuggestionFieldMeta();
    },
  );
  tryMerge(
    "legal_claims",
    suggestions.legal_claims,
    currentForm.legal_claims,
    metaMap?.legal_claims,
    () => {
      merged.legal_claims = String(suggestions.legal_claims);
      nextMeta.legal_claims = createAiSuggestionFieldMeta();
    },
  );
  tryMerge(
    "export_compliance_notes",
    suggestions.export_compliance_notes,
    currentForm.export_compliance_notes,
    metaMap?.export_compliance_notes,
    () => {
      merged.export_compliance_notes = String(suggestions.export_compliance_notes);
      nextMeta.export_compliance_notes = createAiSuggestionFieldMeta();
    },
  );
  tryMerge(
    "health_claims",
    suggestions.health_claims,
    currentForm.health_claims,
    metaMap?.health_claims,
    () => {
      merged.health_claims = String(suggestions.health_claims);
      nextMeta.health_claims = createAiSuggestionFieldMeta();
    },
  );

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
