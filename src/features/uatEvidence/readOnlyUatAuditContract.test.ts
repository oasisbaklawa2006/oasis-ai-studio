import { describe, expect, it } from "vitest";
import {
  collectReadOnlyUatContractViolations,
  isForbiddenReadOnlyUatPersistenceRequest,
  READ_ONLY_UAT_FORBIDDEN_CONTROL_LABELS,
  READ_ONLY_UAT_SAFETY_STATEMENT,
} from "./readOnlyUatAuditContract";

describe("readOnlyUatAuditContract", () => {
  it("documents the read-only safety statement", () => {
    expect(READ_ONLY_UAT_SAFETY_STATEMENT).toMatch(/read-only/i);
    expect(READ_ONLY_UAT_FORBIDDEN_CONTROL_LABELS.length).toBeGreaterThan(0);
  });

  it("allows auth token refresh but blocks Supabase storage and REST writes", () => {
    expect(
      isForbiddenReadOnlyUatPersistenceRequest(
        "POST",
        "https://xyz.supabase.co/auth/v1/token?grant_type=refresh_token",
      ),
    ).toBe(false);
    expect(
      isForbiddenReadOnlyUatPersistenceRequest(
        "POST",
        "https://xyz.supabase.co/storage/v1/object/product-media/foo.jpg",
      ),
    ).toBe(true);
    expect(
      isForbiddenReadOnlyUatPersistenceRequest(
        "POST",
        "https://xyz.supabase.co/rest/v1/product_media",
      ),
    ).toBe(true);
    expect(
      isForbiddenReadOnlyUatPersistenceRequest(
        "POST",
        "https://xyz.supabase.co/rest/v1/rpc/get_current_user_roles",
      ),
    ).toBe(false);
    expect(
      isForbiddenReadOnlyUatPersistenceRequest(
        "POST",
        "https://xyz.supabase.co/rest/v1/rpc/generate_oasis_sku",
      ),
    ).toBe(false);
    // Live Core verifies this is a STABLE SELECT-only resolver. Its POST
    // transport must not prevent the protected Studio shell from loading.
    expect(
      isForbiddenReadOnlyUatPersistenceRequest(
        "POST",
        "https://xyz.supabase.co/rest/v1/rpc/has_ai_studio_permission_v1",
      ),
    ).toBe(false);
    // Exact RPC name matching: no prefix/suffix, query-string, or wildcard bypass.
    for (const rpc of [
      "has_ai_studio_permission_v1_write",
      "set_ai_studio_access_v1",
      "approve_catalogue_media_submission",
      "write_product",
    ]) {
      expect(
        isForbiddenReadOnlyUatPersistenceRequest(
          "POST",
          `https://xyz.supabase.co/rest/v1/rpc/${rpc}`,
        ),
      ).toBe(true);
    }
    expect(
      isForbiddenReadOnlyUatPersistenceRequest(
        "POST",
        "https://xyz.supabase.co/rest/v1/rpc/write_product?hint=has_ai_studio_permission_v1",
      ),
    ).toBe(true);
    expect(
      isForbiddenReadOnlyUatPersistenceRequest(
        "POST",
        "https://xyz.supabase.co/rest/v1/rpc/write_product",
      ),
    ).toBe(true);
    expect(
      isForbiddenReadOnlyUatPersistenceRequest(
        "GET",
        "https://xyz.supabase.co/rest/v1/product_media?select=id",
      ),
    ).toBe(false);
  });

  it("collects unique persistence violations from request log", () => {
    const violations = collectReadOnlyUatContractViolations([
      { method: "GET", url: "https://xyz.supabase.co/rest/v1/products" },
      { method: "POST", url: "https://xyz.supabase.co/rest/v1/product_media" },
      { method: "POST", url: "https://xyz.supabase.co/rest/v1/product_media" },
    ]);
    expect(violations).toHaveLength(1);
  });
});
