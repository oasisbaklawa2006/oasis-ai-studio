import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { CatalogueDraftRow, ExtendedDatabase } from "@/integrations/supabase/types.extensions";

export type MediaSubmissionStatus = "pending_approval" | "approved" | "rejected";

/** Row shape for media review desk — extends catalogue draft contract with optional join fields. */
export type MediaSubmissionRow = CatalogueDraftRow & {
  submitter_name?: string | null;
  submitter_email?: string | null;
  rejection_reason?: string | null;
  rejected_at?: string | null;
};

const draftDb = supabase as unknown as SupabaseClient<ExtendedDatabase>;

const MEDIA_SUBMISSIONS_TABLE = "catalogue_media_submissions" as const;

export async function fetchMediaSubmissions(
  statuses: MediaSubmissionStatus[],
): Promise<MediaSubmissionRow[]> {
  const { data, error } = await draftDb
    .from(MEDIA_SUBMISSIONS_TABLE)
    .select("*")
    .in("status", statuses)
    .order("submitted_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as MediaSubmissionRow[];
}

export async function approveMediaSubmission(
  submissionId: string,
): Promise<{ ok: boolean; message: string }> {
  const { error } = await draftDb.rpc("approve_catalogue_media_submission", {
    draft_id: submissionId,
  });
  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true, message: "Approved" };
}

export async function rejectMediaSubmission(
  submissionId: string,
  reason: string,
): Promise<{ ok: boolean; message: string }> {
  const trimmed = reason.trim();
  if (!trimmed) {
    return { ok: false, message: "Rejection reason is required" };
  }
  const { error } = await draftDb.rpc("reject_catalogue_media_submission", {
    draft_id: submissionId,
    reason: trimmed,
  });
  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true, message: "Rejected" };
}
