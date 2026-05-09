import { supabase } from "@/integrations/supabase/client";
import { hasPermission } from "@/shared/auth/centralPermissions";
import { draftTableMap, type DraftType } from "./draftTableMap";

type SubmitCatalogueDraftInput = {
  draftType: DraftType;
  operation: "create" | "update" | "delete_request";
  payload: Record<string, any>;
  targetRecordId?: string | null;
};

type SubmitCatalogueDraftResult = {
  ok: boolean;
  draftId?: string;
  message: string;
  error?: unknown;
};

export async function submitCatalogueDraft({
  draftType,
  operation,
  payload,
  targetRecordId,
}: SubmitCatalogueDraftInput): Promise<SubmitCatalogueDraftResult> {
  const map = draftTableMap[draftType];

  if (!map) {
    return {
      ok: false,
      message: "Unsupported draft type",
    };
  }

  const permitted = await hasPermission(map.permission);

  if (!permitted) {
    return {
      ok: false,
      message: "You do not have permission to submit this draft.",
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      message: "Not authenticated. Please sign in again.",
      error: userError,
    };
  }

  const nowIso = new Date().toISOString();

  const insertRow = {
    source_app: "catalogue_app",
    target_table: map.targetTable || "products",
    target_record_id: targetRecordId ?? null,
    operation,
    payload,
    status: "pending_approval",
    submitted_by: user.id,
    submitted_at: nowIso,
    created_at: nowIso,
    updated_at: nowIso,
  };

  if (import.meta.env.DEV) {
    console.log("[CatalogueDraft] auth user id:", user.id);
    console.log("[CatalogueDraft] insert table:", map.table);
    console.log("[CatalogueDraft] insert object:", insertRow);
  }

  const { data, error } = await (supabase as any)
    .from(map.table)
    .insert(insertRow)
    .select("id")
    .single();

  if (error) {
    if (import.meta.env.DEV) {
      console.error("[CatalogueDraft] insert failed:", error);
    }

    return {
      ok: false,
      message: error.message,
      error,
    };
  }

  if (import.meta.env.DEV) {
    console.log("[CatalogueDraft] insert success:", data);
  }

  return {
    ok: true,
    draftId: data?.id,
    message: "Submitted for approval. SKU and final master data will be reviewed by admin.",
  };
}
