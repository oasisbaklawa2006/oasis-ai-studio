import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AliasManager } from "./AliasManager";

const mocks = vi.hoisted(() => ({
  order: vi.fn(),
  notify: vi.fn(),
  roles: ["owner"],
  error: vi.fn(),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ roles: mocks.roles }) }));
vi.mock("sonner", () => ({ toast: { error: mocks.error, success: vi.fn(), info: vi.fn() } }));
vi.mock("@/shared/auth/centralPermissions", () => ({
  canWriteMasterDirectly: async () => true,
  isCatalogueContributor: async () => false,
  canSubmitDraft: async () => false,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ order: mocks.order }) }) }) },
}));
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  mocks.order.mockResolvedValue({ data: [], error: null });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
async function render(productId = "core-product", callback: () => void = mocks.notify) {
  await act(async () =>
    root.render(
      <AliasManager
        productId={productId}
        productName="Canonical name"
        onAliasesChange={callback}
      />,
    ),
  );
}
describe("canonical alias load recovery", () => {
  it("does not refresh the parent or refetch when its callback identity changes", async () => {
    await render();
    await render("core-product", () => mocks.notify());
    expect(mocks.order).toHaveBeenCalledTimes(1);
    expect(mocks.notify).not.toHaveBeenCalled();
  });
  it("shows a retry after a rejected read instead of claiming an empty catalogue", async () => {
    mocks.order.mockRejectedValueOnce(new Error("Connection interrupted"));
    await render();
    expect(container.textContent).toContain("Aliases could not be loaded");
    const retry = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "Retry aliases",
    );
    expect(retry).toBeDefined();
    await act(async () => retry?.click());
    expect(mocks.order).toHaveBeenCalledTimes(2);
    expect(container.textContent).not.toContain("Aliases could not be loaded");
  });
  it("ignores a response for a product that is no longer selected", async () => {
    let finish: (value: unknown) => void = () => {};
    mocks.order.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await render("old-product");
    await render("new-product");
    await act(async () =>
      finish({
        data: [
          {
            id: "old-alias",
            alias_text: "Wrong product alias",
            product_id: "old-product",
            canonical_name: "Old name",
          },
        ],
        error: null,
      }),
    );
    expect(container.textContent).not.toContain("Wrong product alias");
    expect(mocks.order).toHaveBeenCalledTimes(2);
  });
});
