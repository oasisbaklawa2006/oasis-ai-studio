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
  // PostgREST/Core treats any explicit nonempty storage path as private
  // provenance, including values that happen to be falsy in JavaScript.
  const hasStoragePath = (path: unknown) => path != null && String(path) !== "";
  if (hasStoragePath(payload.storage_path) || hasStoragePath(payload.storagePath)) return true;
  const inStaging = (bucket: unknown) =>
    typeof bucket === "string" && bucket.trim().toLowerCase() === "product-media-staging";
  if (inStaging(payload.bucket_id) || inStaging(payload.storage_bucket)) return true;
  const value = payload.file_url ?? payload.fileUrl;
  // A metadata-only update may inherit an existing durable URL from Core.
  // An explicitly supplied malformed reference is never a publishable URL.
  if (value == null) return false;
  if (typeof value !== "string" || !value.trim()) return true;
  // Core #588 checks the URL's *request path* only for raw dot segments.
  // Query/fragment text is not a filesystem path and must not cause an
  // over-block; URL() normalizes traversal, so inspect raw path first.
  const rawPath = /^(?:https?):\/\/[^/?#]+([^?#]*)/i.exec(value)?.[1] ?? "";
  if (value.includes("%") || value.includes("\\") || /(^|\/)\.{1,2}(\/|$)/.test(rawPath))
    return true;
  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      !url.hostname ||
      url.username ||
      url.password
    )
      return true;
    const path = url.pathname.toLowerCase();
    // Keep parity with Core's effective-reference hold: signed/authenticated
    // object AND image-transform routes are private. A staging-like word in
    // an unrelated public CDN filename is not a Storage bucket segment.
    return (
      /storage\/v1\/(object|render\/image)\/(sign|authenticated)\//.test(path) ||
      /storage\/v1\/(object|render\/image)\/(public|sign|authenticated)\/product-media-staging(\/|$)/.test(
        path,
      )
    );
  } catch {
    // Invalid references cannot establish publication either.
    return true;
  }
}
