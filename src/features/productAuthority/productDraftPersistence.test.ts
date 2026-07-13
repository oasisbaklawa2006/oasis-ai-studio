import { describe, expect, it, vi } from "vitest";
import {
  PRODUCT_DRAFT_SCHEMA_VERSION,
  canAutosaveProductDraft,
  createProductDraftEnvelope,
  createProductDraftIdempotencyKey,
  parseProductDraft,
  writeProductDraft,
} from "./productDraftPersistence";

describe("product draft persistence", () => {
  it("reads a versioned envelope and preserves its stable idempotency key", () => {
    const envelope = createProductDraftEnvelope("draft-a", { product_name: "A" }, "idem-a", () => new Date("2026-07-13T00:00:00Z"));
    const result = parseProductDraft(JSON.stringify(envelope), "draft-a", "replacement");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.envelope.idempotencyKey).toBe("idem-a");
      expect(result.envelope.data.product_name).toBe("A");
    }
  });

  it("restores legacy unwrapped form data with a newly assigned stable key", () => {
    const result = parseProductDraft('{"product_name":"Legacy"}', "draft-new", "idem-legacy");
    expect(result).toMatchObject({ ok: true, legacy: true, envelope: { idempotencyKey: "idem-legacy" } });
  });

  it("rejects corrupt JSON", () => {
    expect(parseProductDraft("{", "draft-a", "idem")).toMatchObject({ ok: false, reason: "corrupt" });
  });

  it("rejects an incompatible schema", () => {
    const raw = JSON.stringify({ schemaVersion: PRODUCT_DRAFT_SCHEMA_VERSION + 1, routeKey: "draft-a", data: {} });
    expect(parseProductDraft(raw, "draft-a", "idem")).toMatchObject({ ok: false, reason: "schema_mismatch" });
  });

  it("blocks a draft stored under the wrong route identity", () => {
    const raw = JSON.stringify(createProductDraftEnvelope("draft-a", { product_name: "A" }, "idem-a"));
    expect(parseProductDraft(raw, "draft-b", "idem-b")).toMatchObject({ ok: false, reason: "route_mismatch" });
  });

  it("does not autosave old form state into a route that has not restored", () => {
    expect(canAutosaveProductDraft("draft-a", "draft-b", true)).toBe(false);
    expect(canAutosaveProductDraft(null, "draft-b", true)).toBe(false);
    expect(canAutosaveProductDraft("draft-b", "draft-b", true)).toBe(true);
  });

  it("does not recreate a cleared draft from clean post-save form hydration", () => {
    expect(canAutosaveProductDraft("draft-b", "draft-b", false)).toBe(false);
  });

  it("surfaces storage failures as a pure result", () => {
    const storage = { setItem: vi.fn(() => { throw new DOMException("Quota exceeded", "QuotaExceededError"); }) };
    const result = writeProductDraft(storage, "key", createProductDraftEnvelope("key", {}, "idem"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("could not be saved");
  });

  it("uses the supplied id generator", () => {
    expect(createProductDraftIdempotencyKey(() => "stable-id")).toBe("stable-id");
  });
});
