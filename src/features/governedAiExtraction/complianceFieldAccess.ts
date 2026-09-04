import type { ComplianceFieldMeta, ComplianceFieldMetaMap } from "@/shared/ai/complianceApproval";
import type { ComplianceSensitiveField } from "@/shared/ai/complianceConstants";
import type { AiComplianceSuggestionPayload } from "@/shared/ai/complianceSuggestions";

/** Explicit field reads/writes avoid dynamic object-index access flagged by static security analysis. */

export function readComplianceFormValue(
  form: Record<string, unknown>,
  field: ComplianceSensitiveField,
): unknown {
  switch (field) {
    case "hsn_code":
      return form.hsn_code;
    case "gst_rate":
      return form.gst_rate;
    case "shelf_life_days":
      return form.shelf_life_days;
    case "ingredients":
      return form.ingredients;
    case "allergen_warnings":
      return form.allergen_warnings;
    case "nutritional_info":
      return form.nutritional_info;
    case "nutrition_facts":
      return form.nutrition_facts;
    case "storage_instructions":
      return form.storage_instructions;
    case "country_of_origin":
      return form.country_of_origin;
    case "legal_claims":
      return form.legal_claims;
    case "export_compliance_notes":
      return form.export_compliance_notes;
    case "health_claims":
      return form.health_claims;
  }
}

export function writeComplianceFormValue(
  form: Record<string, unknown>,
  field: ComplianceSensitiveField,
  value: string,
): void {
  switch (field) {
    case "hsn_code":
      form.hsn_code = value;
      return;
    case "gst_rate":
      form.gst_rate = value;
      return;
    case "shelf_life_days":
      form.shelf_life_days = value;
      return;
    case "ingredients":
      form.ingredients = value;
      return;
    case "allergen_warnings":
      form.allergen_warnings = value;
      return;
    case "nutritional_info":
      form.nutritional_info = value;
      return;
    case "nutrition_facts":
      form.nutrition_facts = value;
      return;
    case "storage_instructions":
      form.storage_instructions = value;
      return;
    case "country_of_origin":
      form.country_of_origin = value;
      return;
    case "legal_claims":
      form.legal_claims = value;
      return;
    case "export_compliance_notes":
      form.export_compliance_notes = value;
      return;
    case "health_claims":
      form.health_claims = value;
      return;
  }
}

export function readComplianceFieldMeta(
  metaMap: ComplianceFieldMetaMap | undefined,
  field: ComplianceSensitiveField,
): ComplianceFieldMeta | undefined {
  switch (field) {
    case "hsn_code":
      return metaMap?.hsn_code;
    case "gst_rate":
      return metaMap?.gst_rate;
    case "shelf_life_days":
      return metaMap?.shelf_life_days;
    case "ingredients":
      return metaMap?.ingredients;
    case "allergen_warnings":
      return metaMap?.allergen_warnings;
    case "nutritional_info":
      return metaMap?.nutritional_info;
    case "nutrition_facts":
      return metaMap?.nutrition_facts;
    case "storage_instructions":
      return metaMap?.storage_instructions;
    case "country_of_origin":
      return metaMap?.country_of_origin;
    case "legal_claims":
      return metaMap?.legal_claims;
    case "export_compliance_notes":
      return metaMap?.export_compliance_notes;
    case "health_claims":
      return metaMap?.health_claims;
  }
}

export function writeComplianceFieldMeta(
  metaMap: ComplianceFieldMetaMap,
  field: ComplianceSensitiveField,
  meta: ComplianceFieldMeta,
): void {
  switch (field) {
    case "hsn_code":
      metaMap.hsn_code = meta;
      return;
    case "gst_rate":
      metaMap.gst_rate = meta;
      return;
    case "shelf_life_days":
      metaMap.shelf_life_days = meta;
      return;
    case "ingredients":
      metaMap.ingredients = meta;
      return;
    case "allergen_warnings":
      metaMap.allergen_warnings = meta;
      return;
    case "nutritional_info":
      metaMap.nutritional_info = meta;
      return;
    case "nutrition_facts":
      metaMap.nutrition_facts = meta;
      return;
    case "storage_instructions":
      metaMap.storage_instructions = meta;
      return;
    case "country_of_origin":
      metaMap.country_of_origin = meta;
      return;
    case "legal_claims":
      metaMap.legal_claims = meta;
      return;
    case "export_compliance_notes":
      metaMap.export_compliance_notes = meta;
      return;
    case "health_claims":
      metaMap.health_claims = meta;
      return;
  }
}

export function readGovernedSuggestionValue(
  suggestions: Partial<Record<ComplianceSensitiveField, string | null | undefined>>,
  field: ComplianceSensitiveField,
): string | null | undefined {
  switch (field) {
    case "hsn_code":
      return suggestions.hsn_code;
    case "gst_rate":
      return suggestions.gst_rate;
    case "shelf_life_days":
      return suggestions.shelf_life_days;
    case "ingredients":
      return suggestions.ingredients;
    case "allergen_warnings":
      return suggestions.allergen_warnings;
    case "nutritional_info":
      return suggestions.nutritional_info;
    case "nutrition_facts":
      return suggestions.nutrition_facts;
    case "storage_instructions":
      return suggestions.storage_instructions;
    case "country_of_origin":
      return suggestions.country_of_origin;
    case "legal_claims":
      return suggestions.legal_claims;
    case "export_compliance_notes":
      return suggestions.export_compliance_notes;
    case "health_claims":
      return suggestions.health_claims;
  }
}

export function readAiSuggestionPayloadValue(
  payload: AiComplianceSuggestionPayload,
  field: ComplianceSensitiveField,
): string | number | null | undefined {
  switch (field) {
    case "hsn_code":
      return payload.hsn_code;
    case "gst_rate":
      return payload.gst_rate;
    case "shelf_life_days":
      return payload.shelf_life_days;
    case "ingredients":
      return payload.ingredients;
    case "allergen_warnings":
      return payload.allergen_warnings;
    case "nutritional_info":
      return payload.nutritional_info;
    case "storage_instructions":
      return payload.storage_instructions;
    default:
      return undefined;
  }
}
