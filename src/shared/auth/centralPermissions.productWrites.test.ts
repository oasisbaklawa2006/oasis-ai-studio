import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  canSubmitDraft,
  canWriteMasterDirectly,
  canWriteProductsDirectly,
  hasPermission,
} from "./centralPermissions";

const mock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: mock.rpc },
}));

describe("live product / media direct-write RLS authority", () => {
  beforeEach(() => {
    mock.rpc.mockReset();
  });

  it("grants direct product write only on confirmed backend is_admin true", async () => {
    mock.rpc.mockResolvedValueOnce({ data: true, error: null });
    expect(await canWriteProductsDirectly(["owner"])).toBe(true);
    expect(mock.rpc).toHaveBeenCalledTimes(1);
    expect(mock.rpc).toHaveBeenCalledWith("is_admin");
  });

  it("does not mistake mapped owner/product_manager or unrelated permission for direct write", async () => {
    mock.rpc.mockResolvedValue({ data: false, error: null });
    for (const roles of [["owner"], ["product_manager"], ["admin"], ["catalogue_contributor"]]) {
      expect(await canWriteProductsDirectly(roles)).toBe(false);
    }
    expect(mock.rpc).toHaveBeenCalledTimes(4);
    expect(mock.rpc).toHaveBeenCalledWith("is_admin");
  });

  it("fails closed when product-writing RLS cannot be verified", async () => {
    mock.rpc.mockResolvedValueOnce({ data: null, error: { message: "permission denied" } });
    expect(await canWriteProductsDirectly(["super_admin"])).toBe(false);
    mock.rpc.mockRejectedValueOnce(new Error("network interrupted"));
    expect(await canWriteProductsDirectly(["owner"])).toBe(false);
  });

  it("applies the same production authority to direct media writes", async () => {
    mock.rpc.mockResolvedValueOnce({ data: false, error: null });
    expect(await canWriteMasterDirectly()).toBe(false);
    mock.rpc.mockResolvedValueOnce({ data: true, error: null });
    expect(await canWriteMasterDirectly()).toBe(true);
    expect(mock.rpc).toHaveBeenCalledTimes(2);
  });
});

describe("catalogue contributor permission RPC matches the deployed Core function signature", () => {
  beforeEach(() => {
    mock.rpc.mockReset();
  });

  it("sends p_permission_key, not the obsolete permission_key argument", async () => {
    mock.rpc.mockResolvedValueOnce({ data: true, error: null });
    expect(await hasPermission("catalogue.products.submit")).toBe(true);
    expect(mock.rpc).toHaveBeenCalledTimes(1);
    expect(mock.rpc).toHaveBeenCalledWith("has_catalogue_permission", {
      p_permission_key: "catalogue.products.submit",
    });
  });

  it("submits only when contributor role and server permission are both confirmed", async () => {
    mock.rpc
      .mockResolvedValueOnce({ data: ["catalogue_contributor"], error: null })
      .mockResolvedValueOnce({ data: true, error: null });
    expect(await canSubmitDraft("catalogue.products.submit")).toBe(true);
    expect(mock.rpc).toHaveBeenNthCalledWith(1, "get_my_role_keys");
    expect(mock.rpc).toHaveBeenNthCalledWith(2, "has_catalogue_permission", {
      p_permission_key: "catalogue.products.submit",
    });
  });

  it("does not check submission permission when contributor role is missing", async () => {
    mock.rpc.mockResolvedValueOnce({ data: ["sales"], error: null });
    expect(await canSubmitDraft("catalogue.products.submit")).toBe(false);
    expect(mock.rpc).toHaveBeenCalledTimes(1);
  });

  it("fails closed when the permission RPC explicitly denies the draft", async () => {
    mock.rpc
      .mockResolvedValueOnce({ data: ["catalogue_contributor"], error: null })
      .mockResolvedValueOnce({ data: false, error: null });
    expect(await canSubmitDraft("catalogue.products.submit")).toBe(false);
  });

  it("fails closed when Core permission RPC reports a failure", async () => {
    mock.rpc.mockResolvedValueOnce({ data: null, error: { message: "RPC unavailable" } });
    expect(await hasPermission("catalogue.products.submit")).toBe(false);
  });

  it("fails closed when Core permission or role lookup rejects the request", async () => {
    mock.rpc.mockRejectedValueOnce(new Error("network interrupted"));
    expect(await hasPermission("catalogue.products.submit")).toBe(false);

    mock.rpc.mockRejectedValueOnce(new Error("auth session expired"));
    expect(await canSubmitDraft("catalogue.products.submit")).toBe(false);
    expect(mock.rpc).toHaveBeenCalledTimes(2);
  });
});
