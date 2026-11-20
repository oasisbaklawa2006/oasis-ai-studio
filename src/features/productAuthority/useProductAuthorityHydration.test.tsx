import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, expect, it, vi } from "vitest";
import { useProductAuthorityHydration } from "./useProductAuthorityHydration";

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
afterAll(() => vi.unstubAllGlobals());

it("keeps readiness closed until both media and latest channel authority complete", async () => {
  let gate!: ReturnType<typeof useProductAuthorityHydration>;
  function Harness({ session }: { session: string }) {
    gate = useProductAuthorityHydration(session, false);
    return null;
  }
  const host = document.createElement("div");
  const root = createRoot(host);
  try {
    await act(async () => {
      root.render(<Harness session="route-a:product-a" />);
    });
    expect(gate.authorityLoaded).toBe(false);
    let media!: () => boolean;
    let olderChannel!: () => boolean;
    let latestChannel!: () => boolean;
    await act(async () => {
      media = gate.beginMediaRequest();
      olderChannel = gate.beginChannelRequest();
      latestChannel = gate.beginChannelRequest();
      expect(gate.completeChannelRequest(olderChannel)).toBe(false);
      expect(gate.completeChannelRequest(latestChannel)).toBe(true);
    });
    expect(gate.authorityLoaded).toBe(false); // Media still pending.
    await act(async () => {
      expect(gate.completeMediaRequest(media)).toBe(true);
    });
    expect(gate.authorityLoaded).toBe(true);
    await act(async () => {
      latestChannel = gate.beginChannelRequest();
    });
    expect(gate.authorityLoaded).toBe(false); // A superseding reload closes the gate.
    await act(async () => {
      expect(gate.completeChannelRequest(latestChannel)).toBe(true);
    });
    expect(gate.authorityLoaded).toBe(true);
  } finally {
    await act(async () => {
      root.unmount();
    });
    host.remove();
  }
});

it("does not revive a superseded, same-product navigation or an unmounted request", async () => {
  let gate!: ReturnType<typeof useProductAuthorityHydration>;
  function Harness({ session }: { session: string }) {
    gate = useProductAuthorityHydration(session, false);
    return null;
  }
  const host = document.createElement("div");
  const root = createRoot(host);
  let mounted = true;
  try {
    await act(async () => {
      root.render(<Harness session="route-a:product-a" />);
    });
    let oldMedia!: () => boolean;
    let oldChannel!: () => boolean;
    await act(async () => {
      oldMedia = gate.beginMediaRequest();
      oldChannel = gate.beginChannelRequest();
    });
    await act(async () => {
      root.render(<Harness session="route-b:product-a" />);
    });
    expect(gate.authorityLoaded).toBe(false);
    await act(async () => {
      expect(gate.completeMediaRequest(oldMedia)).toBe(false);
      expect(gate.completeChannelRequest(oldChannel)).toBe(false);
    });
    expect(gate.authorityLoaded).toBe(false);
    let currentMedia!: () => boolean;
    let currentChannel!: () => boolean;
    await act(async () => {
      currentMedia = gate.beginMediaRequest();
      currentChannel = gate.beginChannelRequest();
      expect(gate.completeMediaRequest(currentMedia)).toBe(true);
      expect(gate.completeChannelRequest(currentChannel)).toBe(true);
    });
    expect(gate.authorityLoaded).toBe(true);
    await act(async () => {
      root.render(<Harness session="route-a:product-a" />);
    });
    expect(gate.authorityLoaded).toBe(false); // A -> B -> A is a NEW session.
    await act(async () => {
      expect(gate.completeChannelRequest(oldChannel)).toBe(false);
      expect(gate.completeMediaRequest(oldMedia)).toBe(false);
      root.unmount();
    });
    mounted = false;
    expect(currentMedia()).toBe(false);
    expect(currentChannel()).toBe(false);
  } finally {
    if (mounted) {
      await act(async () => {
        root.unmount();
      });
    }
    host.remove();
  }
});
