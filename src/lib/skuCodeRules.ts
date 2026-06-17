import { supabase } from "@/integrations/supabase/client";

export type SkuCodeRule = {
  code: string;
  label: string;
  code_type: string;
  sort_order?: number | null;
  is_active?: boolean | null;
};

export type SkuCodeRulesLoadResult = {
  rules: SkuCodeRule[];
  error: string | null;
  source: "primary" | "fallback_unfiltered" | "empty";
};

/**
 * Load active sku_code_rules for SkuBuilder / Fast Create.
 * Tries primary query, then unfiltered fallback (client-side is_active filter).
 */
export async function fetchActiveSkuCodeRules(): Promise<SkuCodeRulesLoadResult> {
  const primary = await supabase
    .from("sku_code_rules")
    .select("code,label,code_type,sort_order,is_active")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (!primary.error && primary.data?.length) {
    return { rules: primary.data as SkuCodeRule[], error: null, source: "primary" };
  }

  const fallback = await supabase
    .from("sku_code_rules")
    .select("code,label,code_type,sort_order,is_active")
    .order("sort_order", { ascending: true });

  if (!fallback.error && fallback.data?.length) {
    const rules = (fallback.data as SkuCodeRule[]).filter((r) => r.is_active !== false);
    if (rules.length) {
      return {
        rules,
        error: primary.error?.message ?? null,
        source: "fallback_unfiltered",
      };
    }
  }

  const err =
    primary.error?.message ??
    fallback.error?.message ??
    (primary.data?.length === 0 ? "sku_code_rules returned zero active rows" : null);

  return { rules: [], error: err, source: "empty" };
}
