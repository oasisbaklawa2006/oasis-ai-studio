/**
 * Persistence for Catalogue Product AI Studio drafts. Talks only to
 * catalogue_ai_studio_drafts / catalogue_ai_studio_draft_audit_log — never touches `products`.
 * Ported from the wrong-repo reference implementation (Oasis-Baklawa-Central PR #225),
 * including the Bugbot-verified safety fixes for status-guarded transitions and conflict messaging.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  CatalogueDraftAuditRow,
  CatalogueDraftContentKey,
  CatalogueDraftPromptKey,
  CatalogueDraftRow,
} from "./catalogueDraftTypes";

const UNIQUE_VIOLATION = "23505";

const UNDER_REVIEW_BLOCKED_MESSAGE =
  "This draft is under review. Reject it or create a new version after review before editing.";

const STATUS_CHANGED_MESSAGE = "Draft status changed. Reload and try again.";

const SAVE_CONFLICT_MESSAGE = "Another draft was saved for this product. Reload latest draft and try again.";

type DraftContentAndPrompts = Record<CatalogueDraftContentKey, string> &
  Partial<Record<CatalogueDraftPromptKey, string>> & {
    export_bundle_preview?: string;
    source_snapshot?: Record<string, unknown>;
  };

export async function fetchLatestDraft(productId: string): Promise<CatalogueDraftRow | null> {
  const { data, error } = await supabase
    .from("catalogue_ai_studio_drafts")
    .select("*")
    .eq("product_id", productId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchDraftAuditLog(draftId: string): Promise<CatalogueDraftAuditRow[]> {
  const { data, error } = await supabase
    .from("catalogue_ai_studio_draft_audit_log")
    .select("*")
    .eq("draft_id", draftId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function insertAudit(
  draftId: string,
  action: string,
  fromStatus: string | null,
  toStatus: string | null,
  actorId: string | null,
): Promise<void> {
  const { error } = await supabase.from("catalogue_ai_studio_draft_audit_log").insert({
    draft_id: draftId,
    action,
    from_status: fromStatus,
    to_status: toStatus,
    actor_id: actorId,
  });
  if (error) throw new Error(error.message);
}

/**
 * Updates the current open DRAFT for this product, or starts the next version if the latest
 * draft is APPROVED/REJECTED (or none exists yet). Never touches a DRAFT belonging to another product.
 * Refuses outright while the latest draft is UNDER_REVIEW — a reviewer must act first, so this can
 * never race the partial-unique-index insert that only allows one open draft per product.
 */
export async function saveDraft(params: {
  productId: string;
  content: DraftContentAndPrompts;
  actorId: string | null;
}): Promise<CatalogueDraftRow> {
  const latest = await fetchLatestDraft(params.productId);

  if (latest && latest.status === "UNDER_REVIEW") {
    throw new Error(UNDER_REVIEW_BLOCKED_MESSAGE);
  }

  if (latest && latest.status === "DRAFT") {
    const { data, error } = await supabase
      .from("catalogue_ai_studio_drafts")
      .update({ ...params.content })
      .eq("id", latest.id)
      .eq("status", "DRAFT")
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error(STATUS_CHANGED_MESSAGE);
    await insertAudit(data.id, "SAVE_DRAFT", "DRAFT", "DRAFT", params.actorId);
    return data;
  }

  const nextVersion = latest ? latest.version_number + 1 : 1;
  const { data, error } = await supabase
    .from("catalogue_ai_studio_drafts")
    .insert({
      product_id: params.productId,
      version_number: nextVersion,
      status: "DRAFT",
      created_by: params.actorId,
      ...params.content,
    })
    .select("*")
    .single();
  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      // Re-check what actually exists now — a concurrent submit-for-review and a concurrent
      // first-save/version conflict are different situations and must not share one message.
      const recheck = await fetchLatestDraft(params.productId).catch(() => null);
      if (recheck && recheck.status === "UNDER_REVIEW") throw new Error(UNDER_REVIEW_BLOCKED_MESSAGE);
      throw new Error(SAVE_CONFLICT_MESSAGE);
    }
    throw new Error(error.message);
  }
  await insertAudit(data.id, latest ? "CREATE_NEW_VERSION" : "CREATE_DRAFT", latest?.status ?? null, "DRAFT", params.actorId);
  return data;
}

export async function submitDraftForReview(draftId: string, actorId: string | null): Promise<CatalogueDraftRow> {
  const { data, error } = await supabase
    .from("catalogue_ai_studio_drafts")
    .update({ status: "UNDER_REVIEW" })
    .eq("id", draftId)
    .eq("status", "DRAFT")
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(STATUS_CHANGED_MESSAGE);
  await insertAudit(draftId, "SUBMIT_FOR_REVIEW", "DRAFT", "UNDER_REVIEW", actorId);
  return data;
}

export async function approveDraft(draftId: string, actorId: string | null): Promise<CatalogueDraftRow> {
  const { data, error } = await supabase
    .from("catalogue_ai_studio_drafts")
    .update({
      status: "APPROVED",
      reviewed_by: actorId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: null,
    })
    .eq("id", draftId)
    .eq("status", "UNDER_REVIEW")
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(STATUS_CHANGED_MESSAGE);
  await insertAudit(draftId, "APPROVE", "UNDER_REVIEW", "APPROVED", actorId);
  return data;
}

export async function rejectDraft(
  draftId: string,
  actorId: string | null,
  reason: string,
): Promise<CatalogueDraftRow> {
  const { data, error } = await supabase
    .from("catalogue_ai_studio_drafts")
    .update({
      status: "REJECTED",
      reviewed_by: actorId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason,
    })
    .eq("id", draftId)
    .eq("status", "UNDER_REVIEW")
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(STATUS_CHANGED_MESSAGE);
  await insertAudit(draftId, "REJECT", "UNDER_REVIEW", "REJECTED", actorId);
  return data;
}
