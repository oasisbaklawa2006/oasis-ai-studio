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
// Core public.has_ai_studio_permission_v1(text) is a STABLE, SELECT-only permission
// resolver (verified against the live Core pg_proc definition and grants on
// 2026-11-17). PostgREST transports RPC calls as POST even for read-only SQL.
// Keep this a closed list: an unverified RPC is treated as a mutation.
const READ_ONLY_RPC_FUNCTIONS = new Set([
  "get_current_user_roles",
  "generate_oasis_sku",
  "has_ai_studio_permission_v1",
]);

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
    const rpcName = url.match(/supabase\.co\/rest\/v1\/rpc\/([^/?#]+)/i)?.[1].toLowerCase();
    if (rpcName) return !READ_ONLY_RPC_FUNCTIONS.has(rpcName);
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
