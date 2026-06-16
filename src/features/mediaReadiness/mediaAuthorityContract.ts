import { supabase } from "@/integrations/supabase/client";
import { heroUrlWritePayload, resolveProductHeroUrl } from "@/lib/productImage";
import type { MediaAsset } from "./types";
import {
  getMediaGovernanceMode,
  governedRequiredUploaderTypes,
} from "./mediaGovernanceMode";
import {
  mediaAssetsFromProductMedia,
  type ProductMediaRow,
} from "./mediaAssetsFromForm";

export type DerivedMediaStatus = "approved" | "pending_approval" | "missing";

const PENDING_STATUSES = new Set(["raw", "pending", "pending_approval", "draft"]);

function rowIsApproved(row: ProductMediaRow): boolean {
  const s = String(row.status ?? "").toLowerCase();
  return s === "approved";
}

/**
 * Authoritative media_status derived only from persisted product_media rows.
 * Respects VITE_MEDIA_GOVERNANCE_MODE required slots (testing: hero only).
 */
export function deriveMediaStatusFromRows(
  rows: ProductMediaRow[],
  opts?: { fallbackHeroUrl?: string | null },
): DerivedMediaStatus {
  if (!rows.length) {
    const fallback = opts?.fallbackHeroUrl?.trim();
    const governedRequired = governedRequiredUploaderTypes();
    if (
      governedRequired?.length === 1 &&
      governedRequired[0] === "hero_image" &&
      fallback &&
      !fallback.includes("/_pdf_pages/")
    ) {
      return "approved";
    }
    return "missing";
  }

  const governedRequired = governedRequiredUploaderTypes();
  if (governedRequired) {
    const withUrl = rows.filter((r) => r.file_url);
    if (!withUrl.length) return "missing";

    for (const reqType of governedRequired) {
      const row = rows.find(
        (r) => String(r.type ?? "").toLowerCase() === reqType && r.file_url,
      );
      if (!row) {
        const fallback = opts?.fallbackHeroUrl?.trim();
        if (
          reqType === "hero_image" &&
          fallback &&
          !fallback.includes("/_pdf_pages/")
        ) {
          continue;
        }
        return "missing";
      }
      if (!rowIsApproved(row)) return "pending_approval";
    }
    return "approved";
  }

  const withUrl = rows.filter((r) => r.file_url);
  if (!withUrl.length) return "missing";
  if (withUrl.every(rowIsApproved)) return "approved";
  if (withUrl.some(rowIsApproved)) return "pending_approval";
  return "pending_approval";
}

/** Hero URL from approved hero_image row, else first approved image row. */
export function deriveHeroUrlFromMediaRows(rows: ProductMediaRow[]): string | null {
  const hero = rows.find(
    (r) => rowIsApproved(r) && String(r.type ?? "").toLowerCase() === "hero_image" && r.file_url,
  );
  if (hero?.file_url) return String(hero.file_url);

  const firstApproved = rows.find((r) => rowIsApproved(r) && r.file_url);
  return firstApproved?.file_url ? String(firstApproved.file_url) : null;
}

/**
 * When product_media rows exist they are the sole source for readiness assets.
 * Form hero / media_status are not merged (prevents stale UI drift).
 */
export function authoritativeMediaAssets(
  productMediaRows: ProductMediaRow[],
  form?: Record<string, unknown>,
): MediaAsset[] {
  if (productMediaRows.length > 0) {
    return mediaAssetsFromProductMedia(productMediaRows);
  }
  const heroUrl = resolveProductHeroUrl(form ?? {});
  if (!heroUrl) return [];
  const ms = String(form?.media_status ?? "").toLowerCase();
  const status: MediaAsset["status"] =
    ms === "approved" ? "approved" : ms === "rejected" ? "rejected" : "pending_approval";
  return [{ type: "primary_image", url: heroUrl, status, source: "manual" }];
}

/** Sync products.hero_image_url + products.media_status from product_media authority. */
export async function syncProductMediaAuthority(
  productId: string,
  rows: ProductMediaRow[],
): Promise<{ media_status: DerivedMediaStatus; hero_image_url: string | null }> {
  const media_status = deriveMediaStatusFromRows(rows);
  const hero_image_url = deriveHeroUrlFromMediaRows(rows);

  const { error } = await supabase
    .from("products")
    .update({
      media_status,
      ...heroUrlWritePayload(hero_image_url),
    })
    .eq("id", productId);

  if (error) throw new Error(error.message);

  return { media_status, hero_image_url };
}

/**
 * Direct master-write repair: rows saved as raw/pending are upgraded to approved.
 * Fixes historical drift where uploads did not persist approved status.
 */
export async function repairDirectMasterMediaRows(
  productId: string,
  rows: ProductMediaRow[],
): Promise<ProductMediaRow[]> {
  const toRepair = rows.filter((r) => PENDING_STATUSES.has(String(r.status ?? "").toLowerCase()));
  if (!toRepair.length) return rows;

  const ids = toRepair.map((r) => r.id).filter(Boolean) as string[];
  if (!ids.length) return rows;

  const { error } = await supabase
    .from("product_media")
    .update({ status: "approved" })
    .eq("product_id", productId)
    .in("id", ids);

  if (error) {
    if (import.meta.env.DEV) console.warn("[media-authority-repair]", error.message);
    return rows;
  }

  return rows.map((r) =>
    ids.includes(String(r.id)) ? { ...r, status: "approved" } : r,
  );
}
