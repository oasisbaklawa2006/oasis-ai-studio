export type ReadinessLevel = "missing" | "partial" | "ready" | "warning" | "locked";

export interface Product {
  id: string;
  product_name?: string | null;
  sku?: string | null;
  sku_locked?: boolean | null;
  legacy_sku?: string | null;
  category?: string | null;
  short_description?: string | null;
  hero_image_url?: string | null;
  image_url?: string | null;
  media_status?: string | null;
  label_status?: string | null;
  is_active?: boolean | null;
}

export const skuReadiness = (p: Product): ReadinessLevel => {
  if (!p.sku) return "missing";
  if (p.legacy_sku && !p.sku.startsWith("OAS-")) return "warning";
  if (p.sku_locked) return "locked";
  return "ready";
};

export const mediaReadiness = (p: Product): ReadinessLevel => {
  const hero = p.hero_image_url ?? p.image_url;
  if (hero || p.media_status === "approved") return "ready";
  if (p.media_status && p.media_status !== "missing") return "partial";
  return "missing";
};

export const aliasReadiness = (count: number): ReadinessLevel => {
  if (count === 0) return "missing";
  if (count === 1) return "partial";
  return "ready";
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

export const readinessToneClass = (l: ReadinessLevel) => {
  switch (l) {
    case "ready":
    case "locked": return "bg-success/10 text-success";
    case "partial": return "bg-warning/10 text-warning";
    case "warning": return "bg-warning/15 text-warning";
    default: return "bg-destructive/10 text-destructive";
  }
};
