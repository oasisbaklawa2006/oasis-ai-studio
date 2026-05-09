import { supabase } from "@/integrations/supabase/client";
import { hasPermission } from "@/shared/auth/centralPermissions";
import { draftTableMap, type DraftType } from "./draftTableMap";
export async function submitCatalogueDraft({ draftType, operation, payload, targetRecordId }: { draftType: DraftType; operation: "create" | "update" | "delete_request"; payload: Record<string, any>; targetRecordId?: string | null; }): Promise<{ ok: boolean; draftId?: string; message: string }> {
  const map = draftTableMap[draftType]; if (!map) return { ok: false, message: "Unsupported draft type" };
  if (!(await hasPermission(map.permission))) return { ok: false, message: "You do not have permission to submit this draft." };
  const { data: u } = await supabase.auth.getUser(); const uid = u.user?.id; if (!uid) return { ok: false, message: "Not authenticated" };
  const { data, error } = await (supabase as any).from(map.table).insert({ source_app: "catalogue_app", target_table: map.targetTable, target_record_id: targetRecordId ?? null, operation, payload, status: "pending_approval", submitted_by: uid }).select("id").single();
  if (error) return { ok: false, message: /permission|policy|rls/i.test(error.message) ? "Draft submission blocked by access policy." : error.message };
  return { ok: true, draftId: data?.id, message: "Draft submitted for approval." };
}
