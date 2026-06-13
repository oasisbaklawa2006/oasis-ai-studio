import { supabase } from "@/integrations/supabase/client";
import { AI_STUDIO_MEDIA_BUCKET } from "@/lib/productImage";
import { sanitizeMediaFileName } from "@/features/catalogueDrafts/mediaDraftBoundary";

export async function uploadFastCreateHero(file: File): Promise<string> {
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
