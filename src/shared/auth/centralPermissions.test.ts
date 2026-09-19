import { beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

import { isCatalogueReviewer } from "./centralPermissions";

beforeEach(() => {
  rpcMock.mockReset();
});

// Both AppLayout's nav visibility and the router-level CatalogueReviewerGate
// (and every page it wraps) consume this single resolver — see #228. It must
// fail closed in every non-affirmative case so nav and page access can never
// diverge again.
describe("isCatalogueReviewer", () => {
  it("grants access for an authorized catalogue reviewer", async () => {
    rpcMock.mockResolvedValue({ data: true, error: null });

    await expect(isCatalogueReviewer()).resolves.toBe(true);
    expect(rpcMock).toHaveBeenCalledWith("is_catalogue_reviewer");
  });

  it("grants access when the canonical Core permission mapping resolves true for a super-admin caller", async () => {
    // The client never inspects role — Core's is_catalogue_reviewer() RPC is the
    // sole authority. This exercises the same "permission granted" path a
    // super_admin caller takes today under the current permission mapping.
    rpcMock.mockResolvedValue({ data: true, error: null });

    await expect(isCatalogueReviewer()).resolves.toBe(true);
  });

  it("fails closed for an owner/admin caller without the reviewer permission", async () => {
    rpcMock.mockResolvedValue({ data: false, error: null });

    await expect(isCatalogueReviewer()).resolves.toBe(false);
  });

  it("fails closed for an unauthenticated caller", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "JWT expired", code: "PGRST301" },
    });

    await expect(isCatalogueReviewer()).resolves.toBe(false);
  });

  it("fails closed when the permission RPC itself errors", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "connection reset", code: "08006" },
    });

    await expect(isCatalogueReviewer()).resolves.toBe(false);
  });

  it("fails closed when the RPC call rejects outright", async () => {
    rpcMock.mockRejectedValue(new Error("network loss"));

    await expect(isCatalogueReviewer()).resolves.toBe(false);
  });
});
