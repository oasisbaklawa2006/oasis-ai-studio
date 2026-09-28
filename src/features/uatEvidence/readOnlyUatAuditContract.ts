/**
 * Read-only UAT audit contract — no persistence, uploads, approvals, or publication mutations.
 */

export const READ_ONLY_UAT_SAFETY_STATEMENT =
  "Read-only: no Save/Create/Approve/Reject/Upload/Publish/Activation actions executed; no storage or REST writes.";

/** Labels that must never be activated during read-only UAT evidence collection. */
export const READ_ONLY_UAT_FORBIDDEN_CONTROL_LABELS: readonly string[] = [
  "Create Product Draft",
  "Save",
  "Approve",
  "Reject",
  "Publish",
  "Submit URL for approval",
  "Save URL",
  "Add media asset",
];

const MUTATING_HTTP_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Returns true when a network request would violate the read-only audit contract.
 * Auth token refresh and read-only GET/HEAD traffic are permitted.
 */
export function isForbiddenReadOnlyUatPersistenceRequest(method: string, url: string): boolean {
  const upper = method.toUpperCase();
  if (!MUTATING_HTTP_METHODS.has(upper)) return false;

  if (/supabase\.co\/auth\/v1\//i.test(url)) return false;

  if (/supabase\.co/i.test(url)) {
    if (/storage\/v1\/object/i.test(url)) return true;
    if (/rest\/v1\/rpc\//i.test(url)) return true;
    if (/rest\/v1\//i.test(url)) return true;
  }

  return false;
}

export function collectReadOnlyUatContractViolations(
  requests: { method: string; url: string }[],
): string[] {
  const violations: string[] = [];
  for (const req of requests) {
    if (isForbiddenReadOnlyUatPersistenceRequest(req.method, req.url)) {
      violations.push(`${req.method} ${req.url}`);
    }
  }
  return [...new Set(violations)];
}
