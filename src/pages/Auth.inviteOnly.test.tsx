import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Auth from "./Auth";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  useAuth: vi.fn(),
  signInWithPassword: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("react-router-dom", () => ({ useNavigate: () => mocks.navigate }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => mocks.useAuth() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { signInWithPassword: mocks.signInWithPassword } },
}));
vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }));

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  mocks.navigate.mockReset();
  mocks.useAuth.mockReset().mockReturnValue({ user: null });
  mocks.signInWithPassword.mockReset().mockResolvedValue({ error: null });
  mocks.toastError.mockReset();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe("Studio's invite-only entry (#272)", () => {
  it("renders approved employee sign-in without public registration or social sign-up", async () => {
    await act(async () => root.render(<Auth />));
    expect(host.textContent).toContain("Employee sign in");
    expect(host.textContent).toContain("approved Oasis staff account");
    expect(host.querySelector('input[type="email"]')).not.toBeNull();
    expect(host.querySelector('input[type="password"]')).not.toBeNull();
    expect(host.querySelector('button[type="submit"]')?.textContent).toContain("Sign In");
    expect(host.textContent).not.toContain("Create Account");
    expect(host.textContent).not.toContain("Continue with Google");
    expect(host.textContent).not.toContain("Continue with Apple");
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
  });

  it("continues to send an existing signed-in employee to the Studio dashboard", async () => {
    mocks.useAuth.mockReturnValue({ user: { id: "employee-id" } });
    await act(async () => root.render(<Auth />));
    expect(mocks.navigate).toHaveBeenCalledWith("/");
  });

  it("does not create any new identity when a signed-out employee views the entry", async () => {
    await act(async () => root.render(<Auth />));
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
    expect(host.querySelector("form")?.getAttribute("method")).toBeNull();
  });
});
