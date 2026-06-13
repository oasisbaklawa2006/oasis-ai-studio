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
  "closeup",
  "side_angle",
  "top_angle",
  "45_angle",
  "hamper_open",
  "hamper_closed",
  "video",
  "source_pdf_page",
] as const;

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

/** Unified hero URL — Central writes `image_url`; AI Studio media uploader writes `hero_image_url`. */
export function resolveProductHeroUrl(row: ProductImageRow | null | undefined): string | null {
  if (!row) return null;
  const url = row.hero_image_url ?? row.image_url ?? null;
  return url && String(url).trim() ? String(url).trim() : null;
}

/** Payload fields to keep Central + AI Studio hero URLs in sync on write. */
export function heroUrlWritePayload(url: string | null): Record<string, string | null> {
  return {
    hero_image_url: url,
    image_url: url,
  };
}
