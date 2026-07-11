import { describe, expect, it } from "vitest";
import {
  advanceMediaUploaderMountGuard,
  computeMediaUploaderMountKey,
  consumeMediaUploaderChange,
  INITIAL_MEDIA_UPLOADER_MOUNT_GUARD_STATE,
  type MediaUploaderMountGuardState,
} from "./catalogueMediaUploaderMountGuard";

describe("computeMediaUploaderMountKey", () => {
  it("is null when the Media tab is not active, regardless of product", () => {
    expect(computeMediaUploaderMountKey("content", "prod-1", true)).toBeNull();
  });

  it("is the product id when the Media tab is active and the uploader is eligible to render", () => {
    expect(computeMediaUploaderMountKey("media", "prod-1", true)).toBe("prod-1");
  });

  it("is null when the Media tab is active but no product is selected", () => {
    expect(computeMediaUploaderMountKey("media", null, true)).toBeNull();
    expect(computeMediaUploaderMountKey("media", undefined, true)).toBeNull();
  });

  it("is null when the uploader is not eligible to render, even on the Media tab with a product selected", () => {
    expect(computeMediaUploaderMountKey("media", "prod-1", false)).toBeNull();
  });
});

function step(
  state: MediaUploaderMountGuardState,
  studioTab: string,
  productId: string | null,
  uploaderEligibleToRender = true,
): MediaUploaderMountGuardState {
  return advanceMediaUploaderMountGuard(
    state,
    computeMediaUploaderMountKey(studioTab, productId, uploaderEligibleToRender),
  );
}

describe("advanceMediaUploaderMountGuard + consumeMediaUploaderChange (uploader mount-call absorption)", () => {
  it("absorbs the uploader's initial mount-triggered onMediaChange call after opening the Media tab", () => {
    let state = step(INITIAL_MEDIA_UPLOADER_MOUNT_GUARD_STATE, "media", "prod-1");
    const first = consumeMediaUploaderChange(state);
    expect(first.shouldForward).toBe(false);
    state = first.nextState;

    // A genuine subsequent mutation (upload, hero change, etc.) must still propagate.
    const second = consumeMediaUploaderChange(state);
    expect(second.shouldForward).toBe(true);
  });

  it("does not re-arm a skip on an unrelated re-render of the same (tab, product) pair", () => {
    let state = step(INITIAL_MEDIA_UPLOADER_MOUNT_GUARD_STATE, "media", "prod-1");
    state = consumeMediaUploaderChange(state).nextState; // absorb the mount call
    // Re-render with the exact same tab/product (e.g. unrelated state update elsewhere on the page).
    state = step(state, "media", "prod-1");
    const result = consumeMediaUploaderChange(state);
    expect(result.shouldForward).toBe(true);
  });

  it("re-arms a skip when switching products while the Media tab stays open", () => {
    let state = step(INITIAL_MEDIA_UPLOADER_MOUNT_GUARD_STATE, "media", "prod-1");
    state = consumeMediaUploaderChange(state).nextState; // absorb prod-1's mount call

    state = step(state, "media", "prod-2"); // product switch while still on Media tab
    const result = consumeMediaUploaderChange(state);
    expect(result.shouldForward).toBe(false); // absorb prod-2's redundant reload
  });

  it("re-arms a skip when the Media tab is closed and reopened for the same product", () => {
    let state = step(INITIAL_MEDIA_UPLOADER_MOUNT_GUARD_STATE, "media", "prod-1");
    state = consumeMediaUploaderChange(state).nextState; // absorb the first mount call

    state = step(state, "content", "prod-1"); // leave the Media tab (uploader unmounts)
    state = step(state, "media", "prod-1"); // reopen it (uploader remounts, fires load() again)
    const result = consumeMediaUploaderChange(state);
    expect(result.shouldForward).toBe(false);
  });

  it("never forwards while the Media tab is inactive or no product is selected — nothing is mounted to justify it", () => {
    let state = step(INITIAL_MEDIA_UPLOADER_MOUNT_GUARD_STATE, "content", null);
    state = step(state, "media", null);
    const result = consumeMediaUploaderChange(state);
    expect(result.shouldForward).toBe(false);
  });
});

describe("consumeMediaUploaderChange (Bugbot round 2: stale callback after unmount)", () => {
  it("drops a stale onMediaChange call that resolves after the Media tab was already closed", () => {
    let state = step(INITIAL_MEDIA_UPLOADER_MOUNT_GUARD_STATE, "media", "prod-1");
    state = consumeMediaUploaderChange(state).nextState; // absorb the mount call

    // Operator leaves the Media tab entirely before the uploader's in-flight load() resolves.
    state = step(state, "content", "prod-1");
    const result = consumeMediaUploaderChange(state); // the stale callback finally fires
    expect(result.shouldForward).toBe(false);
  });

  it("drops a stale onHeroChange call that resolves after the product was switched away from", () => {
    let state = step(INITIAL_MEDIA_UPLOADER_MOUNT_GUARD_STATE, "media", "prod-1");
    state = consumeMediaUploaderChange(state).nextState; // absorb the mount call
    state = consumeMediaUploaderChange(state).nextState; // a genuine hero change while still open

    // Operator navigates away to a different page entirely (no product selected at all).
    state = step(state, "content", null);
    const result = consumeMediaUploaderChange(state); // hero-upload promise resolves late
    expect(result.shouldForward).toBe(false);
  });

  it("resumes forwarding once a genuinely new uploader is mounted after a stale call was dropped", () => {
    let state = step(INITIAL_MEDIA_UPLOADER_MOUNT_GUARD_STATE, "media", "prod-1");
    state = consumeMediaUploaderChange(state).nextState; // absorb the mount call

    state = step(state, "content", "prod-1"); // leave the tab; a stale call would be dropped here
    state = step(state, "media", "prod-2"); // operator reopens the tab for a different product

    const mountCall = consumeMediaUploaderChange(state);
    expect(mountCall.shouldForward).toBe(false); // this uploader's own mount call is still absorbed
    const genuineChange = consumeMediaUploaderChange(mountCall.nextState);
    expect(genuineChange.shouldForward).toBe(true); // but a real change after that propagates again
  });
});

describe("consumeMediaUploaderChange (Bugbot: retry loop after a genuine mutation triggers a reload)", () => {
  it("does not loop: a genuine mutation's own reload-induced remount absorbs its own mount call instead of forwarding again", () => {
    // Opening the Media tab: uploader mounts, its own initial load() call is absorbed.
    let state = step(INITIAL_MEDIA_UPLOADER_MOUNT_GUARD_STATE, "media", "prod-1", true);
    state = consumeMediaUploaderChange(state).nextState;

    // Operator uploads a photo: a genuine onMediaChange call while the uploader is still mounted
    // and the page isn't loading — must forward (this is what triggers retryMediaLoad()).
    const genuineMutation = consumeMediaUploaderChange(state);
    expect(genuineMutation.shouldForward).toBe(true);
    state = genuineMutation.nextState;

    // retryMediaLoad() flips the page's mediaLoadState to "loading" — the uploader is no longer
    // eligible to render and unmounts.
    state = step(state, "media", "prod-1", false);
    const whileUnmountedForReload = consumeMediaUploaderChange(state);
    expect(whileUnmountedForReload.shouldForward).toBe(false); // nothing is mounted right now

    // The page's fetch resolves; mediaLoadState flips back to "loaded" — the uploader remounts
    // fresh and fires its own initial load() -> onMediaChange. This must be absorbed, not
    // forwarded, or it would call retryMediaLoad() again and loop forever.
    state = step(state, "media", "prod-1", true);
    const remountAfterReload = consumeMediaUploaderChange(state);
    expect(remountAfterReload.shouldForward).toBe(false);
    state = remountAfterReload.nextState;

    // A further genuine change after that (e.g. a second real upload) must still propagate —
    // the fix must not have permanently wedged forwarding off.
    const secondGenuineMutation = consumeMediaUploaderChange(state);
    expect(secondGenuineMutation.shouldForward).toBe(true);
  });

  it("treats every loading-to-eligible transition as a fresh mount, even with no tab/product change", () => {
    let state = step(INITIAL_MEDIA_UPLOADER_MOUNT_GUARD_STATE, "media", "prod-1", true);
    state = consumeMediaUploaderChange(state).nextState; // absorb initial mount

    // Simulate several loading/reload cycles in a row (e.g. Retry clicked repeatedly) with no
    // change to tab or product at all — each cycle's remount must still be absorbed once.
    for (let i = 0; i < 3; i += 1) {
      state = step(state, "media", "prod-1", false); // page fetch starts, uploader unmounts
      state = step(state, "media", "prod-1", true); // page fetch resolves, uploader remounts
      const result = consumeMediaUploaderChange(state);
      expect(result.shouldForward).toBe(false);
      state = result.nextState;
    }
  });
});
