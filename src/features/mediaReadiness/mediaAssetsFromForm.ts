import { resolveProductHeroUrl } from "@/lib/productImage";
import { MEDIA_UPLOADER_TO_READINESS } from "@/features/productTruth/readinessProfiles";
import type { MediaAsset, MediaAssetType } from "./types";

/** Row shape from `product_media` table (select *). */
export type ProductMediaRow = {
  id?: string;
  product_id?: string | null;
  type?: string | null;
  file_url?: string | null;
  status?: string | null;
  alt_text?: string | null;
  angle?: string | null;
  created_at?: string | null;
};

function parseStatus(raw: unknown): MediaAsset["status"] {
  const s = String(raw ?? "draft").toLowerCase();
  if (s === "approved") return "approved";
  if (s === "pending_approval" || s === "pending" || s === "raw") return "pending_approval";
  if (s === "rejected") return "rejected";
  return "draft";
}

function parseSource(raw: unknown): MediaAsset["source"] {
  const s = String(raw ?? "manual").toLowerCase();
  if (s === "ai_generated" || s === "ai") return "ai_generated";
  if (s === "import") return "import";
  return "manual";
}

function mapUploaderType(rawType: string): MediaAssetType | null {
  const key = rawType.trim().toLowerCase();
  return MEDIA_UPLOADER_TO_READINESS[key] ?? MEDIA_ASSET_TYPE_SAFE(key);
}

function assetFromRow(
  mapped: MediaAssetType,
  url: string,
  status: MediaAsset["status"],
  source: MediaAsset["source"],
  label?: string,
): MediaAsset {
  return { type: mapped, url, status, source, label };
}

/**
 * Maps persisted `product_media` rows to readiness asset slots.
 */
export function mediaAssetsFromProductMedia(rows: ProductMediaRow[]): MediaAsset[] {
  const assets: MediaAsset[] = [];

  for (const row of rows) {
    const rawType = String(row.type ?? "");
    const mapped = mapUploaderType(rawType);
    const url = row.file_url ? String(row.file_url) : null;
    if (!mapped || !url) continue;

    assets.push(
      assetFromRow(
        mapped,
        url,
        parseStatus(row.status),
        "manual",
        row.alt_text ? String(row.alt_text) : rawType || undefined,
      ),
    );
  }

  return dedupeByType(assets);
}

/**
 * Derives media assets from product form + optional persisted media_assets JSON.
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
      const mapped = mapUploaderType(String(r.media_type ?? r.type ?? ""));
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

/**
 * Merges form-derived and DB `product_media` assets.
 * DB rows win when both sources provide the same slot type.
 */
export function mergeMediaAssets(...groups: MediaAsset[][]): MediaAsset[] {
  const merged: MediaAsset[] = [];
  for (const group of groups) {
    merged.push(...group);
  }
  return dedupeByType(merged);
}

export function mediaAssetsFromSources(input: {
  form: Record<string, unknown>;
  productMediaRows?: ProductMediaRow[];
}): MediaAsset[] {
  const fromForm = mediaAssetsFromForm(input.form);
  const fromDb = mediaAssetsFromProductMedia(input.productMediaRows ?? []);
  return mergeMediaAssets(fromForm, fromDb);
}

const MEDIA_ASSET_TYPE_SAFE = (t: string): MediaAssetType | null => {
  const key = t.trim().toLowerCase() as MediaAssetType;
  const allowed: MediaAssetType[] = [
    "primary_image",
    "secondary_image",
    "catalogue_image",
    "secondary_angle",
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
    "lifestyle_variant",
    "packaging_reference",
    "source_reference",
  ];
  return allowed.includes(key) ? key : null;
};

function dedupeByType(assets: MediaAsset[]): MediaAsset[] {
  const map = new Map<MediaAssetType, MediaAsset>();
  for (const a of assets) {
    const existing = map.get(a.type);
    if (!existing) {
      map.set(a.type, a);
      continue;
    }
    if (a.status === "approved" && existing.status !== "approved") {
      map.set(a.type, a);
    } else if (existing.status !== "approved") {
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

export function slotDisplayLabel(
  slot: { present: boolean; approved: boolean; status: MediaAsset["status"] | "missing" },
): string {
  if (!slot.present) return "missing";
  if (!slot.approved) return "draft pending approval";
  return slot.status === "approved" ? "approved" : String(slot.status);
}
