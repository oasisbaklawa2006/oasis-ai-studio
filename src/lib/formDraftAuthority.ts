/** Fields owned by persisted authority tables — never restore from localStorage drafts. */
export const AUTHORITY_DRAFT_EXCLUDED_KEYS = [
  "media_status",
  "hero_image_url",
  "image_url",
  "hsn_code",
  "gst_rate",
  "shelf_life_days",
  "storage_instructions",
] as const;

export function stripAuthorityFieldsFromDraft<T extends Record<string, unknown>>(form: T): Partial<T> {
  const out = { ...form };
  for (const key of AUTHORITY_DRAFT_EXCLUDED_KEYS) {
    delete out[key];
  }
  return out;
}

export function mergeDraftOverAuthorityForm(
  authorityForm: Record<string, unknown>,
  draft: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!draft) return authorityForm;
  const safe = stripAuthorityFieldsFromDraft(draft);
  return { ...authorityForm, ...safe };
}
