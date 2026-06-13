import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LIVE_CENTRAL_MIGRATION_PRODUCT_MEDIA_AND_BOM,
  LIVE_CENTRAL_SUPABASE_PROJECT_REF,
} from "@/features/productAuthority/liveProductsSchema";
import { LIVE_PRODUCTS_WRITE_ALLOWLIST } from "@/features/productAuthority/productSchemaAdapter";
import { AI_STUDIO_MEDIA_BUCKET } from "@/lib/productImage";
import { getSupabaseProjectRef } from "@/shared/supabase/health";

const MIGRATION_PATH = resolve(
  import.meta.dirname,
  "../../../supabase/migrations/20260613130000_live_central_product_media_bucket_and_bom_required.sql",
);

describe("live central deploy contract", () => {
  it("ships idempotent migration for product-media bucket and bom_required", () => {
    const sql = readFileSync(MIGRATION_PATH, "utf8");
    expect(sql).toContain("'product-media'");
    expect(sql).toContain("bom_required");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS bom_required");
    expect(sql).toContain("DROP POLICY IF EXISTS");
    expect(sql).toContain("is_team_member");
  });

  it("documents live Central project ref in migration SQL", () => {
    const sql = readFileSync(MIGRATION_PATH, "utf8");
    expect(sql).toContain(LIVE_CENTRAL_SUPABASE_PROJECT_REF);
  });

  it("keeps bom_required in live products write allowlist after migration", () => {
    expect(LIVE_PRODUCTS_WRITE_ALLOWLIST.has("bom_required")).toBe(true);
  });

  it("uses canonical product-media bucket id", () => {
    expect(AI_STUDIO_MEDIA_BUCKET).toBe("product-media");
    expect(LIVE_CENTRAL_MIGRATION_PRODUCT_MEDIA_AND_BOM).toContain("product_media");
  });

  it("env project ref matches documented Central when configured", () => {
    const ref = getSupabaseProjectRef();
    // Vitest/CI uses placeholder URL; live preview must point at Central.
    if (!ref || ref === "test-project") return;
    expect(ref).toBe(LIVE_CENTRAL_SUPABASE_PROJECT_REF);
  });
});
