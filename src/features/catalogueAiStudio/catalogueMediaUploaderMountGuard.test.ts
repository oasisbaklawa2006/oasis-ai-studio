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
    expect(computeMediaUploaderMountKey("content", "prod-1")).toBeNull();
  });

  it("is the product id when the Media tab is active", () => {
    expect(computeMediaUploaderMountKey("media", "prod-1")).toBe("prod-1");
  });

  it("is null when the Media tab is active but no product is selected", () => {
    expect(computeMediaUploaderMountKey("media", null)).toBeNull();
    expect(computeMediaUploaderMountKey("media", undefined)).toBeNull();
  });
});

function step(state: MediaUploaderMountGuardState, studioTab: string, productId: string | null): MediaUploaderMountGuardState {
  return advanceMediaUploaderMountGuard(state, computeMediaUploaderMountKey(studioTab, productId));
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

  it("never arms a skip while the Media tab is inactive or no product is selected", () => {
    let state = step(INITIAL_MEDIA_UPLOADER_MOUNT_GUARD_STATE, "content", null);
    state = step(state, "media", null);
    const result = consumeMediaUploaderChange(state);
    expect(result.shouldForward).toBe(true);
  });
});
