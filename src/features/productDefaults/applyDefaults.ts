import {
  CREATION_BASELINE_DEFAULTS,
  type FastCreateCategoryKey,
  getCategoryDefaults,
} from "./categoryDefaults";

export function applyCreationBaselineDefaults<T extends Record<string, unknown>>(
  form: T,
): T & Record<string, unknown> {
  const next = { ...form };
  for (const [key, value] of Object.entries(CREATION_BASELINE_DEFAULTS)) {
    const current = next[key];
    if (current === "" || current == null) {
      (next as Record<string, unknown>)[key] = value;
    }
  }
  return next;
}

export function applyCategoryDefaults<T extends Record<string, unknown>>(
  form: T,
  categoryKey: FastCreateCategoryKey,
): T {
  const patch = getCategoryDefaults(categoryKey);
  return { ...applyCreationBaselineDefaults(form), ...patch };
}
