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

  if (suggestions.hsn_code != null && String(suggestions.hsn_code).trim() !== "") {
    if (isLockedFieldMeta(metaMap?.hsn_code, currentForm.hsn_code)) {
      preservedFields.push("hsn_code");
    } else {
      merged.hsn_code = String(suggestions.hsn_code);
      nextMeta.hsn_code = createAiSuggestionFieldMeta();
      appliedFields.push("hsn_code");
    }
  }
  if (suggestions.gst_rate != null && String(suggestions.gst_rate).trim() !== "") {
    if (isLockedFieldMeta(metaMap?.gst_rate, currentForm.gst_rate)) {
      preservedFields.push("gst_rate");
    } else {
      merged.gst_rate = String(suggestions.gst_rate);
      nextMeta.gst_rate = createAiSuggestionFieldMeta();
      appliedFields.push("gst_rate");
    }
  }
  if (suggestions.shelf_life_days != null && String(suggestions.shelf_life_days).trim() !== "") {
    if (isLockedFieldMeta(metaMap?.shelf_life_days, currentForm.shelf_life_days)) {
      preservedFields.push("shelf_life_days");
    } else {
      merged.shelf_life_days = String(suggestions.shelf_life_days);
      nextMeta.shelf_life_days = createAiSuggestionFieldMeta();
      appliedFields.push("shelf_life_days");
    }
  }
  if (suggestions.ingredients != null && String(suggestions.ingredients).trim() !== "") {
    if (isLockedFieldMeta(metaMap?.ingredients, currentForm.ingredients)) {
      preservedFields.push("ingredients");
    } else {
      merged.ingredients = String(suggestions.ingredients);
      nextMeta.ingredients = createAiSuggestionFieldMeta();
      appliedFields.push("ingredients");
    }
  }
  if (
    suggestions.allergen_warnings != null &&
    String(suggestions.allergen_warnings).trim() !== ""
  ) {
    if (isLockedFieldMeta(metaMap?.allergen_warnings, currentForm.allergen_warnings)) {
      preservedFields.push("allergen_warnings");
    } else {
      merged.allergen_warnings = String(suggestions.allergen_warnings);
      nextMeta.allergen_warnings = createAiSuggestionFieldMeta();
      appliedFields.push("allergen_warnings");
    }
  }
  if (suggestions.nutritional_info != null && String(suggestions.nutritional_info).trim() !== "") {
    if (isLockedFieldMeta(metaMap?.nutritional_info, currentForm.nutritional_info)) {
      preservedFields.push("nutritional_info");
    } else {
      merged.nutritional_info = String(suggestions.nutritional_info);
      nextMeta.nutritional_info = createAiSuggestionFieldMeta();
      appliedFields.push("nutritional_info");
    }
  }
  if (suggestions.nutrition_facts != null && String(suggestions.nutrition_facts).trim() !== "") {
    if (isLockedFieldMeta(metaMap?.nutrition_facts, currentForm.nutrition_facts)) {
      preservedFields.push("nutrition_facts");
    } else {
      merged.nutrition_facts = String(suggestions.nutrition_facts);
      nextMeta.nutrition_facts = createAiSuggestionFieldMeta();
      appliedFields.push("nutrition_facts");
    }
  }
  if (
    suggestions.storage_instructions != null &&
    String(suggestions.storage_instructions).trim() !== ""
  ) {
    if (isLockedFieldMeta(metaMap?.storage_instructions, currentForm.storage_instructions)) {
      preservedFields.push("storage_instructions");
    } else {
      merged.storage_instructions = String(suggestions.storage_instructions);
      nextMeta.storage_instructions = createAiSuggestionFieldMeta();
      appliedFields.push("storage_instructions");
    }
  }
  if (
    suggestions.country_of_origin != null &&
    String(suggestions.country_of_origin).trim() !== ""
  ) {
    if (isLockedFieldMeta(metaMap?.country_of_origin, currentForm.country_of_origin)) {
      preservedFields.push("country_of_origin");
    } else {
      merged.country_of_origin = String(suggestions.country_of_origin);
      nextMeta.country_of_origin = createAiSuggestionFieldMeta();
      appliedFields.push("country_of_origin");
    }
  }
  if (suggestions.legal_claims != null && String(suggestions.legal_claims).trim() !== "") {
    if (isLockedFieldMeta(metaMap?.legal_claims, currentForm.legal_claims)) {
      preservedFields.push("legal_claims");
    } else {
      merged.legal_claims = String(suggestions.legal_claims);
      nextMeta.legal_claims = createAiSuggestionFieldMeta();
      appliedFields.push("legal_claims");
    }
  }
  if (
    suggestions.export_compliance_notes != null &&
    String(suggestions.export_compliance_notes).trim() !== ""
  ) {
    if (isLockedFieldMeta(metaMap?.export_compliance_notes, currentForm.export_compliance_notes)) {
      preservedFields.push("export_compliance_notes");
    } else {
      merged.export_compliance_notes = String(suggestions.export_compliance_notes);
      nextMeta.export_compliance_notes = createAiSuggestionFieldMeta();
      appliedFields.push("export_compliance_notes");
    }
  }
  if (suggestions.health_claims != null && String(suggestions.health_claims).trim() !== "") {
    if (isLockedFieldMeta(metaMap?.health_claims, currentForm.health_claims)) {
      preservedFields.push("health_claims");
    } else {
      merged.health_claims = String(suggestions.health_claims);
      nextMeta.health_claims = createAiSuggestionFieldMeta();
      appliedFields.push("health_claims");
    }
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
