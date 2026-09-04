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
  return [
    `product_name=${String(form.product_name ?? "")}`,
    `category=${String(form.category ?? "")}`,
    `hsn_code=${String(form.hsn_code ?? "")}`,
    `gst_rate=${String(form.gst_rate ?? "")}`,
    `shelf_life_days=${String(form.shelf_life_days ?? "")}`,
    `storage_instructions=${String(form.storage_instructions ?? "")}`,
    `ingredients=${String(form.ingredients ?? "")}`,
    `allergen_warnings=${String(form.allergen_warnings ?? "")}`,
    `nutritional_info=${String(form.nutritional_info ?? "")}`,
  ].join("|");
}

export function isStaleComplianceFormRevision(
  fingerprintAtStart: string,
  form: Record<string, unknown>,
): boolean {
  return fingerprintAtStart !== complianceFormRevisionFingerprint(form);
}
