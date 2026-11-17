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
// Live Core role and permission lookups use STABLE SQL. The SKU preview is a
// SELECT-only PL/pgSQL calculation that neither reserves nor persists a SKU.
// PostgREST transports these read-only functions as POST. Exact names only.
const READ_ONLY_RPC_FUNCTIONS = new Set([
  "get_current_user_roles",
  "generate_oasis_sku",
  "has_ai_studio_permission_v1",
  "can_manage_ai_studio_access_v1",
  "has_catalogue_permission",
  "is_catalogue_reviewer",
  "is_admin",
  "get_my_role_keys",
  "can_write_product_master",
]);

/**
 * Returns true when a network request would violate the read-only audit contract.
 * Auth token refresh and read-only GET/HEAD traffic are permitted.
 */
export function isForbiddenReadOnlyUatPersistenceRequest(method: string, url: string): boolean {
  const upper = method.toUpperCase();
  if (!MUTATING_HTTP_METHODS.has(upper)) return false;

  if (/supabase\.co/i.test(url)) {
    // Supabase Storage uses POST for object listing (a read). This one exact
    // bucket/list route is allowed; uploads, deletes, moves and copies are not.
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return true;
    }
    const isSupabaseHost = parsed.hostname.endsWith(".supabase.co");
    if (isSupabaseHost && parsed.pathname.startsWith("/auth/v1/")) return false;

    if (/^\/storage\/v1\/object(?:\/|$)/i.test(parsed.pathname)) {
      return !(
        upper === "POST" &&
        isSupabaseHost &&
        parsed.pathname === "/storage/v1/object/list/product-media"
      );
    }
    const rpcName = parsed.pathname.match(/^\/rest\/v1\/rpc\/([^/]+)$/)?.[1];
    if (rpcName && isSupabaseHost) {
      return upper !== "POST" || !READ_ONLY_RPC_FUNCTIONS.has(rpcName);
    }
    if (/^\/rest\/v1(?:\/|$)/i.test(parsed.pathname)) return true;
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
