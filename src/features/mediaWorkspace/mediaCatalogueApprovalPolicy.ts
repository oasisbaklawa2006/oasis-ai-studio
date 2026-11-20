/**
 * Core #406 deployed the media approval mapping. The reviewer-gated UI can call the
 * canonical RPC; backend reviewer authorization and atomic pending-state checks remain authoritative.
 */
export const MEDIA_CATALOGUE_APPROVAL_BLOCKED_MESSAGE =
  "This media requires verified publication from private staging before approval. Review and rejection remain available.";

export function isMediaCatalogueApprovalAvailable(): boolean {
  return true;
}

/** True when Approval Inbox / Media Review must hide the Approve action for a media draft. */
export function isMediaDraftApprovalUiBlocked(
  draftType: string,
  payload?: Record<string, unknown> | null,
): boolean {
  if (draftType !== "media") return false;
  if (!isMediaCatalogueApprovalAvailable()) return true;
  if (!payload) return false;
  // The current Core approval mapping ignores Storage provenance. Until its
  // publication contract is implemented, never submit these drafts as though
  // approval would promote the bytes or turn a bearer URL into a durable URL.
  if (payload.storage_path || payload.storagePath) return true;
  if (
    payload.bucket_id === "product-media-staging" ||
    payload.storage_bucket === "product-media-staging"
  )
    return true;
  const value = payload.file_url ?? payload.fileUrl;
  if (typeof value !== "string") return false;
  if (value.trim().toLowerCase().startsWith("private:")) return true;
  try {
    const path = decodeURIComponent(new URL(value).pathname).toLowerCase();
    return path.includes("/storage/v1/object/sign/") || path.includes("/product-media-staging/");
  } catch {
    // Invalid references cannot establish publication either.
    return true;
  }
}
