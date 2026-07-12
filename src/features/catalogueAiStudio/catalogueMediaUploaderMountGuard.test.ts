import { describe, expect, it } from "vitest";
import {
  advanceMediaUploaderMountGuard,
  consumeMediaUploaderChange,
  INITIAL_MEDIA_UPLOADER_MOUNT_GUARD_STATE,
  type MediaUploaderMountGuardState,
} from "./catalogueMediaUploaderMountGuard";

function step(
  state: MediaUploaderMountGuardState,
  studioTab: string,
  productId: string | null,
  eligible = true,
): MediaUploaderMountGuardState {
  return advanceMediaUploaderMountGuard(state, studioTab, productId, eligible);
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

  it("never forwards while the Media tab is inactive or no product is selected — nothing is mounted to justify it", () => {
    let state = step(INITIAL_MEDIA_UPLOADER_MOUNT_GUARD_STATE, "content", null);
    state = step(state, "media", null);
    const result = consumeMediaUploaderChange(state);
    expect(result.shouldForward).toBe(false);
  });
});

describe("consumeMediaUploaderChange (Bugbot round 2, corrected by a later round — see 'off-tab hero sync' below)", () => {
  it("forwards a genuine completion for the same product that resolves after the Media tab was already closed", () => {
    // Round 2 originally expected this to be dropped as "stale." A later round found that was
    // itself the bug (Bugbot: "off-tab hero sync dropped") — the uploader's own product-switch
    // guard already keeps this tied to the right product, so it must forward, not drop.
    let state = step(INITIAL_MEDIA_UPLOADER_MOUNT_GUARD_STATE, "media", "prod-1");
    state = consumeMediaUploaderChange(state).nextState; // absorb the mount call

    // Operator leaves the Media tab entirely before a real mutation's callback resolves.
    state = step(state, "content", "prod-1");
    const result = consumeMediaUploaderChange(state); // the genuine completion finally fires
    expect(result.shouldForward).toBe(true);
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

    state = step(state, "content", "prod-1"); // leave the tab
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

describe("consumeMediaUploaderChange (Bugbot: bare tab close/reopen must not silently swallow a real change)", () => {
  it("forwards the mount call on a bare Media-tab reopen for the same product with no reload in between", () => {
    let state = step(INITIAL_MEDIA_UPLOADER_MOUNT_GUARD_STATE, "media", "prod-1", true);
    state = consumeMediaUploaderChange(state).nextState; // absorb the initial mount call

    // Operator switches to a different tab (uploader unmounts) — no product switch, no reload.
    state = step(state, "content", "prod-1", true);
    // ...and reopens the Media tab for the *same* product. Unlike a product switch or a
    // reload-induced remount, the page's own media-fetch effect never reran in between, so a hero
    // or media mutation that completed (and was correctly dropped as stale) while the tab was
    // closed would otherwise never reach retryMediaLoad() again. This mount call must forward.
    state = step(state, "media", "prod-1", true);
    const result = consumeMediaUploaderChange(state);
    expect(result.shouldForward).toBe(true);
  });

  it("still absorbs a product switch that happens to coincide with reopening the tab", () => {
    let state = step(INITIAL_MEDIA_UPLOADER_MOUNT_GUARD_STATE, "media", "prod-1", true);
    state = consumeMediaUploaderChange(state).nextState;

    state = step(state, "content", "prod-1", true); // leave the tab
    // Product changes while away from the Media tab, then the tab is reopened for the new product
    // in the same transition — the page's product-switch effect covers this, so still absorb.
    state = step(state, "media", "prod-2", true);
    const result = consumeMediaUploaderChange(state);
    expect(result.shouldForward).toBe(false);
  });

  it("forwards again after a second bare reopen with no change in between", () => {
    let state = step(INITIAL_MEDIA_UPLOADER_MOUNT_GUARD_STATE, "media", "prod-1", true);
    state = consumeMediaUploaderChange(state).nextState;

    state = step(state, "content", "prod-1", true);
    state = step(state, "media", "prod-1", true);
    state = consumeMediaUploaderChange(state).nextState; // forwarded (bare reopen)

    state = step(state, "content", "prod-1", true);
    state = step(state, "media", "prod-1", true);
    const result = consumeMediaUploaderChange(state);
    expect(result.shouldForward).toBe(true);
  });
});

describe("advanceMediaUploaderMountGuard (Bugbot: first-ever Media-tab open for an already-loaded product)", () => {
  it("absorbs the very first Media-tab open for a product whose media the page already loaded on another tab", () => {
    // Operator selects a product while on Content — the guard tracks productId/eligible on every
    // render even though the Media tab is closed, exactly like the real page does.
    let state = step(INITIAL_MEDIA_UPLOADER_MOUNT_GUARD_STATE, "content", "prod-1", false);
    state = step(state, "content", "prod-1", true); // the page's own media fetch finishes loading

    // First-ever click into Media for this product: the uploader has never been mounted for it
    // before, so there is nothing a suppressed mutation could have left unsynced — must absorb.
    state = step(state, "media", "prod-1", true);
    const result = consumeMediaUploaderChange(state);
    expect(result.shouldForward).toBe(false);
  });

  it("still forwards a bare reopen after that same first mount has already happened once", () => {
    let state = step(INITIAL_MEDIA_UPLOADER_MOUNT_GUARD_STATE, "content", "prod-1", true);
    state = step(state, "media", "prod-1", true); // first-ever mount, absorbed
    state = consumeMediaUploaderChange(state).nextState;

    state = step(state, "content", "prod-1", true); // close
    state = step(state, "media", "prod-1", true); // bare reopen — now genuinely must forward
    const result = consumeMediaUploaderChange(state);
    expect(result.shouldForward).toBe(true);
  });

  it("absorbs a first-ever mount's own pending load() even if the Media tab closes before it resolves (Bugbot: 'Unmounted load still notifies parent')", () => {
    let state = step(INITIAL_MEDIA_UPLOADER_MOUNT_GUARD_STATE, "content", "prod-1", true);
    // First-ever mount is decided as redundant (skipNextChange=true) — but nothing has consumed
    // it yet, simulating the uploader's own initial load() still being in flight.
    state = step(state, "media", "prod-1", true);

    // Operator closes the tab immediately, before that load() resolves. The prior implementation
    // reset skipNextChange to false the instant nothing was mounted, so the pending echo would
    // wrongly forward once it finally arrived — it must not.
    state = step(state, "content", "prod-1", true);
    const result = consumeMediaUploaderChange(state); // the mount's own pending load() finally resolves
    expect(result.shouldForward).toBe(false);
  });
});

describe("consumeMediaUploaderChange (Bugbot: off-tab hero sync must not be dropped)", () => {
  it("forwards a genuine hero-clear/upload completion that resolves after the Media tab has already closed, for the same product", () => {
    let state = step(INITIAL_MEDIA_UPLOADER_MOUNT_GUARD_STATE, "media", "prod-1", true);
    state = consumeMediaUploaderChange(state).nextState; // absorb the mount call

    // Operator closes the Media tab (e.g. switches to Content) before a hero mutation's callback
    // resolves. ProductMediaUploader itself still calls onHeroChange for the product it applied
    // to (isSupersededByProductSwitch, not a bare-unmount check) — this must reach the page and
    // trigger a resync, or the sticky bar/Build Meter/readiness stay wrong until reopened.
    state = step(state, "content", "prod-1", true);
    const result = consumeMediaUploaderChange(state);
    expect(result.shouldForward).toBe(true);
  });

  it("still refuses while merely mid our own retryMediaLoad()-triggered reload (tab open, ineligible) — the round-6 loop guard is unaffected", () => {
    let state = step(INITIAL_MEDIA_UPLOADER_MOUNT_GUARD_STATE, "media", "prod-1", true);
    state = consumeMediaUploaderChange(state).nextState;
    const genuine = consumeMediaUploaderChange(state);
    expect(genuine.shouldForward).toBe(true);
    state = genuine.nextState;

    state = step(state, "media", "prod-1", false); // our own reload makes the uploader ineligible
    const result = consumeMediaUploaderChange(state);
    expect(result.shouldForward).toBe(false);
  });

  it("never forwards with no product selected at all, even off-tab", () => {
    let state = step(INITIAL_MEDIA_UPLOADER_MOUNT_GUARD_STATE, "media", "prod-1", true);
    state = consumeMediaUploaderChange(state).nextState;

    state = step(state, "content", null, true);
    const result = consumeMediaUploaderChange(state);
    expect(result.shouldForward).toBe(false);
  });
});
