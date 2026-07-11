/**
 * Read-only media summary for the Catalogue Product AI Studio media tab. Reuses the same
 * hero/media authority as the rest of the app (resolveProductCardHeroUrl, isApprovedHeroMediaRow)
 * — never invents a new hero rule, never approves or generates anything.
 */
import {
  isApprovedHeroMediaRow,
  resolveProductCardHeroUrl,
  type ProductHeroMediaRow,
} from "@/lib/productImage";
import { mediaTypeLabel } from "@/features/productAuthority/productMediaPersistence";

export type CatalogueMediaRow = ProductHeroMediaRow & { id?: string };

export interface CatalogueMediaSummary {
  heroUrl: string | null;
  /** Approved, non-hero media rows — each shown once, newest first. */
  approvedMedia: { id: string; typeLabel: string; url: string }[];
  approvedCount: number;
}

export function summarizeCatalogueMedia(
  productHero: { hero_image_url?: string | null; image_url?: string | null } | null,
  rows: CatalogueMediaRow[],
): CatalogueMediaSummary {
  // Bugbot-caught: resolveProductCardHeroUrl() falls back to the legacy hero_image_url/image_url
  // columns whenever no *approved hero* row is found, even if other product_media rows exist.
  // authoritativeMediaAssets() (used by catalogueRequiredMediaSlots for the same product) instead
  // treats "any product_media rows exist" as "rows are the sole source of truth, never fall back."
  // Matching that rule here — legacy columns are only consulted when there are zero rows — keeps
  // the anchor/hero preview and the required-slots list from disagreeing about the same product.
  const heroUrl = resolveProductCardHeroUrl(rows.length > 0 ? null : productHero, rows);

  const approvedMedia = rows
    .filter((r) => String(r.status ?? "").toLowerCase() === "approved" && !isApprovedHeroMediaRow(r))
    .filter((r) => (r.file_url ?? "").trim())
    .sort((a, b) => (Date.parse(b.created_at ?? "") || 0) - (Date.parse(a.created_at ?? "") || 0))
    .map((r, i) => ({
      id: r.id ?? `${r.type ?? "media"}-${i}`,
      typeLabel: mediaTypeLabel(r.type ?? ""),
      url: (r.file_url ?? "").trim(),
    }));

  return { heroUrl, approvedMedia, approvedCount: approvedMedia.length + (heroUrl ? 1 : 0) };
}
