import type { ComplianceFieldMetaMap } from "@/shared/ai/complianceApproval";
import { approveComplianceFieldMeta } from "@/shared/ai/complianceApproval";
import type { ComplianceSensitiveField } from "@/shared/ai/complianceConstants";

type FormSetter = (key: string, value: unknown) => void;

export function complianceFieldDisplayLabel(field: ComplianceSensitiveField): string {
  switch (field) {
    case "hsn_code":
      return "HSN";
    case "gst_rate":
      return "GST %";
    case "shelf_life_days":
      return "Shelf life (days)";
    case "frozen_shelf_life_days":
      return "Frozen shelf life (days)";
    case "post_processing_shelf_life_days":
      return "Post-processing shelf life (days)";
    case "ingredients":
      return "Ingredients";
    case "allergen_warnings":
      return "Allergen warnings";
    case "nutritional_info":
      return "Nutritional information";
    case "storage_instructions":
      return "Storage instructions";
    case "temperature_requirement":
      return "Temperature requirement";
    case "thawing_instruction":
      return "Thawing instruction";
    case "nutrition_facts":
      return "Nutrition facts";
    case "country_of_origin":
      return "Country of origin";
    case "legal_claims":
      return "Legal claims";
    case "export_compliance_notes":
      return "Export compliance notes";
    case "health_claims":
      return "Health claims";
  }
}

export function applyAppliedComplianceFields(
  appliedFields: ComplianceSensitiveField[],
  mergedForm: Record<string, unknown>,
  set: FormSetter,
): void {
  const applied = new Set(appliedFields);
  if (applied.has("hsn_code")) set("hsn_code", mergedForm.hsn_code);
  if (applied.has("gst_rate")) set("gst_rate", mergedForm.gst_rate);
  if (applied.has("shelf_life_days")) set("shelf_life_days", mergedForm.shelf_life_days);
  if (applied.has("frozen_shelf_life_days"))
    set("frozen_shelf_life_days", mergedForm.frozen_shelf_life_days);
  if (applied.has("post_processing_shelf_life_days")) {
    set("post_processing_shelf_life_days", mergedForm.post_processing_shelf_life_days);
  }
  if (applied.has("ingredients")) set("ingredients", mergedForm.ingredients);
  if (applied.has("allergen_warnings")) set("allergen_warnings", mergedForm.allergen_warnings);
  if (applied.has("nutritional_info")) set("nutritional_info", mergedForm.nutritional_info);
  if (applied.has("nutrition_facts")) set("nutrition_facts", mergedForm.nutrition_facts);
  if (applied.has("storage_instructions"))
    set("storage_instructions", mergedForm.storage_instructions);
  if (applied.has("temperature_requirement"))
    set("temperature_requirement", mergedForm.temperature_requirement);
  if (applied.has("thawing_instruction")) set("thawing_instruction", mergedForm.thawing_instruction);
  if (applied.has("country_of_origin")) set("country_of_origin", mergedForm.country_of_origin);
  if (applied.has("legal_claims")) set("legal_claims", mergedForm.legal_claims);
  if (applied.has("export_compliance_notes")) {
    set("export_compliance_notes", mergedForm.export_compliance_notes);
  }
  if (applied.has("health_claims")) set("health_claims", mergedForm.health_claims);
}

export function approveComplianceFieldInMap(
  prev: ComplianceFieldMetaMap,
  field: ComplianceSensitiveField,
  role: string,
): ComplianceFieldMetaMap {
  const approved = approveComplianceFieldMeta(readComplianceFieldMeta(prev, field), role);
  switch (field) {
    case "hsn_code":
      return { ...prev, hsn_code: approved };
    case "gst_rate":
      return { ...prev, gst_rate: approved };
    case "shelf_life_days":
      return { ...prev, shelf_life_days: approved };
    case "frozen_shelf_life_days":
      return { ...prev, frozen_shelf_life_days: approved };
    case "post_processing_shelf_life_days":
      return { ...prev, post_processing_shelf_life_days: approved };
    case "ingredients":
      return { ...prev, ingredients: approved };
    case "allergen_warnings":
      return { ...prev, allergen_warnings: approved };
    case "nutritional_info":
      return { ...prev, nutritional_info: approved };
    case "nutrition_facts":
      return { ...prev, nutrition_facts: approved };
    case "storage_instructions":
      return { ...prev, storage_instructions: approved };
    case "temperature_requirement":
      return { ...prev, temperature_requirement: approved };
    case "thawing_instruction":
      return { ...prev, thawing_instruction: approved };
    case "country_of_origin":
      return { ...prev, country_of_origin: approved };
    case "legal_claims":
      return { ...prev, legal_claims: approved };
    case "export_compliance_notes":
      return { ...prev, export_compliance_notes: approved };
    case "health_claims":
      return { ...prev, health_claims: approved };
  }
}

export function manualComplianceFieldMetaPatch(
  prev: ComplianceFieldMetaMap,
  field: ComplianceSensitiveField,
): ComplianceFieldMetaMap {
  const manual = { source: "manual" as const, approved: false, suggestion_only: false };
  switch (field) {
    case "hsn_code":
      return { ...prev, hsn_code: manual };
    case "gst_rate":
      return { ...prev, gst_rate: manual };
    case "shelf_life_days":
      return { ...prev, shelf_life_days: manual };
    case "frozen_shelf_life_days":
      return { ...prev, frozen_shelf_life_days: manual };
    case "post_processing_shelf_life_days":
      return { ...prev, post_processing_shelf_life_days: manual };
    case "ingredients":
      return { ...prev, ingredients: manual };
    case "allergen_warnings":
      return { ...prev, allergen_warnings: manual };
    case "nutritional_info":
      return { ...prev, nutritional_info: manual };
    case "nutrition_facts":
      return { ...prev, nutrition_facts: manual };
    case "storage_instructions":
      return { ...prev, storage_instructions: manual };
    case "temperature_requirement":
      return { ...prev, temperature_requirement: manual };
    case "thawing_instruction":
      return { ...prev, thawing_instruction: manual };
    case "country_of_origin":
      return { ...prev, country_of_origin: manual };
    case "legal_claims":
      return { ...prev, legal_claims: manual };
    case "export_compliance_notes":
      return { ...prev, export_compliance_notes: manual };
    case "health_claims":
      return { ...prev, health_claims: manual };
  }
}

export function readComplianceFormField(
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
    case "frozen_shelf_life_days":
      return form.frozen_shelf_life_days;
    case "post_processing_shelf_life_days":
      return form.post_processing_shelf_life_days;
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
    case "temperature_requirement":
      return form.temperature_requirement;
    case "thawing_instruction":
      return form.thawing_instruction;
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

export function readComplianceFieldMeta(
  metaMap: ComplianceFieldMetaMap | undefined,
  field: ComplianceSensitiveField,
) {
  switch (field) {
    case "hsn_code":
      return metaMap?.hsn_code;
    case "gst_rate":
      return metaMap?.gst_rate;
    case "shelf_life_days":
      return metaMap?.shelf_life_days;
    case "frozen_shelf_life_days":
      return metaMap?.frozen_shelf_life_days;
    case "post_processing_shelf_life_days":
      return metaMap?.post_processing_shelf_life_days;
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
    case "temperature_requirement":
      return metaMap?.temperature_requirement;
    case "thawing_instruction":
      return metaMap?.thawing_instruction;
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
