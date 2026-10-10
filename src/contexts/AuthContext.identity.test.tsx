import type { Session } from "@supabase/supabase-js";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";

const mock = vi.hoisted(() => ({
  rpc: vi.fn(),
  getSession: vi.fn(),
  subscribe: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: mock.rpc,
    auth: {
      getSession: mock.getSession,
      onAuthStateChange: mock.subscribe,
      signOut: mock.signOut,
    },
  },
}));
type Listener = (event: string, session: Session | null) => void;
let notifyAuth: Listener;
const sessionFor = (id: string): Session => ({ user: { id } }) as unknown as Session;

function mountable() {
  const container = document.createElement("div");
  const root = createRoot(container);
  function Probe() {
    const { user, roles } = useAuth();
    return createElement("output", {}, `${user?.id ?? "none"}:${roles.join(",")}`);
  }
  return {
    container,
    mount: async () => {
      await act(async () => {
        root.render(<AuthProvider><Probe /></AuthProvider>);
      });
    },
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
    },
  };
}
beforeEach(() => {
  vi.useFakeTimers();
  mock.rpc.mockReset();
  mock.getSession.mockReset().mockResolvedValue({ data: { session: null } });
  mock.subscribe.mockReset().mockImplementation((handler: Listener) => {
    notifyAuth = handler;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
  mock.signOut.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
});
describe("AuthProvider binds roles to the active user identity", () => {
  it("keeps role-gated screens loading until the initial session role RPC completes", async () => {
    let settle: (value: { data: string[]; error: null }) => void = () => {};
    mock.rpc.mockImplementationOnce(
      () =>
        new Promise<{ data: string[]; error: null }>((resolve) => {
          settle = resolve;
        }),
    );
    const container = document.createElement("div");
    const root = createRoot(container);
    function LoadingProbe() {
      const { user, loading, rolesLoading, roles } = useAuth();
      const status = loading || rolesLoading ? "loading" : roles.join(",") || "restricted";
      return createElement("output", {}, `${user?.id ?? "none"}:${status}`);
    }
    try {
      await act(async () => {
        root.render(<AuthProvider><LoadingProbe /></AuthProvider>);
      });
      await act(async () => {
        notifyAuth("INITIAL_SESSION", sessionFor("staff"));
      });
      expect(container.textContent).toBe("staff:loading");
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      // The RoleGate must not temporarily show AccessRestricted before roles arrive.
      expect(container.textContent).toBe("staff:loading");
      await act(async () => {
        settle({ data: ["sales"], error: null });
        await Promise.resolve();
      });
      expect(container.textContent).toBe("staff:sales");
    } finally {
      await act(async () => {
        root.unmount();
      });
    }
  });
  it("loads scoped roles when Supabase emits INITIAL_SESSION instead of SIGNED_IN", async () => {
    mock.rpc.mockResolvedValueOnce({ data: ["sales"], error: null });
    const app = mountable();
    try {
      await app.mount();
      await act(async () => {
        notifyAuth("INITIAL_SESSION", sessionFor("existing"));
        await vi.runAllTimersAsync();
      });
      expect(app.container.textContent).toBe("existing:sales");
    } finally {
      await app.unmount();
    }
  });
  it("hides old owner permissions immediately on account change", async () => {
    mock.rpc
      .mockResolvedValueOnce({ data: ["owner"], error: null })
      .mockResolvedValueOnce({ data: ["sales"], error: null });
    const app = mountable();
    try {
      await app.mount();
      await act(async () => {
        notifyAuth("SIGNED_IN", sessionFor("former"));
        await vi.runAllTimersAsync();
      });
      expect(app.container.textContent).toBe("former:owner");
      await act(async () => {
        notifyAuth("SIGNED_IN", sessionFor("current"));
      });
      expect(app.container.textContent).toBe("current:");
      await act(async () => {
        await vi.runAllTimersAsync();
      });
      expect(app.container.textContent).toBe("current:sales");
    } finally {
      await app.unmount();
    }
  });
  it("ignores the previous user's late owner-role response", async () => {
    let settleOld: (result: { data: string[]; error: null }) => void = () => {};
    const formerRpc = new Promise<{ data: string[]; error: null }>((resolve) => {
      settleOld = resolve;
    });
    mock.rpc
      .mockImplementationOnce(() => formerRpc)
      .mockResolvedValueOnce({ data: ["sales"], error: null });
    const app = mountable();
    try {
      await app.mount();
      await act(async () => {
        notifyAuth("SIGNED_IN", sessionFor("former"));
        await vi.runAllTimersAsync();
      });
      await act(async () => {
        notifyAuth("SIGNED_IN", sessionFor("current"));
        await vi.runAllTimersAsync();
      });
      expect(app.container.textContent).toBe("current:sales");
      await act(async () => {
        settleOld({ data: ["owner"], error: null });
        await Promise.resolve();
      });
      expect(app.container.textContent).toBe("current:sales");
    } finally {
      await app.unmount();
    }
  });
});
