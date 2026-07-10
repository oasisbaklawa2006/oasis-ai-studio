import { describe, expect, it } from "vitest";
import {
  INITIAL_MEDIA_LOAD_STATE,
  isMediaResultEmpty,
  mediaLoadFailed,
  mediaLoadStarted,
  mediaLoadSucceeded,
  MEDIA_LOAD_ERROR_MESSAGE,
} from "./catalogueMediaLoadState";

describe("catalogueMediaLoadState", () => {
  it("starts in a loading state with no rows and no error", () => {
    expect(INITIAL_MEDIA_LOAD_STATE.status).toBe("loading");
    expect(INITIAL_MEDIA_LOAD_STATE.rows).toEqual([]);
    expect(INITIAL_MEDIA_LOAD_STATE.errorMessage).toBeNull();
  });

  it("mediaLoadStarted() always resets rows and error (used on both initial load and retry)", () => {
    const state = mediaLoadStarted();
    expect(state.status).toBe("loading");
    expect(state.rows).toEqual([]);
    expect(state.errorMessage).toBeNull();
  });

  it("mediaLoadSucceeded() with media is 'loaded' and not empty", () => {
    const state = mediaLoadSucceeded([{ id: "a", type: "hero_image", status: "approved", file_url: "https://x/a.jpg" }]);
    expect(state.status).toBe("loaded");
    expect(state.errorMessage).toBeNull();
    expect(isMediaResultEmpty(state)).toBe(false);
  });

  it("mediaLoadSucceeded() with zero rows is a genuine empty result, not an error", () => {
    const state = mediaLoadSucceeded([]);
    expect(state.status).toBe("loaded");
    expect(state.errorMessage).toBeNull();
    expect(isMediaResultEmpty(state)).toBe(true);
  });

  it("mediaLoadFailed() never carries rows and never leaks a raw backend message", () => {
    const state = mediaLoadFailed();
    expect(state.status).toBe("error");
    expect(state.rows).toEqual([]);
    expect(state.errorMessage).toBe(MEDIA_LOAD_ERROR_MESSAGE);
    expect(isMediaResultEmpty(state)).toBe(false);
  });

  it("a failed load can never be mistaken for a genuine empty result (the exact silent-error regression)", () => {
    const failed = mediaLoadFailed();
    const empty = mediaLoadSucceeded([]);
    expect(failed.status).not.toBe(empty.status);
  });
});
