import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, expect, it, vi } from "vitest";
import { useSaveRequestOwner } from "./useSaveRequestOwner";

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
afterAll(() => vi.unstubAllGlobals());

it("rejects late save effects after navigation, return navigation and unmount", async () => {
  let begin!: ReturnType<typeof useSaveRequestOwner>;
  function Harness({ session }: { session: string }) {
    begin = useSaveRequestOwner(session);
    return null;
  }
  const host = document.createElement("div");
  const root = createRoot(host);
  try {
    await act(async () => {
      root.render(<Harness session="product-a" />);
    });
    const a = begin();
    expect(a).not.toBeNull();
    expect(begin()).toBeNull(); // Duplicate click/keyboard shortcut cannot start another save.
    let complete!: () => void;
    let applied = false;
    const pending = new Promise<void>((resolve) => {
      complete = resolve;
    }).then(() => {
      if (a?.isCurrent()) applied = true;
      a?.release();
    });

    await act(async () => {
      root.render(<Harness session="product-b" />);
    });
    const b = begin();
    expect(b?.isCurrent()).toBe(true);
    complete();
    await pending;
    expect(applied).toBe(false);
    expect(b?.isCurrent()).toBe(true); // A's finalizer cannot unlock B.
    expect(begin()).toBeNull();

    await act(async () => {
      root.render(<Harness session="product-a" />);
    });
    expect(a?.isCurrent()).toBe(false); // A -> B -> A is a new session, not the old request.
    expect(b?.isCurrent()).toBe(false);
    const newA = begin();
    await act(async () => {
      root.render(<Harness session="product-a" />);
    });
    expect(newA?.isCurrent()).toBe(true); // Ordinary form renders do not cancel a save.
    newA?.release();
    expect(newA?.isCurrent()).toBe(false);
    const next = begin();
    expect(next?.isCurrent()).toBe(true);
    await act(async () => {
      root.unmount();
    });
    expect(next?.isCurrent()).toBe(false);
  } finally {
    await act(async () => {
      root.unmount();
    });
    host.remove();
  }
});
