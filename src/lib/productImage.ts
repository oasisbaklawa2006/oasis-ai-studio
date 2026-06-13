/** AI Studio canonical media bucket (see supabase migrations). */
export const AI_STUDIO_MEDIA_BUCKET = "product-media" as const;

/** Oasis Central Product Master hero uploads (shared Supabase). */
export const CENTRAL_PRODUCT_IMAGES_BUCKET = "product-images" as const;

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
