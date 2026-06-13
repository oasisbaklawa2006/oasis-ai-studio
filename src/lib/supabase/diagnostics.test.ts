import { describe, expect, it } from "vitest";
import {
  diagnoseSupabaseFailure,
  formatSupabaseDiagnostic,
  formatSupabaseFailure,
} from "@/lib/supabase/diagnostics";

describe("formatSupabaseDiagnostic", () => {
  it("formats PGRST204 missing column", () => {
    const msg = formatSupabaseDiagnostic(
      {
        code: "PGRST204",
        message: "Could not find the 'b2b_price_basis' column of 'products' in the schema cache",
      },
      "Product save",
    );
    expect(msg).toContain("Live schema mismatch");
    expect(msg).toContain("b2b_price_basis");
    expect(msg).toContain("products");
  });

  it("formats missing table diagnostic", () => {
    const failure = diagnoseSupabaseFailure(
      { code: "42P01", message: 'relation "catalogue_versions" does not exist' },
      "catalogue_versions",
    );
    expect(failure?.kind).toBe("missing_table");
    expect(formatSupabaseFailure(failure!)).toContain("Required table/view is missing");
  });

  it("formats RLS diagnostic", () => {
    const msg = formatSupabaseDiagnostic(
      { code: "42501", message: "new row violates row-level security policy" },
      "product_media insert",
    );
    expect(msg).toBe("Permission/RLS blocked this action.");
  });

  it("formats bucket missing diagnostic", () => {
    const msg = formatSupabaseDiagnostic(
      { message: "Bucket not found: product-media" },
      "media upload",
    );
    expect(msg).toContain("missing or inaccessible");
    expect(msg).toContain("product-media");
    expect(msg).toContain("20260613130000_live_central_product_media_bucket_and_bom_required");
  });

  it("formats bom_required PGRST204 with live central migration owner action", () => {
    const msg = formatSupabaseDiagnostic(
      {
        code: "PGRST204",
        message: "Could not find the 'bom_required' column of 'products' in the schema cache",
      },
      "Product save",
    );
    expect(msg).toContain("bom_required");
    expect(msg).toContain("products");
    expect(msg).toContain("20260613130000_live_central_product_media_bucket_and_bom_required");
    expect(msg).toContain("tcxvcatsqqertcnycuop");
  });

  it("formats network failure diagnostic", () => {
    const msg = formatSupabaseDiagnostic(
      { message: "Failed to fetch" },
      "products load",
    );
    expect(msg).toBe("Supabase network connection failed.");
  });

  it("uses deployment mismatch wording for catalogue versions unknown errors", () => {
    const msg = formatSupabaseDiagnostic(
      { code: "XX000", message: "something unexpected" },
      "Catalogue versions query failed",
    );
    expect(msg).toContain("Catalogue versions query failed");
    expect(msg).toContain("missing table, RLS policy, or deployment mismatch");
    expect(msg).not.toContain("connectivity is restored");
  });
});
