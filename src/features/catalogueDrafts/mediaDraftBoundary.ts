import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AI_STUDIO_MEDIA_BUCKET } from "@/lib/productImage";
import { submitCatalogueDraft } from "./draftService";
import { draftTableMap } from "./draftTableMap";
import {
  canSubmitDraft,
  canWriteMasterDirectly,
  isCatalogueContributor,
} from "@/shared/auth/centralPermissions";
import type { Role } from "@/lib/permissions";

export type MediaWriteMode = "direct" | "draft" | "readonly";

export type MediaOperationIntent =
  | "create"
  | "delete_request"
  | "set_hero"
  | "clear_hero"
  | "replace_hero"
  | "url_import";

export const DIRECT_MEDIA_ROLES: Role[] = ["owner", "admin", "product_manager"];

export type MediaDraftPayloadInput = {
  productId: string | null;
  operationIntent: MediaOperationIntent;
  fileUrl?: string | null;
  storagePath?: string | null;
  type?: string | null;
  angle?: string | null;
  altText?: string | null;
  status?: string | null;
  source?: string | null;
  requestedHero?: boolean;
};

export const sanitizeMediaFileName = (fileName: string) =>
  fileName.replace(/[^a-zA-Z0-9._-]/g, "_");

export const buildDirectMediaPath = (folder: string, fileName: string) => {
  const ts = Date.now();
  return `products/${folder}/raw/${ts}-${sanitizeMediaFileName(fileName)}`;
};

export const buildStagingMediaPath = (folder: string, fileName: string) => {
  const ts = Date.now();
  return `products/${folder}/submissions/${ts}-${sanitizeMediaFileName(fileName)}`;
};

export const buildMediaDraftPayload = (input: MediaDraftPayloadInput) => ({
  scope: "product_media_asset" as const,
  product_id: input.productId,
  operation_intent: input.operationIntent,
  file_url: input.fileUrl ?? null,
  storage_path: input.storagePath ?? null,
  type: input.type ?? null,
  angle: input.angle ?? null,
  alt_text: input.altText ?? null,
  status: input.status ?? "raw",
  source: input.source ?? null,
  requested_hero: input.requestedHero ?? false,
});

export const mapIntentToDraftOperation = (
  intent: MediaOperationIntent
): "create" | "update" | "delete_request" => {
  if (intent === "delete_request") return "delete_request";
  if (intent === "set_hero" || intent === "clear_hero") return "update";
  return "create";
};

export const uploadMediaFileToStorage = async (path: string, file: File) =>
  supabase.storage.from(AI_STUDIO_MEDIA_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });

export const getMediaPublicUrl = (path: string) =>
  supabase.storage.from(AI_STUDIO_MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;

export const submitMediaCatalogueDraft = async (
  intent: MediaOperationIntent,
  input: MediaDraftPayloadInput,
  targetRecordId?: string | null
) =>
  submitCatalogueDraft({
    draftType: "media",
    operation: mapIntentToDraftOperation(intent),
    payload: buildMediaDraftPayload(input),
    targetRecordId: targetRecordId ?? null,
  });

export function useCatalogueMediaWriteMode(roles: Role[]) {
  const [writeMode, setWriteMode] = useState<MediaWriteMode>("readonly");

  useEffect(() => {
    (async () => {
      const roleList = roles as Role[];
      const hasDirect =
        roleList.some((r) => DIRECT_MEDIA_ROLES.includes(r)) || (await canWriteMasterDirectly());
      if (hasDirect) {
        setWriteMode("direct");
        return;
      }
      if (await isCatalogueContributor()) {
        const canSubmit = await canSubmitDraft(draftTableMap.media.permission);
        setWriteMode(canSubmit ? "draft" : "readonly");
        return;
      }
      setWriteMode("readonly");
    })();
  }, [roles]);

  const canMutate = writeMode === "direct" || writeMode === "draft";

  return { writeMode, canMutate };
}
