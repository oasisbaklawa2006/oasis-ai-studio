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


  it("allows only the verified Core membership resolver RPC while rejecting writes", () => {
    const base = "https://xyz.supabase.co/rest/v1/rpc/";
    expect(isForbiddenReadOnlyUatPersistenceRequest("POST", base + "has_ai_studio_permission_v1")).toBe(false);
    expect(isForbiddenReadOnlyUatPersistenceRequest("post", base + "has_ai_studio_permission_v1?p_key=ai_studio.app.access")).toBe(false);
    for (const name of [
      "set_ai_studio_access_v1",
      "has_ai_studio_permission_v2",
      "has_ai_studio_permission_v1_write",
      "write_product",
    ]) {
      expect(isForbiddenReadOnlyUatPersistenceRequest("POST", base + name)).toBe(true);
    }
    expect(isForbiddenReadOnlyUatPersistenceRequest("PATCH", "https://xyz.supabase.co/rest/v1/ai_studio_user_access")).toBe(true);
    expect(isForbiddenReadOnlyUatPersistenceRequest("DELETE", "https://xyz.supabase.co/storage/v1/object/media/a.png")).toBe(true);
    expect(collectReadOnlyUatContractViolations([
      { method: "POST", url: base + "has_ai_studio_permission_v1" },
      { method: "POST", url: base + "set_ai_studio_access_v1" },
    ])).toEqual(["POST " + base + "set_ai_studio_access_v1"]);
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
