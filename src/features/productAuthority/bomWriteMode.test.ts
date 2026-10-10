import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { Role } from "@/lib/permissions";
import { resolveBomWriteMode, useBomWriteMode } from "./bomWriteMode";

const permissionRpcs = vi.hoisted(() => ({
  canWriteMasterDirectly: vi.fn(),
  isCatalogueContributor: vi.fn(),
  canSubmitDraft: vi.fn(),
}));

vi.mock("@/shared/auth/centralPermissions", () => permissionRpcs);

function resetRpcs() {
  permissionRpcs.canWriteMasterDirectly.mockReset().mockResolvedValue(false);
  permissionRpcs.isCatalogueContributor.mockReset().mockResolvedValue(false);
  permissionRpcs.canSubmitDraft.mockReset().mockResolvedValue(false);
}

describe("resolveBomWriteMode", () => {
  it("honors canonical direct roles without an unnecessary RPC", async () => {
    resetRpcs();
    expect(await resolveBomWriteMode(["product_manager"])).toBe("direct");
    expect(permissionRpcs.canWriteMasterDirectly).not.toHaveBeenCalled();
  });

  it("requires contributor identity and permission for a BOM draft", async () => {
    resetRpcs();
    permissionRpcs.isCatalogueContributor.mockResolvedValueOnce(true);
    permissionRpcs.canSubmitDraft.mockResolvedValueOnce(true);
    expect(await resolveBomWriteMode(["catalogue_contributor"])).toBe("draft");
    expect(permissionRpcs.canSubmitDraft).toHaveBeenCalledWith(expect.any(String));
  });

  it("fails closed for denied or rejected permission resolution", async () => {
    resetRpcs();
    expect(await resolveBomWriteMode(["sales"])).toBe("readonly");
    permissionRpcs.canWriteMasterDirectly.mockRejectedValueOnce(new Error("session expired"));
    expect(await resolveBomWriteMode(["sales"])).toBe("readonly");
    permissionRpcs.isCatalogueContributor.mockRejectedValueOnce(new Error("network lost"));
    expect(await resolveBomWriteMode(["sales"])).toBe("readonly");
    permissionRpcs.isCatalogueContributor.mockResolvedValueOnce(true);
    permissionRpcs.canSubmitDraft.mockRejectedValueOnce(new Error("not authorized"));
    expect(await resolveBomWriteMode(["catalogue_contributor"])).toBe("readonly");
  });
});

describe("useBomWriteMode identity revalidation", () => {
  it("remains read-only when a prior user's pending direct permission resolves after sign-in switch", async () => {
    resetRpcs();
    let resolveFormer: (authorized: boolean) => void = () => {};
    const pendingFormer = new Promise<boolean>((resolve) => {
      resolveFormer = resolve;
    });
    permissionRpcs.canWriteMasterDirectly
      .mockImplementationOnce(() => pendingFormer)
      .mockResolvedValueOnce(false);

    const container = document.createElement("div");
    const root = createRoot(container);
    const observed: string[] = [];

    function Probe({ userId, roles }: { userId: string | null; roles: Role[] }) {
      const { writeMode, canMutate } = useBomWriteMode(userId, roles);
      observed.push(writeMode);
      return createElement("span", {}, `${writeMode}:${canMutate}`);
    }

    try {
      await act(async () => {
        root.render(createElement(Probe, { userId: "former", roles: ["sales"] }));
      });
      expect(container.textContent).toBe("readonly:false");

      await act(async () => {
        root.render(createElement(Probe, { userId: "current", roles: ["sales"] }));
      });
      expect(container.textContent).toBe("readonly:false");
      expect(permissionRpcs.canWriteMasterDirectly).toHaveBeenCalledTimes(2);

      await act(async () => {
        resolveFormer(true);
        await Promise.resolve();
      });
      expect(container.textContent).toBe("readonly:false");
      expect(observed).not.toContain("direct");
    } finally {
      await act(async () => {
        root.unmount();
      });
    }
  });

  it("hides an existing direct mode on role revocation without waiting for an RPC", async () => {
    resetRpcs();
    const container = document.createElement("div");
    const root = createRoot(container);

    function Probe({ roles }: { roles: Role[] }) {
      const { writeMode, canMutate } = useBomWriteMode("same-user", roles);
      return createElement("span", {}, `${writeMode}:${canMutate}`);
    }

    try {
      await act(async () => {
        root.render(createElement(Probe, { roles: ["owner"] }));
        await Promise.resolve();
      });
      expect(container.textContent).toBe("direct:true");

      await act(async () => {
        root.render(createElement(Probe, { roles: ["sales"] }));
        await Promise.resolve();
      });
      expect(container.textContent).toBe("readonly:false");
    } finally {
      await act(async () => {
        root.unmount();
      });
    }
  });
});
