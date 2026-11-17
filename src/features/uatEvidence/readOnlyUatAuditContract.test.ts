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

  it("permits only live-verified read-only membership and role RPCs via POST", () => {
    const base = "https://tcxvcatsqqertcnycuop.supabase.co/rest/v1/rpc/";
    for (const rpc of [
      "has_ai_studio_permission_v1",
      "can_manage_ai_studio_access_v1",
      "is_catalogue_reviewer",
      "is_admin",
      "get_my_role_keys",
    ]) {
      expect(isForbiddenReadOnlyUatPersistenceRequest("POST", `${base}${rpc}`)).toBe(false);
      expect(isForbiddenReadOnlyUatPersistenceRequest("PATCH", `${base}${rpc}`)).toBe(true);
      expect(isForbiddenReadOnlyUatPersistenceRequest("DELETE", `${base}${rpc}`)).toBe(true);
    }
    for (const rpc of [
      "set_ai_studio_access_v1",
      "approve_catalogue_draft_internal",
      "is_admin_write",
      "get_my_role_keys_update",
      "get_my_role_keys/extra",
    ]) {
      expect(isForbiddenReadOnlyUatPersistenceRequest("POST", `${base}${rpc}`)).toBe(true);
    }
  });

  it("allows only product-media Storage listing, not upload, move, copy or delete", () => {
    const root = "https://tcxvcatsqqertcnycuop.supabase.co/storage/v1/object/";
    const listUrl = `${root}list/product-media`;
    expect(isForbiddenReadOnlyUatPersistenceRequest("POST", listUrl)).toBe(false);
    for (const path of [
      "list/product-media-raw",
      "list/product-media-staging",
      "product-media/products/image.jpg",
      "move",
      "copy",
      "sign/product-media/products/image.jpg",
    ]) {
      expect(isForbiddenReadOnlyUatPersistenceRequest("POST", `${root}${path}`)).toBe(true);
    }
    expect(isForbiddenReadOnlyUatPersistenceRequest("DELETE", listUrl)).toBe(true);
    expect(isForbiddenReadOnlyUatPersistenceRequest("PUT", listUrl)).toBe(true);
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
