import { describe, expect, it } from "vitest";
import {
  releaseSingleFlight,
  type SingleFlightRef,
  tryAcquireSingleFlight,
} from "./saveSingleFlight";

/** Mirrors ProductEdit.handleSave — synchronous guard before async save body. */
async function invokeGuardedSave(
  ref: SingleFlightRef,
  saveImpl: () => Promise<void>,
  onLoading?: (loading: boolean) => void,
): Promise<boolean> {
  if (!tryAcquireSingleFlight(ref)) return false;
  onLoading?.(true);
  try {
    await saveImpl();
  } finally {
    releaseSingleFlight(ref);
    onLoading?.(false);
  }
  return true;
}

describe("Full Editor save single-flight guard", () => {
  it("rejects a rapid second save until the first releases the guard", () => {
    const ref = { current: false };

    expect(tryAcquireSingleFlight(ref)).toBe(true);
    expect(tryAcquireSingleFlight(ref)).toBe(false);

    releaseSingleFlight(ref);

    expect(tryAcquireSingleFlight(ref)).toBe(true);
  });

  it("can be released after an error path and acquired again", () => {
    const ref = { current: false };

    expect(tryAcquireSingleFlight(ref)).toBe(true);
    releaseSingleFlight(ref);
    expect(ref.current).toBe(false);
    expect(tryAcquireSingleFlight(ref)).toBe(true);
  });
});

describe("ProductEdit guarded save wrapper sequence", () => {
  it("allows only one concurrent save through the wrapper", async () => {
    const ref = { current: false };
    let active = 0;
    let maxActive = 0;
    let started = 0;

    const saveImpl = async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      started += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      active -= 1;
    };

    const [firstStarted, secondStarted] = await Promise.all([
      invokeGuardedSave(ref, saveImpl),
      invokeGuardedSave(ref, saveImpl),
    ]);

    expect(firstStarted || secondStarted).toBe(true);
    expect(firstStarted && secondStarted).toBe(false);
    expect(started).toBe(1);
    expect(maxActive).toBe(1);
    expect(ref.current).toBe(false);
  });

  it("releases guard after failure so a later save can proceed", async () => {
    const ref = { current: false };
    const loadingStates: boolean[] = [];

    await expect(
      invokeGuardedSave(
        ref,
        async () => {
          throw new Error("save failed");
        },
        (loading) => loadingStates.push(loading),
      ),
    ).rejects.toThrow("save failed");

    expect(ref.current).toBe(false);
    expect(loadingStates).toEqual([true, false]);
    expect(await invokeGuardedSave(ref, async () => {})).toBe(true);
    expect(ref.current).toBe(false);
  });

  it("clears loading state after successful completion", async () => {
    const ref = { current: false };
    const loadingStates: boolean[] = [];

    expect(
      await invokeGuardedSave(
        ref,
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
        },
        (loading) => loadingStates.push(loading),
      ),
    ).toBe(true);

    expect(loadingStates).toEqual([true, false]);
    expect(ref.current).toBe(false);
  });
});
