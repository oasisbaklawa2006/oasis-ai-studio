/**
 * Core `approve_catalogue_media_submission` is intentionally fail-closed in PR06B until
 * approval mapping is finalized. AI Studio must not expose a knowingly nonfunctional Approve action.
 */
export const MEDIA_CATALOGUE_APPROVAL_BLOCKED_MESSAGE =
  "Media approval is not yet available — Core approval mapping is not finalized. Rejections remain available.";

export function isMediaCatalogueApprovalAvailable(): boolean {
  return false;
}
