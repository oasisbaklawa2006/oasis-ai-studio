import { supabase } from "@/integrations/supabase/client";
import { hasPermission } from "@/shared/auth/centralPermissions";
import { draftTableMap, type DraftType } from "./draftTableMap";

export async function submitCatalogueDraft({
  draftType,
  operation,
  payload,
  targetRecordId,
}: {
  draftType: DraftType;
  operation: "create" | "update" | "delete_request";
  payload: Record<string, any>;
  targetRecordId?: string | null;
}): Promise<{ ok: boolean; draftId?: string; message: string; error?: unknown }> {
  const map = draftTableMap[draftType];
  if (!map) return { ok: false, message: "Unsupported draft type" };
  if (!(await hasPermission(map.permission))) {
    return { ok: false, message: "You do not have permission to submit this draft." };
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user?.id) {
    return { ok: false, message: "Not authenticated. Please sign in again." };
  }

  if (import.meta.env.DEV) console.log("[draftService] auth user id", user.id);

  const now = new Date().toISOString();
  const insertObject = {
    source_app: "catalogue_app",
    target_table: "products",
    target_record_id: targetRecordId ?? null,
    operation,
    payload,
    status: "pending_approval",
    submitted_by: user.id,
    submitted_at: now,
    created_at: now,
    updated_at: now,
  };

  if (import.meta.env.DEV) console.log("[draftService] draft insert object", insertObject);

  const { data, error } = await (supabase as any)
    .from(map.table)
    .insert(insertObject)
    .select("id")
    .single();

  if (import.meta.env.DEV) console.log("[draftService] supabase insert result/error", { data, error });

  if (error) {
    return { ok: false, message: error.message, error };
  }

  return { ok: true, draftId: data?.id, message: "Submitted for approval. SKU and final master data will be reviewed by admin." };
}
