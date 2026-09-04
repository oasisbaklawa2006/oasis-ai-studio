import {
  PERSISTED_COMPLIANCE_PRODUCT_COLUMNS,
  UI_ONLY_COMPLIANCE_FIELDS,
} from "@/shared/ai/compliancePersistence";

/** AI request inputs plus all compliance fields tracked for stale-response detection. */
const COMPLIANCE_FORM_FIELDS = [
  "product_name",
  "category",
  ...PERSISTED_COMPLIANCE_PRODUCT_COLUMNS,
  ...UI_ONLY_COMPLIANCE_FIELDS,
] as const;

let manualEditGeneration = 0;

/** Bump when a compliance field is manually edited — stale AI responses must be discarded. */
export function bumpComplianceManualEditGeneration(): void {
  manualEditGeneration += 1;
}

export function captureComplianceAiRequestGuard(): number {
  return manualEditGeneration;
}

export function isStaleComplianceAiRequest(guardAtStart: number): boolean {
  return guardAtStart !== manualEditGeneration;
}

export function complianceFormRevisionFingerprint(form: Record<string, unknown>): string {
  return COMPLIANCE_FORM_FIELDS.map((field) => {
    switch (field) {
      case "product_name":
        return `product_name=${String(form.product_name ?? "")}`;
      case "category":
        return `category=${String(form.category ?? "")}`;
      case "hsn_code":
        return `hsn_code=${String(form.hsn_code ?? "")}`;
      case "gst_rate":
        return `gst_rate=${String(form.gst_rate ?? "")}`;
      case "shelf_life_days":
        return `shelf_life_days=${String(form.shelf_life_days ?? "")}`;
      case "storage_instructions":
        return `storage_instructions=${String(form.storage_instructions ?? "")}`;
      case "ingredients":
        return `ingredients=${String(form.ingredients ?? "")}`;
      case "allergen_warnings":
        return `allergen_warnings=${String(form.allergen_warnings ?? "")}`;
      case "nutritional_info":
        return `nutritional_info=${String(form.nutritional_info ?? "")}`;
    }
  }).join("|");
}

export function isStaleComplianceFormRevision(
  fingerprintAtStart: string,
  form: Record<string, unknown>,
): boolean {
  return fingerprintAtStart !== complianceFormRevisionFingerprint(form);
}
