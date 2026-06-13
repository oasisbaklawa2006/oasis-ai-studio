import { LIVE_CENTRAL_MIGRATION_PRODUCT_MEDIA_AND_BOM } from "@/features/productAuthority/liveProductsSchema";
import { AI_STUDIO_MEDIA_BUCKET, resolveProductHeroUrl } from "@/lib/productImage";
import { supabase } from "@/integrations/supabase/client";

export type MediaBucketStatus = "unknown" | "available" | "missing" | "error";

export type PilotMediaStatus = {
  bucket: typeof AI_STUDIO_MEDIA_BUCKET;
  bucketStatus: MediaBucketStatus;
  bucketMessage: string;
  heroPresent: boolean;
  heroUrl: string | null;
  squarePresent: boolean;
  uploadPathPattern: string;
};

const UPLOAD_PATH_PATTERN = "products/{sku|id}/raw/{timestamp}-{filename}";

/**
 * Probe storage bucket availability (read-only list — no upload).
 * Fails closed with actionable message if bucket missing.
 */
export async function probeProductMediaBucket(): Promise<{
  status: MediaBucketStatus;
  message: string;
}> {
  try {
    const { data, error } = await supabase.storage.from(AI_STUDIO_MEDIA_BUCKET).list("", { limit: 1 });
    if (error) {
      const msg = error.message ?? String(error);
      if (/bucket not found|not exist|404/i.test(msg)) {
        return {
          status: "missing",
          message: `Storage bucket "${AI_STUDIO_MEDIA_BUCKET}" not found. Apply migration ${LIVE_CENTRAL_MIGRATION_PRODUCT_MEDIA_AND_BOM} on project tcxvcatsqqertcnycuop.`,
        };
      }
      return { status: "error", message: msg };
    }
    return {
      status: "available",
      message: data ? `Bucket "${AI_STUDIO_MEDIA_BUCKET}" reachable.` : `Bucket "${AI_STUDIO_MEDIA_BUCKET}" reachable (empty).`,
    };
  } catch (e) {
    return {
      status: "error",
      message: e instanceof Error ? e.message : "Storage probe failed",
    };
  }
}

export async function evaluatePilotMediaForProduct(
  product: { id: string; sku?: string | null; hero_image_url?: string | null; image_url?: string | null },
): Promise<Omit<PilotMediaStatus, "bucket" | "bucketStatus" | "bucketMessage" | "uploadPathPattern">> {
  const heroUrl = resolveProductHeroUrl(product);
  const heroPresent = !!heroUrl;

  const { data: media } = await supabase
    .from("product_media")
    .select("type, file_url")
    .eq("product_id", product.id);

  const types = new Set((media ?? []).map((m) => String(m.type ?? "").toLowerCase()));
  const squarePresent =
    types.has("square_image") ||
    types.has("white_background") ||
    types.has("hero_image");

  return { heroPresent, heroUrl, squarePresent };
}

export const MEDIA_UPLOAD_PATH_DOC = UPLOAD_PATH_PATTERN;

export const MEDIA_BUCKET_OWNER_ACTION = `Apply migration ${LIVE_CENTRAL_MIGRATION_PRODUCT_MEDIA_AND_BOM} on live Central (tcxvcatsqqertcnycuop) to create bucket "${AI_STUDIO_MEDIA_BUCKET}" with public read and team-member write policies.`;
