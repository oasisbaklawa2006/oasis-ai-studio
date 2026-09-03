import { supabase } from "@/integrations/supabase/client";

export type MediaSubmissionStatus = "pending_approval" | "approved" | "rejected";

export type MediaSubmissionRow = {
  id: string;
  status: MediaSubmissionStatus;
  payload?: Record<string, unknown> | null;
  operation?: string | null;
  submitted_at?: string | null;
  submitted_by?: string | null;
  submitter_name?: string | null;
  submitter_email?: string | null;
  rejected_at?: string | null;
  rejection_reason?: string | null;
  reviewed_at?: string | null;
  target_record_id?: string | null;
};

const MEDIA_SUBMISSIONS_TABLE = "catalogue_media_submissions";
const APPROVE_RPC = "approve_catalogue_media_submission";
const REJECT_RPC = "reject_catalogue_media_submission";

export async function fetchMediaSubmissions(
  statuses: MediaSubmissionStatus[],
): Promise<MediaSubmissionRow[]> {
  const { data, error } = await (supabase as any)
    .from(MEDIA_SUBMISSIONS_TABLE)
    .select("*")
    .in("status", statuses)
    .order("submitted_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as MediaSubmissionRow[];
}

export async function approveMediaSubmission(submissionId: string): Promise<{ ok: boolean; message: string }> {
  const { error } = await (supabase as any).rpc(APPROVE_RPC, { draft_id: submissionId });
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
  const { error } = await (supabase as any).rpc(REJECT_RPC, {
    draft_id: submissionId,
    reason: trimmed,
  });
  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true, message: "Rejected" };
}
