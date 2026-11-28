/**
 * Draft-session ownership for in-flight Fast Create saves.
 *
 * A save request is only allowed to touch the active draft (write its SKU, clear session
 * storage, navigate away) while it still *owns* that draft. Discarding the draft, replacing
 * it, or leaving the page invalidates every outstanding request, so a slow save that
 * resolves afterwards cannot clear or navigate away from a replacement draft.
 *
 * Note: invalidation cannot cancel the server write. A stale request may still have created
 * the product; the caller reports that with a neutral message instead of acting on the draft.
 */

export type DraftSaveToken = number;

/** Identifies one lifetime of the active draft; changes whenever the draft is invalidated. */
export type DraftSession = number;

export type DraftSaveOwnership = {
  /** Start a new save request; every earlier request stops owning the draft. */
  begin: () => DraftSaveToken;
  /** Drop ownership: discard, draft replacement, unmount. */
  invalidate: () => void;
  /** True only while `token` is the latest request and nothing has invalidated it. */
  owns: (token: DraftSaveToken) => boolean;
  /**
   * The active draft's session. Any async handler that later writes into the draft (generate,
   * SKU refresh, image upload, adding a packaging option) captures it when it starts and
   * checks `isCurrentSession` before writing, so results for a discarded or replaced draft
   * are dropped instead of landing on the new one. Unlike `begin`, capturing a session does
   * not displace other in-flight work.
   */
  session: () => DraftSession;
  isCurrentSession: (session: DraftSession) => boolean;
};

export function createDraftSaveOwnership(): DraftSaveOwnership {
  let latest = 0;
  let active: DraftSaveToken | null = null;
  let session = 0;
  return {
    begin: () => {
      latest += 1;
      active = latest;
      return latest;
    },
    invalidate: () => {
      active = null;
      session += 1;
    },
    owns: (token) => active !== null && token === active,
    session: () => session,
    isCurrentSession: (captured) => captured === session,
  };
}

export type FastCreateCompletionEffects = {
  clearDraft: () => void;
  /** Completion feedback tied to the active draft. */
  notify: () => void;
  navigate: () => void;
  /** Neutral notice when the request no longer owns the draft (no draft side effects). */
  notifyDetached: () => void;
};

/**
 * Apply a finished save to the draft only when `token` still owns it. Returns whether the
 * draft was touched. A detached request never clears storage, shows draft feedback, or navigates.
 */
export function completeOwnedSave(
  ownership: DraftSaveOwnership,
  token: DraftSaveToken,
  effects: FastCreateCompletionEffects,
  options: { clearDraft: boolean; hasNavigateTarget: boolean },
): boolean {
  if (!ownership.owns(token)) {
    effects.notifyDetached();
    return false;
  }
  if (options.clearDraft) effects.clearDraft();
  effects.notify();
  if (options.hasNavigateTarget) effects.navigate();
  return true;
}
