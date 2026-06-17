/** True when durable product_language_terms table is deployed in production. */
export function isProductLanguageTermsSchemaDeployed(): boolean {
  return import.meta.env.VITE_PRODUCT_LANGUAGE_TERMS_SCHEMA === "deployed";
}

export const LANGUAGE_TERMS_INFORMATIONAL_NOTICE =
  "Language discoverability is informational only until product_language_terms is deployed. It does not block catalogue publish or Central Sync.";
