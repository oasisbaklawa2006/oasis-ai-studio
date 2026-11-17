import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProtectedRoute } from "./ProtectedRoute";

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  auth: {
    user: { id: "u1" } as { id: string } | null,
    session: { access_token: "t1" },
    loading: false,
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    // A real SupabaseClient.rpc needs its receiver; this mock fails if it is detached.
    rpc(this: unknown, ...args: unknown[]) {
      if (this === undefined) throw new TypeError("detached rpc");
      return h.rpc(...args);
    },
  },
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => h.auth }));

const ui = () => (
  <MemoryRouter initialEntries={["/"]}>
    <Routes>
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<div>inside</div>} />
      </Route>
      <Route path="/auth" element={<div>login</div>} />
    </Routes>
  </MemoryRouter>
);

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLDivElement | null = null;
const text = () => host?.textContent ?? "";
async function mount() {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(ui());
  });
}
async function rerender() {
  await act(async () => {
    root?.render(ui());
  });
}
async function settle(ms = 0) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}
async function until(pred: () => boolean, timeoutMs = 4000) {
  const end = Date.now() + timeoutMs;
  while (!pred() && Date.now() < end) await settle(50);
  expect(pred()).toBe(true);
}

describe("ProtectedRoute Core membership gate", () => {
  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    root = null;
  });
  beforeEach(() => {
    h.rpc.mockReset();
    h.auth.user = { id: "u1" };
    h.auth.session = { access_token: "t1" };
    h.auth.loading = false;
  });

  it("admits only on an explicit true from Core", async () => {
    h.rpc.mockResolvedValue({ data: true, error: null });
    await mount();
    await until(() => text().includes("inside"));
    expect(h.rpc).toHaveBeenCalledWith("has_ai_studio_permission_v1", {
      p_key: "ai_studio.app.access",
    });
  });

  it("shows 'not approved' only when Core answers false", async () => {
    h.rpc.mockResolvedValue({ data: false, error: null });
    await mount();
    await until(() => text().includes("AI Studio access not approved"));
    expect(h.rpc).toHaveBeenCalledTimes(1);
  });

  it("fails closed with a retry state when verification keeps failing, and never admits", async () => {
    h.rpc.mockRejectedValue(new Error("network"));
    await mount();
    await until(() => text().includes("Unable to verify AI Studio access"));
    expect(text()).not.toContain("inside");
    expect(h.rpc).toHaveBeenCalledTimes(3);
  }, 8000);

  it("treats a missing RPC error as unverified, not as admission", async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: "PGRST202" } });
    await mount();
    await until(() => text().includes("Unable to verify AI Studio access"));
  }, 8000);

  it("keeps the protected tree mounted when only the token refreshes", async () => {
    h.rpc.mockResolvedValue({ data: true, error: null });
    await mount();
    await until(() => text().includes("inside"));
    h.auth.session = { access_token: "t2" };
    await rerender();
    expect(text()).not.toContain("Checking Studio membership");
    expect(text()).toContain("inside");
    await until(() => h.rpc.mock.calls.length === 2);
    expect(text()).toContain("inside");
  });

  it("revokes immediately when a refresh re-check returns false", async () => {
    h.rpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValue({ data: false, error: null });
    await mount();
    await until(() => text().includes("inside"));
    h.auth.session = { access_token: "t2" };
    await rerender();
    await until(() => text().includes("AI Studio access not approved"));
  });

  it("redirects unauthenticated visitors", async () => {
    h.auth.user = null;
    await mount();
    await until(() => text().includes("login"));
    expect(h.rpc).not.toHaveBeenCalled();
  });
});
