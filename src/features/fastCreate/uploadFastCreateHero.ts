import { supabase } from "@/integrations/supabase/client";
import { AI_STUDIO_MEDIA_BUCKET } from "@/lib/productImage";
import { sanitizeMediaFileName } from "@/features/catalogueDrafts/mediaDraftBoundary";
import {
  assertRenditionUploadable,
  optimizeImageForProfile,
  selectCatalogueUploadProfile,
  type ImageOptimizationReport,
} from "@/features/mediaOptimization/browserImageOptimizer";

export async function uploadFastCreateHero(file: File): Promise<{
  url: string;
  report: ImageOptimizationReport;
}> {
  const optimized = await optimizeImageForProfile(
    file,
    selectCatalogueUploadProfile({ destination: "catalogue" }),
  );
  assertRenditionUploadable(optimized.report);
  const folder = `fast-create/${crypto.randomUUID()}`;
  const path = `products/${folder}/raw/${Date.now()}-${sanitizeMediaFileName(optimized.file.name)}`;

  const { error } = await supabase.storage.from(AI_STUDIO_MEDIA_BUCKET).upload(path, optimized.file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) throw error;

  const { data } = supabase.storage.from(AI_STUDIO_MEDIA_BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error("Could not resolve public URL for uploaded image.");
  return { url: data.publicUrl, report: optimized.report };
}
