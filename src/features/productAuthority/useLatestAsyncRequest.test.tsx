import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, expect, it, vi } from "vitest";
import { useLatestAsyncRequest } from "./useLatestAsyncRequest";

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
afterAll(() => vi.unstubAllGlobals());

it("rejects older same-product requests, navigation, return navigation and unmount", async () => {
  let begin!: ReturnType<typeof useLatestAsyncRequest>;
  function Harness({ session }: { session: string }) {
    begin = useLatestAsyncRequest(session);
    return null;
  }
  const host = document.createElement("div");
  const root = createRoot(host);
  let mounted = true;
  try {
    await act(async () => root.render(<Harness session="route-a:product-a" />));
    const staleBegin = begin;
    const first = begin();
    const newer = begin();
    expect(first()).toBe(false);
    expect(newer()).toBe(true);

    let finish!: () => void;
    let applied = false;
    const deferred = new Promise<void>((resolve) => {
      finish = resolve;
    }).then(() => {
      if (newer()) applied = true;
    });

    await act(async () => root.render(<Harness session="route-b:product-b" />));
    const b = begin();
    expect(newer()).toBe(false);
    expect(staleBegin()()).toBe(false);
    expect(b()).toBe(true);
    finish();
    await deferred;
    expect(applied).toBe(false);
    expect(b()).toBe(true);

    await act(async () => root.render(<Harness session="route-a:product-a" />));
    expect(newer()).toBe(false);
    expect(b()).toBe(false);
    expect(staleBegin()()).toBe(false);
    const returnedA = begin();
    expect(returnedA()).toBe(true);
    await act(async () => root.render(<Harness session="route-a:product-a" />));
    expect(returnedA()).toBe(true); // Unrelated re-render does not supersede.
    const newerA = begin();
    expect(returnedA()).toBe(false);
    expect(newerA()).toBe(true);
    await act(async () => root.unmount());
    mounted = false;
    expect(newerA()).toBe(false);
  } finally {
    if (mounted) await act(async () => root.unmount());
    host.remove();
  }
});
