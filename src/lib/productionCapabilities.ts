/**
 * Read-only contract captured from canonical production project
 * tcxvcatsqqertcnycuop on 2026-07-15.
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
