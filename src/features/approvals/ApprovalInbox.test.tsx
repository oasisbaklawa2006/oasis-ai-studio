import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ApprovalInbox from "./ApprovalInbox";
import { formatPricing } from "./formatPricing";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), rows: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("@/hooks/useCatalogueReviewer", () => ({
  useCatalogueReviewer: () => ({ isReviewer: true, loading: false }),
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.success, error: mocks.error, warning: vi.fn() },
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: mocks.rpc,
    from: (table: string) => ({
      select: () => ({ in: () => ({ order: () => mocks.rows(table) }) }),
    }),
  },
}));
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  mocks.rows.mockImplementation(async (table) => ({
    error: null,
    data:
      table === "catalogue_bom_drafts"
        ? [{ id: "fixture", status: "pending_approval", payload: {} }]
        : [],
  }));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
it("does not announce approval for Core's HTTP-success unmapped result", async () => {
  mocks.rpc.mockResolvedValue({
    error: null,
    data: { ok: false, message: "Approval mapping not finalized" },
  });
  await act(async () => root.render(<ApprovalInbox />));
  const button = Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent === "Approve",
  );
  expect(button).toBeDefined();
  await act(async () => button?.click());
  expect(mocks.success).not.toHaveBeenCalled();
  expect(mocks.error).toHaveBeenCalledWith("Approval mapping not finalized");
});
it("fails closed with retry UX when one draft source fails", async () => {
  mocks.rows.mockRejectedValue(new Error("offline"));
  await act(async () => root.render(<ApprovalInbox />));
  expect(container.textContent).toContain("Could not refresh approval inbox");
  expect(container.textContent).toContain("Retry");
  expect(
    Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Approve"),
  ).toBeUndefined();
});

it("formats only trusted scalar pricing values", () => {
  expect(
    formatPricing({ pricing: { mrp: 125, b2b_price: " 100 ", export_price: 0, gst_rate: 5 } }),
  ).toBe("MRP: 125 • B2B: 100 • Export: 0 • GST: 5");
  expect(formatPricing({ pricing: { mrp: { amount: 125 } } })).toBe("—");
  expect(formatPricing({ pricing: "legacy price" })).toBe("legacy price");
  expect(formatPricing({ pricing: { nested: { value: "bad fallback" } } })).toBe("—");
  expect(formatPricing({ pricing: null })).toBe("—");
});
