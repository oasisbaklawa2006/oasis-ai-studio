type ReadinessLevel = "missing" | "partial" | "ready" | "warning" | "locked";

export interface Product {
  id: string;
  product_name?: string | null;
  sku?: string | null;
  sku_locked?: boolean | null;
  legacy_sku?: string | null;
  category?: string | null;
  short_description?: string | null;
  hero_image_url?: string | null;
  media_status?: string | null;
  label_status?: string | null;
  is_active?: boolean | null;
}

const mediaReadiness = (p: Product): ReadinessLevel => {
  if (p.hero_image_url || p.media_status === "approved") return "ready";
  if (p.media_status && p.media_status !== "missing") return "partial";
  return "missing";
};

export interface ReadinessReport {
  ready: boolean;
  missing: string[];
  warnings: string[];
}

export const catalogueReadiness = (p: Product): ReadinessReport => {
  const missing: string[] = [];
  const warnings: string[] = [];
  if (!p.is_active) missing.push("Active flag");
  if (!p.product_name) missing.push("Product name");
  if (!p.sku) missing.push("SKU");
  if (p.sku && !p.sku_locked) warnings.push("SKU not locked");
  if (!p.category) missing.push("Category");
  if (!p.short_description) missing.push("Short description");
  if (mediaReadiness(p) === "missing") missing.push("Hero image");
  if (p.label_status === "rejected") warnings.push("Label rejected");
  return { ready: missing.length === 0, missing, warnings };
};
