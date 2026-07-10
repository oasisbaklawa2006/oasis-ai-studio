/**
 * Catalogue media completeness beyond the hero image. `product_media` rows carry a
 * `type` column, so multiple image kinds are already persistable — the gap was purely
 * in evaluation: nothing checked for anything except hero. "Media: Complete" must not
 * be claimed when required catalogue kinds are missing.
 */
import type { SaleType } from "@/features/productAuthority/saleType";
import { getSaleTypeRequirements } from "@/features/productAuthority/saleType";

export type CatalogueMediaKind = "hero" | "square" | "closeup" | "packaging" | "lifestyle";

export const CATALOGUE_MEDIA_KIND_LABELS: Record<CatalogueMediaKind, string> = {
  hero: "Hero image",
  square: "Square / catalogue image",
  closeup: "Close-up / detail image",
  packaging: "Packaging image",
  lifestyle: "Lifestyle image",
};

/** Required catalogue image kinds by sale type. Lifestyle stays optional everywhere. */
export function requiredMediaKinds(saleType: SaleType): CatalogueMediaKind[] {
  const req = getSaleTypeRequirements(saleType);
  if (!req.catalogueVisible) return [];
  if (saleType === "b2b_horeca") return ["hero"];
  return ["hero", "square", "closeup", "packaging"];
}

const KIND_SYNONYMS: Record<CatalogueMediaKind, string[]> = {
  hero: ["hero", "main", "primary"],
  square: ["square", "catalogue", "catalog"],
  closeup: ["closeup", "close-up", "close_up", "detail", "macro"],
  packaging: ["packaging", "pack", "box"],
  lifestyle: ["lifestyle", "ambience", "scene"],
};

export function mediaKindFromRowType(rowType: string | null | undefined): CatalogueMediaKind | null {
  const t = String(rowType ?? "").trim().toLowerCase();
  if (!t) return null;
  for (const [kind, synonyms] of Object.entries(KIND_SYNONYMS) as [CatalogueMediaKind, string[]][]) {
    if (synonyms.some((s) => t.includes(s))) return kind;
  }
  return null;
}

export interface MediaCompletenessResult {
  complete: boolean;
  presentKinds: CatalogueMediaKind[];
  missingKinds: CatalogueMediaKind[];
  missingLabels: string[];
}

export function evaluateCatalogueMediaCompleteness(
  saleType: SaleType,
  mediaRows: Array<{ type?: string | null; file_url?: string | null }>,
  opts?: { fallbackHeroUrl?: string | null },
): MediaCompletenessResult {
  const required = requiredMediaKinds(saleType);
  const present = new Set<CatalogueMediaKind>();

  for (const row of mediaRows) {
    if (!String(row.file_url ?? "").trim()) continue;
    const kind = mediaKindFromRowType(row.type);
    if (kind) present.add(kind);
  }
  if (opts?.fallbackHeroUrl?.trim()) present.add("hero");

  const missing = required.filter((k) => !present.has(k));
  return {
    complete: required.length > 0 ? missing.length === 0 : true,
    presentKinds: [...present],
    missingKinds: missing,
    missingLabels: missing.map((k) => CATALOGUE_MEDIA_KIND_LABELS[k]),
  };
}
