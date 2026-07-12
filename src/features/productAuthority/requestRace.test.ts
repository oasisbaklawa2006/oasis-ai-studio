import { describe, expect, it } from "vitest";
import { isCurrentAsyncRequest, isSupersededById, shouldFetchById } from "./requestRace";

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

describe("isSupersededById (Bugbot regression on PR #84: unmount blocked hero parent sync)", () => {
  it("is not superseded when the id is unchanged, regardless of unmount — unlike isCurrentAsyncRequest, it takes no cancelled flag at all", () => {
    expect(isSupersededById("product-a", "product-a")).toBe(false);
  });

  it("is superseded once a different id has become latest (a genuine product switch)", () => {
    expect(isSupersededById("product-a", "product-b")).toBe(true);
  });

  it("is superseded when nothing is latest at all", () => {
    expect(isSupersededById("product-a", null)).toBe(true);
  });
});

describe("shouldFetchById (Bugbot regression on PR #77)", () => {
  it("fetches a not-yet-loaded existing id", () => {
    expect(shouldFetchById(false, "product-a", null)).toBe(true);
  });

  it("does not fetch for a new/placeholder route", () => {
    expect(shouldFetchById(true, "new", null)).toBe(false);
  });

  it("does not fetch when there is no id", () => {
    expect(shouldFetchById(false, undefined, null)).toBe(false);
    expect(shouldFetchById(false, null, null)).toBe(false);
  });

  it("does not re-fetch an id that is already loaded", () => {
    expect(shouldFetchById(false, "product-a", "product-a")).toBe(false);
  });

  it("re-navigating to a previously-abandoned id fetches it again if it never finished loading", () => {
    // A started loading, user left before it resolved (loadedId never became "product-a"),
    // then the user returns — loadedId is still whatever it was (e.g. "product-b" from the
    // product they navigated to and which *did* finish loading).
    expect(shouldFetchById(false, "product-a", "product-b")).toBe(true);
  });
});
