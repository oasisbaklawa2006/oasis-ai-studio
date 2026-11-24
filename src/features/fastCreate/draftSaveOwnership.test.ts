import { describe, expect, it, vi } from "vitest";
import {
  completeOwnedSave,
  createDraftSaveOwnership,
  type FastCreateCompletionEffects,
} from "./draftSaveOwnership";

function effects(): FastCreateCompletionEffects &
  Record<keyof FastCreateCompletionEffects, ReturnType<typeof vi.fn>> {
  return {
    clearDraft: vi.fn(),
    notify: vi.fn(),
    navigate: vi.fn(),
    notifyDetached: vi.fn(),
  };
}

describe("createDraftSaveOwnership", () => {
  it("owns only the latest request", () => {
    const o = createDraftSaveOwnership();
    const first = o.begin();
    expect(o.owns(first)).toBe(true);
    const second = o.begin();
    expect(o.owns(first)).toBe(false);
    expect(o.owns(second)).toBe(true);
  });

  it("invalidate drops ownership for every outstanding request", () => {
    const o = createDraftSaveOwnership();
    const token = o.begin();
    o.invalidate();
    expect(o.owns(token)).toBe(false);
  });

  it("a request begun after invalidate owns the new draft; the old one never regains it", () => {
    const o = createDraftSaveOwnership();
    const stale = o.begin();
    o.invalidate();
    const fresh = o.begin();
    expect(o.owns(stale)).toBe(false);
    expect(o.owns(fresh)).toBe(true);
  });
});

describe("completeOwnedSave", () => {
  it("keeps the normal clear, notify and navigate behaviour when the request still owns the draft", () => {
    const o = createDraftSaveOwnership();
    const token = o.begin();
    const fx = effects();
    const touched = completeOwnedSave(o, token, fx, { clearDraft: true, hasNavigateTarget: true });
    expect(touched).toBe(true);
    expect(fx.clearDraft).toHaveBeenCalledTimes(1);
    expect(fx.notify).toHaveBeenCalledTimes(1);
    expect(fx.navigate).toHaveBeenCalledTimes(1);
    expect(fx.notifyDetached).not.toHaveBeenCalled();
  });

  it("does not clear storage when the receipt says to keep the draft", () => {
    const o = createDraftSaveOwnership();
    const token = o.begin();
    const fx = effects();
    completeOwnedSave(o, token, fx, { clearDraft: false, hasNavigateTarget: false });
    expect(fx.clearDraft).not.toHaveBeenCalled();
    expect(fx.navigate).not.toHaveBeenCalled();
    expect(fx.notify).toHaveBeenCalledTimes(1);
  });

  it("a save that finishes after discardDraft cannot clear the new draft or navigate away", () => {
    const o = createDraftSaveOwnership();
    const stale = o.begin();
    o.invalidate(); // discardDraft
    const fx = effects();
    const touched = completeOwnedSave(o, stale, fx, { clearDraft: true, hasNavigateTarget: true });
    expect(touched).toBe(false);
    expect(fx.clearDraft).not.toHaveBeenCalled();
    expect(fx.navigate).not.toHaveBeenCalled();
    expect(fx.notify).not.toHaveBeenCalled();
    expect(fx.notifyDetached).toHaveBeenCalledTimes(1);
  });

  it("a save that finishes after the draft was replaced and a new save started cannot touch the new draft", () => {
    const o = createDraftSaveOwnership();
    const stale = o.begin();
    o.invalidate(); // draft replaced
    const replacement = o.begin();
    const staleFx = effects();
    const freshFx = effects();

    // The replacement draft's own save finishes first, then the stale one resolves late.
    completeOwnedSave(o, replacement, freshFx, { clearDraft: true, hasNavigateTarget: true });
    const touched = completeOwnedSave(o, stale, staleFx, {
      clearDraft: true,
      hasNavigateTarget: true,
    });

    expect(freshFx.clearDraft).toHaveBeenCalledTimes(1);
    expect(touched).toBe(false);
    expect(staleFx.clearDraft).not.toHaveBeenCalled();
    expect(staleFx.navigate).not.toHaveBeenCalled();
  });

  it("a save that finishes after unmount cannot clear storage or navigate", () => {
    const o = createDraftSaveOwnership();
    const token = o.begin();
    o.invalidate(); // unmount cleanup
    const fx = effects();
    completeOwnedSave(o, token, fx, { clearDraft: true, hasNavigateTarget: true });
    expect(fx.clearDraft).not.toHaveBeenCalled();
    expect(fx.navigate).not.toHaveBeenCalled();
  });
});
