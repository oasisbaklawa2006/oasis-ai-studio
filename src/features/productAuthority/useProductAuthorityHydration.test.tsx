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
    let activeMedia!: () => boolean;
    let activeChannel!: () => boolean;
    await act(async () => {
      expect(gate.completeChannelRequest(oldChannel)).toBe(false);
      expect(gate.completeMediaRequest(oldMedia)).toBe(false);
      activeMedia = gate.beginMediaRequest();
      activeChannel = gate.beginChannelRequest();
    });
    expect(activeMedia()).toBe(true);
    expect(activeChannel()).toBe(true);
    expect(gate.isAuthorityHydratedNow()).toBe(false);
    await act(async () => {
      root.unmount();
    });
    mounted = false;
    expect(activeMedia()).toBe(false);
    expect(activeChannel()).toBe(false);
    expect(gate.isAuthorityHydratedNow()).toBe(false);
  } finally {
    if (mounted) {
      await act(async () => {
        root.unmount();
      });
    }
    host.remove();
  }
});

it("closes synchronous save authority immediately on a superseding request, before React rerenders", async () => {
  let gate!: ReturnType<typeof useProductAuthorityHydration>;
  function Harness() {
    gate = useProductAuthorityHydration("product-a-session", false);
    return null;
  }
  const root = createRoot(document.createElement("div"));
  try {
    await act(async () => {
      root.render(<Harness />);
    });
    let media!: () => boolean;
    let channel!: () => boolean;
    await act(async () => {
      media = gate.beginMediaRequest();
      channel = gate.beginChannelRequest();
      gate.completeMediaRequest(media);
      gate.completeChannelRequest(channel);
    });
    expect(gate.isAuthorityHydratedNow()).toBe(true);
    expect(gate.authorityLoaded).toBe(true);
    await act(async () => {
      const newest = gate.beginChannelRequest();
      // This guards an async save that started while the old authority was ready.
      expect(gate.isAuthorityHydratedNow()).toBe(false);
      expect(gate.completeChannelRequest(channel)).toBe(false);
      gate.completeChannelRequest(newest);
    });
    expect(gate.isAuthorityHydratedNow()).toBe(true);
  } finally {
    await act(async () => {
      root.unmount();
    });
  }
});
