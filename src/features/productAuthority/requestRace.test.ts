import { describe, expect, it } from "vitest";
import { isCurrentAsyncRequest } from "./requestRace";

describe("isCurrentAsyncRequest (Defect 2 regression)", () => {
  it("normal single-product load — the only request in flight is current", () => {
    const latestId = "product-a";
    expect(isCurrentAsyncRequest("product-a", false, latestId)).toBe(true);
  });

  it("A starts, B starts, B resolves, A resolves late — B remains displayed", () => {
    // A starts: latestId = "A".
    let latestId: string | null = "product-a";
    // B starts before A resolves: latestId becomes "B" (A's effect instance is cleaned up).
    const aCancelled = true;
    latestId = "product-b";
    const bCancelled = false;

    // B resolves first — still current.
    expect(isCurrentAsyncRequest("product-b", bCancelled, latestId)).toBe(true);
    // A resolves late — superseded on both counts (cancelled AND no longer latestId).
    expect(isCurrentAsyncRequest("product-a", aCancelled, latestId)).toBe(false);
  });

  it("A starts, B starts, A errors — the stale A error must not be treated as current", () => {
    const latestId = "product-b";
    const aCancelled = true;
    expect(isCurrentAsyncRequest("product-a", aCancelled, latestId)).toBe(false);
  });

  it("superseded A finalizer does not read as current, so it cannot clear B's loading state", () => {
    // Once B has started, A's ref-based identity check alone already fails even before
    // considering cancellation — this proves the guard doesn't depend on cancellation alone.
    const latestId = "product-b";
    expect(isCurrentAsyncRequest("product-a", false, latestId)).toBe(false);
  });

  it("unmount during request (no id change) — cancelled flag alone marks it stale", () => {
    // Same id remains the "latest" (no newer request started), but the effect instance was
    // cleaned up on unmount — the ref-only check would incorrectly say "current" here,
    // which is exactly why `cancelled` is tracked independently.
    const latestId = "product-a";
    const cancelledOnUnmount = true;
    expect(isCurrentAsyncRequest("product-a", cancelledOnUnmount, latestId)).toBe(false);
  });

  it("a request is only current when neither cancelled nor superseded", () => {
    expect(isCurrentAsyncRequest("x", false, "x")).toBe(true);
    expect(isCurrentAsyncRequest("x", true, "x")).toBe(false);
    expect(isCurrentAsyncRequest("x", false, "y")).toBe(false);
    expect(isCurrentAsyncRequest("x", true, "y")).toBe(false);
  });
});
