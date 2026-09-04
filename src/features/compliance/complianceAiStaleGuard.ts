import {
  PERSISTED_COMPLIANCE_PRODUCT_COLUMNS,
  UI_ONLY_COMPLIANCE_FIELDS,
} from "@/shared/ai/compliancePersistence";

const COMPLIANCE_FORM_FIELDS = [
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
  return COMPLIANCE_FORM_FIELDS.map((field) => `${field}=${String(form[field] ?? "")}`).join("|");
}

export function isStaleComplianceFormRevision(
  fingerprintAtStart: string,
  form: Record<string, unknown>,
): boolean {
  return fingerprintAtStart !== complianceFormRevisionFingerprint(form);
}
