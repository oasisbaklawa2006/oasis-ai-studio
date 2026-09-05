import { COMPLIANCE_SENSITIVE_FIELDS } from "@/shared/ai/complianceConstants";
import { readComplianceFormField } from "./complianceFieldLiterals";

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
  const requestInputs = [
    `product_name=${String(form.product_name ?? "")}`,
    `category=${String(form.category ?? "")}`,
  ];
  const complianceFields = COMPLIANCE_SENSITIVE_FIELDS.map(
    (field) => `${field}=${String(readComplianceFormField(form, field) ?? "")}`,
  );
  return [...requestInputs, ...complianceFields].join("|");
}

export function isStaleComplianceFormRevision(
  fingerprintAtStart: string,
  form: Record<string, unknown>,
): boolean {
  return fingerprintAtStart !== complianceFormRevisionFingerprint(form);
}
