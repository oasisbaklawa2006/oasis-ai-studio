/** AI Studio canonical media bucket (see supabase migrations). */
export const AI_STUDIO_MEDIA_BUCKET = "product-media" as const;

/** Canonical product media roles (product_media.type). */
export const PRODUCT_MEDIA_ROLES = [
  "hero_image",
  "square_image",
  "detail_image",
  "packaging_image",
  "lifestyle_image",
  "label_image",
  "raw_photo",
  "white_background",
  "lifestyle",
  "closeup",
  "side_angle",
  "top_angle",
  "45_angle",
  "hamper_open",
  "hamper_closed",
  "video",
  "source_pdf_page",
] as const;

export { MEDIA_TYPE_LABELS, mediaTypeLabel } from "@/features/productAuthority/productMediaPersistence";

export type ProductMediaRole = (typeof PRODUCT_MEDIA_ROLES)[number];

/** Oasis Central Product Master hero uploads (shared Supabase). */
export const CENTRAL_PRODUCT_IMAGES_BUCKET = "product-images" as const;

/** Buckets referenced across Oasis apps (read any public URL; write via AI Studio uploader). */
export const PRODUCT_MEDIA_BUCKETS = {
  studio: AI_STUDIO_MEDIA_BUCKET,
  central: CENTRAL_PRODUCT_IMAGES_BUCKET,
} as const;

export type ProductImageRow = {
  hero_image_url?: string | null;
  image_url?: string | null;
};

export type ProductHeroMediaRow = {
  type?: string | null;
  file_url?: string | null;
  status?: string | null;
  created_at?: string | null;
};

const NON_HERO_MEDIA_STATUSES = new Set(["deleted", "rejected", "archived"]);

function trimUrl(url: string | null | undefined): string | null {
  const v = url?.trim();
  return v ? v : null;
}

/** Approved hero_image row only — excludes raw_photo and other slots. */
export function isApprovedHeroMediaRow(row: ProductHeroMediaRow): boolean {
  if (!trimUrl(row.file_url)) return false;
  const status = String(row.status ?? "").toLowerCase();
  if (NON_HERO_MEDIA_STATUSES.has(status)) return false;
  return status === "approved" && String(row.type ?? "").toLowerCase() === "hero_image";
}

/** Latest approved hero_image by created_at (desc). Never uses raw_photo or other types. */
export function latestApprovedHeroUrlFromMediaRows(rows: ProductHeroMediaRow[]): string | null {
  const heroes = rows
    .filter(isApprovedHeroMediaRow)
    .sort((a, b) => {
      const ta = Date.parse(a.created_at ?? "") || 0;
      const tb = Date.parse(b.created_at ?? "") || 0;
      return tb - ta;
    });
  return trimUrl(heroes[0]?.file_url);
}

/**
 * Canonical hero URL for Product Master cards and Product Truth.
 * Precedence: latest approved hero_image media → products.hero_image_url → products.image_url.
 */
export function resolveProductCardHeroUrl(
  product: ProductImageRow | null | undefined,
  mediaRows: ProductHeroMediaRow[] = [],
): string | null {
  const fromMedia = latestApprovedHeroUrlFromMediaRows(mediaRows);
  if (fromMedia) return fromMedia;

  const heroCol = trimUrl(product?.hero_image_url);
  if (heroCol) return heroCol;

  return trimUrl(product?.image_url);
}

/** Unified hero URL — Central writes `image_url`; AI Studio media uploader writes `hero_image_url`. */
export function resolveProductHeroUrl(row: ProductImageRow | null | undefined): string | null {
  if (!row) return null;
  const url = row.hero_image_url ?? row.image_url ?? null;
  return trimUrl(url);
}

/** Payload fields to keep Central + AI Studio hero URLs in sync on write. */
export function heroUrlWritePayload(url: string | null): Record<string, string | null> {
  return {
    hero_image_url: url,
    image_url: url,
  };
}
