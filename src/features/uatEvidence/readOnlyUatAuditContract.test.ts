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
