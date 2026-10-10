import { beforeEach, describe, expect, it, vi } from "vitest";
import { canWriteMasterDirectly, canWriteProductsDirectly } from "./centralPermissions";

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
