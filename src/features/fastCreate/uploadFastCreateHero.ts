import {
  IMAGE_MIME_TYPES,
  publicMediaUploadBlockReason,
  sanitizeMediaFileName,
  validateMediaFile,
} from "@/features/catalogueDrafts/mediaDraftBoundary";
import { supabase } from "@/integrations/supabase/client";
import { AI_STUDIO_MEDIA_BUCKET } from "@/lib/productImage";

export async function uploadFastCreateHero(file: File): Promise<string> {
  const validationError = validateMediaFile(file, IMAGE_MIME_TYPES);
  if (validationError) throw new Error(validationError);

  // Fast Create's hero is a pending PRODUCT DRAFT, not approved public media.
  // Never create a public Storage object merely to get a draft preview URL.
  const privateStagingRequired = publicMediaUploadBlockReason("raw");
  if (privateStagingRequired) throw new Error(privateStagingRequired);

  const folder = `fast-create/${crypto.randomUUID()}`;
  const path = `products/${folder}/raw/${Date.now()}-${sanitizeMediaFileName(file.name)}`;

  const { error } = await supabase.storage.from(AI_STUDIO_MEDIA_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) throw error;

  const { data } = supabase.storage.from(AI_STUDIO_MEDIA_BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error("Could not resolve public URL for uploaded image.");
  return data.publicUrl;
}
