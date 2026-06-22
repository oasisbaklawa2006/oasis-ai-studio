import { supabase } from "@/integrations/supabase/client";

export const BOM_RUNTIME_TABLE = "product_bom" as const;
export const BOM_MIGRATION_TABLE = "product_bom_items" as const;

export type BomTableProbeResult = {
  runtimeTableAvailable: boolean;
  migrationTableAvailable: boolean;
  errorMessage: string | null;
};

function isMissingRelationError(message: string): boolean {
  return /relation.*does not exist|could not find the table|schema cache/i.test(message);
}

/**
 * Probe which BOM tables exist on the connected Supabase project.
 * BomBuilder writes to `product_bom` (Central runtime); migrations define `product_bom_items`.
 */
export async function probeBomTables(): Promise<BomTableProbeResult> {
  const runtime = await (supabase as any).from(BOM_RUNTIME_TABLE).select("id").limit(1);
  const migration = await (supabase as any).from(BOM_MIGRATION_TABLE).select("id").limit(1);

  const runtimeMissing = !!runtime.error && isMissingRelationError(runtime.error.message);
  const migrationMissing = !!migration.error && isMissingRelationError(migration.error.message);

  let errorMessage: string | null = null;
  if (runtimeMissing) {
    errorMessage =
      `BOM table "${BOM_RUNTIME_TABLE}" is not available on this database. ` +
      `Studio migration defines "${BOM_MIGRATION_TABLE}" — BOM lines cannot be saved until tables are unified (Phase 2b).`;
  } else if (runtime.error && !runtimeMissing) {
    errorMessage = runtime.error.message;
  }

  return {
    runtimeTableAvailable: !runtimeMissing && !runtime.error,
    migrationTableAvailable: !migrationMissing && !migration.error,
    errorMessage,
  };
}

export const BOM_TABLE_UNAVAILABLE_MESSAGE =
  "BOM persistence is unavailable — the product_bom table is missing on this database. Lines shown here are not saved to master data.";
