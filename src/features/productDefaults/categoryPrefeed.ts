import type { FastCreateCategoryKey } from "@/features/productDefaults/categoryDefaults";
import { getCategoryDefaults } from "@/features/productDefaults/categoryDefaults";

export const CATEGORY_PREFEED_DISCLAIMER =
  "Suggested defaults only — not legal or tax truth. Review HSN/GST, shelf life, and veg mark with compliance before catalogue approval.";

export type CategoryPrefeedField = {
  key: string;
  label: string;
  value: string | number | boolean | null;
  source: "category_rule" | "central_parity" | "manual_override";
  needsReview: true;
};

export type CategoryPrefeedBundle = {
  categoryKey: FastCreateCategoryKey;
  categoryLabel: string;
  fields: CategoryPrefeedField[];
  disclaimer: string;
};

const VEG_MARK_BY_CATEGORY: Partial<Record<FastCreateCategoryKey, string>> = {
  baklawa: "veg",
  dragees: "veg",
  dates_chocolate: "veg",
  fusion_sweets: "veg",
  nuts: "veg",
  ready_packs: "veg",
  gift_hampers: "veg",
  packaging: "na",
  bakery: "check_label",
  other: "check_label",
};

export function buildCategoryPrefeed(
  categoryKey: FastCreateCategoryKey,
  categoryLabel: string,
): CategoryPrefeedBundle {
  const d = getCategoryDefaults(categoryKey);
  const fields: CategoryPrefeedField[] = [
    { key: "category", label: "Category", value: d.category, source: "category_rule", needsReview: true },
    { key: "hsn_code", label: "HSN (suggested)", value: d.hsn_code, source: "central_parity", needsReview: true },
    { key: "gst_rate", label: "GST % (suggested)", value: d.gst_rate, source: "central_parity", needsReview: true },
    { key: "primary_uom", label: "UOM", value: d.primary_uom, source: "category_rule", needsReview: true },
    { key: "shelf_life_days", label: "Shelf life (days)", value: d.shelf_life_days, source: "category_rule", needsReview: true },
    {
      key: "storage_instructions",
      label: "Storage",
      value: d.storage_instructions,
      source: "category_rule",
      needsReview: true,
    },
    {
      key: "veg_mark",
      label: "Veg mark (suggested)",
      value: VEG_MARK_BY_CATEGORY[categoryKey] ?? "check_label",
      source: "category_rule",
      needsReview: true,
    },
  ];
  return {
    categoryKey,
    categoryLabel,
    fields,
    disclaimer: CATEGORY_PREFEED_DISCLAIMER,
  };
}

/** Merge prefeed into form without marking as approved compliance truth. */
export function applyPrefeedSuggestions<T extends Record<string, unknown>>(
  form: T,
  categoryKey: FastCreateCategoryKey,
): T & { _prefeed_disclaimer?: string } {
  const bundle = buildCategoryPrefeed(categoryKey, categoryKey);
  const next = { ...form, _prefeed_disclaimer: bundle.disclaimer } as T & { _prefeed_disclaimer?: string };
  for (const f of bundle.fields) {
    if (f.key === "veg_mark") continue;
    const k = f.key;
    const cur = (next as Record<string, unknown>)[k];
    if (cur === "" || cur == null) {
      (next as Record<string, unknown>)[k] = f.value;
    }
  }
  return next;
}
