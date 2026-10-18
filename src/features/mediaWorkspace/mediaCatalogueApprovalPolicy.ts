/**
 * Core #406 deployed the media approval mapping. The reviewer-gated UI can call the
 * canonical RPC; backend reviewer authorization and atomic pending-state checks remain authoritative.
 */
export const MEDIA_CATALOGUE_APPROVAL_BLOCKED_MESSAGE =
  "Media approval is not yet available — Core approval mapping is not finalized. Rejections remain available.";

export function isMediaCatalogueApprovalAvailable(): boolean {
  return true;
}

/** True when Approval Inbox / Media Review must hide the Approve action for a media draft. */
export function isMediaDraftApprovalUiBlocked(draftType: string): boolean {
  return draftType === "media" && !isMediaCatalogueApprovalAvailable();
}
