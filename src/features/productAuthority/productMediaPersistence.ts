import { supabase } from "@/integrations/supabase/client";
import { AI_STUDIO_MEDIA_BUCKET } from "@/lib/productImage";

/** Canonical uploader media type → human label (single source for UI). */
export const MEDIA_TYPE_LABELS: Record<string, string> = {
  raw_photo: "Raw photo",
  hero_image: "Hero image",
  white_background: "White background",
  lifestyle: "Lifestyle",
  closeup: "Close-up",
  side_angle: "Side angle",
  top_angle: "Top angle",
  "45_angle": "45° angle",
  hamper_open: "Hamper open",
  hamper_closed: "Hamper closed",
  video: "Video",
  label_image: "Label image",
  source_pdf_page: "Source PDF page",
};

export function mediaTypeLabel(type: string | null | undefined): string {
  if (!type) return "Unknown";
  return MEDIA_TYPE_LABELS[type] ?? type.replace(/_/g, " ");
}

export function formatMediaStorageError(error: { message?: string } | null): string {
  const msg = error?.message?.trim() || "Storage upload failed";
  if (/bucket not found|not exist|404/i.test(msg)) {
    return `Storage bucket "${AI_STUDIO_MEDIA_BUCKET}" is missing or inaccessible: ${msg}`;
  }
  if (/row-level security|\bRLS\b|policy/i.test(msg)) {
    return `Storage upload blocked by security policy: ${msg}`;
  }
  if (/payload too large|entity too large/i.test(msg)) {
    return `File too large for storage: ${msg}`;
  }
  if (/invalid.*mime|mime type/i.test(msg)) {
    return `File type not allowed in storage: ${msg}`;
  }
  return msg;
}

export function formatMediaInsertError(error: { message?: string } | null): string {
  const detail = error?.message?.trim();
  if (!detail) return "File uploaded but media row was not saved.";
  if (/row-level security|\bRLS\b|policy/i.test(detail)) {
    return `File uploaded but media row was not saved. Database insert blocked by security policy: ${detail}`;
  }
  if (/foreign key|product_id/i.test(detail)) {
    return `File uploaded but media row was not saved. Invalid or missing product: ${detail}`;
  }
  return `File uploaded but media row was not saved. ${detail}`;
}

export type ProductMediaInsertInput = {
  product_id: string | null;
  file_url: string;
  type: string;
  angle?: string | null;
  alt_text?: string | null;
  status?: string;
};

export async function insertProductMediaRow(input: ProductMediaInsertInput) {
  const { data, error } = await supabase
    .from("product_media")
    .insert({
      product_id: input.product_id || null,
      file_url: input.file_url,
      type: input.type,
      angle: input.angle ?? null,
      alt_text: input.alt_text ?? null,
      status: input.status ?? "raw",
    })
    .select("*")
    .single();

  if (error) {
    return { ok: false as const, error, message: formatMediaInsertError(error) };
  }
  return { ok: true as const, data };
}
