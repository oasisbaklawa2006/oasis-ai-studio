/**
 * Browser capability acceptance policy for canonical Core project tcxvcatsqqertcnycuop.
 * Schema metadata rechecked on 2026-10-15; table presence alone is not acceptance.
 * Core audit_logs exists, but this workspace has no accepted scoped audit projection.
 *
 * False entries are intentionally disabled in the browser. They must only be
 * changed after the capability exists in production and its generated types,
 * RLS, and runtime acceptance checks are committed.
 */
export const PRODUCTION_CAPABILITIES = {
  auditLog: false,
  catalogues: false,
  catalogueCollections: false,
  featureFlags: false,
  hampers: false,
  importLogs: false,
  ingredients: false,
  integrationSettings: false,
  labels: false,
  searchProductsWithAliasesRpc: false,
  tags: false,
} as const;
