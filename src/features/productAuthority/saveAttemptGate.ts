export type SaveAttemptGate = {
  tryEnter: () => boolean;
  release: () => void;
  isActive: () => boolean;
};

/**
 * Synchronous guard for event-handler re-entry. React state updates are deliberately not used
 * because two clicks can enter the same handler before the disabled button has rendered.
 */
export function createSaveAttemptGate(): SaveAttemptGate {
  let active = false;
  return {
    tryEnter() {
      if (active) return false;
      active = true;
      return true;
    },
    release() {
      active = false;
    },
    isActive() {
      return active;
    },
  };
}
