import { resolveProductHeroUrl } from "@/lib/productImage";

const UPLOADER_TYPE_MAP: Record<string, MediaAssetType> = {
  hero_image: "primary_image",
  white_background: "transparent_cutout",
  lifestyle: "lifestyle_image",
  closeup: "close_up_image",
  hamper_open: "open_pack_image",
  hamper_closed: "pack_front_image",
  label_image: "label_front_image",
  raw_photo: "secondary_image",
};

function parseStatus(raw: unknown): MediaAsset["status"] {
  const s = String(raw ?? "draft").toLowerCase();
  if (s === "approved") return "approved";
  if (s === "pending_approval" || s === "pending") return "pending_approval";
  if (s === "rejected") return "rejected";
  return "draft";
}

function parseSource(raw: unknown): MediaAsset["source"] {
  const s = String(raw ?? "manual").toLowerCase();
  if (s === "ai_generated" || s === "ai") return "ai_generated";
  if (s === "import") return "import";
  return "manual";
}

/**
 * Derives media assets from product form + optional persisted media_assets JSON.
 * Persistence to product_media table is future — form/local only for MVP.
 */
export function mediaAssetsFromForm(form: Record<string, unknown>): MediaAsset[] {
  const assets: MediaAsset[] = [];
  const globalStatus = parseStatus(form.media_status);

  const heroUrl = resolveProductHeroUrl(form);
  if (heroUrl) {
    assets.push({
      type: "primary_image",
      url: heroUrl,
      status: globalStatus === "approved" ? "approved" : globalStatus,
      source: "manual",
    });
  }

  const raw = form.media_assets;
  if (Array.isArray(raw)) {
    for (const row of raw) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const mapped =
        UPLOADER_TYPE_MAP[String(r.media_type ?? r.type ?? "")] ??
        (MEDIA_ASSET_TYPE_SAFE(String(r.type ?? r.asset_type ?? "")) ?? null);
      if (!mapped || !r.url) continue;
      assets.push({
        type: mapped,
        url: String(r.url),
        status: parseStatus(r.status ?? globalStatus),
        source: parseSource(r.source),
        label: r.label ? String(r.label) : undefined,
      });
    }
  }

  return dedupeByType(assets);
}

const MEDIA_ASSET_TYPE_SAFE = (t: string): MediaAssetType | null => {
  const key = t.trim().toLowerCase() as MediaAssetType;
  const allowed: MediaAssetType[] = [
    "primary_image",
    "secondary_image",
    "transparent_cutout",
    "pack_front_image",
    "pack_back_image",
    "label_front_image",
    "label_back_image",
    "master_carton_image",
    "open_pack_image",
    "close_up_image",
    "pairing_image",
    "export_pack_image",
    "hamper_arrangement_image",
    "lifestyle_image",
  ];
  return allowed.includes(key) ? key : null;
};

function dedupeByType(assets: MediaAsset[]): MediaAsset[] {
  const map = new Map<MediaAssetType, MediaAsset>();
  for (const a of assets) {
    const existing = map.get(a.type);
    if (!existing || (a.status === "approved" && existing.status !== "approved")) {
      map.set(a.type, a);
    }
  }
  return Array.from(map.values());
}

export function productMediaContextFromForm(form: Record<string, unknown>): {
  productId: string | null;
  productName: string | null;
  category: string | null;
  subcategory: string | null;
  productClass: string | null;
  productType: string | null;
  isLegacy: boolean;
} {
  return {
    productId: form.id ? String(form.id) : null,
    productName: form.product_name ? String(form.product_name) : null,
    category: form.category ? String(form.category) : null,
    subcategory: form.subcategory ? String(form.subcategory) : null,
    productClass: form.product_class ? String(form.product_class) : null,
    productType: form.product_type ? String(form.product_type) : null,
    isLegacy: !form.sku,
  };
}
