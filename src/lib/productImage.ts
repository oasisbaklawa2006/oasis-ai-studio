/** AI Studio canonical media bucket (see supabase migrations). */
export const AI_STUDIO_MEDIA_BUCKET = "product-media" as const;

export type ProductImageRow = {
  hero_image_url?: string | null;
  image_url?: string | null;
};

export type ProductHeroMediaRow = {
  type?: string | null;
  file_url?: string | null;
  status?: string | null;
  created_at?: string | null;
  /** Authoritative pixel width for the media-row file (when Core provides it). */
  width_px?: number | null;
  /** Authoritative pixel height for the media-row file (when Core provides it). */
  height_px?: number | null;
};

const NON_HERO_MEDIA_STATUSES = new Set(["deleted", "rejected", "archived"]);

function trimUrl(url: unknown): string | null {
  const v = typeof url === "string" ? url.trim() : null;
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
  const heroes = rows.filter(isApprovedHeroMediaRow).sort((a, b) => {
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
  product: ProductImageRow | Record<string, unknown> | null | undefined,
  mediaRows: ProductHeroMediaRow[] = [],
): string | null {
  return resolveProductCardHeroMeta(product, mediaRows).url;
}

export type ProductCardHeroMeta = {
  url: string | null;
  widthPx: number | null;
  heightPx: number | null;
  source: "media_row" | "product_column" | null;
};

type ProductHeroDimensionRow = ProductImageRow & {
  hero_image_width_px?: number | null;
  hero_image_height_px?: number | null;
};

function normalizePx(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}

/**
 * Resolve hero URL and dimensions from the same authoritative source.
 * Media-row heroes use width_px/height_px from the selected row when present.
 * Product-column heroes may use stored width/height when the URL matches.
 */
export function resolveProductCardHeroMeta(
  product: ProductHeroDimensionRow | Record<string, unknown> | null | undefined,
  mediaRows: ProductHeroMediaRow[] = [],
): ProductCardHeroMeta {
  const heroes = mediaRows.filter(isApprovedHeroMediaRow).sort((a, b) => {
    const ta = Date.parse(a.created_at ?? "") || 0;
    const tb = Date.parse(b.created_at ?? "") || 0;
    return tb - ta;
  });

  const heroRow = heroes[0];
  const fromMedia = trimUrl(heroRow?.file_url);
  if (fromMedia) {
    return {
      url: fromMedia,
      widthPx: normalizePx(heroRow?.width_px),
      heightPx: normalizePx(heroRow?.height_px),
      source: "media_row",
    };
  }

  const heroCol = trimUrl(product?.hero_image_url);
  const imageCol = trimUrl(product?.image_url);
  const url = heroCol ?? imageCol;
  if (!url) {
    return { url: null, widthPx: null, heightPx: null, source: null };
  }

  const productW = normalizePx(product?.hero_image_width_px);
  const productH = normalizePx(product?.hero_image_height_px);
  const urlMatchesProductColumn = url === heroCol || url === imageCol;

  return {
    url,
    widthPx: urlMatchesProductColumn ? productW : null,
    heightPx: urlMatchesProductColumn ? productH : null,
    source: "product_column",
  };
}

/** Unified hero URL — Central writes `image_url`; AI Studio media uploader writes `hero_image_url`. */
export function resolveProductHeroUrl(
  row: ProductImageRow | Record<string, unknown> | null | undefined,
): string | null {
  if (!row) return null;
  const url = row.hero_image_url ?? row.image_url ?? null;
  return trimUrl(url);
}

/** Payload fields to keep Central + AI Studio hero URLs in sync on write. */
export function heroUrlWritePayload(url: string | null): {
  hero_image_url: string | null;
  image_url: string | null;
} {
  return {
    hero_image_url: url,
    image_url: url,
  };
}
