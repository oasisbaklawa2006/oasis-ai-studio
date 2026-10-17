import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import MediaReview from "./MediaReview";

const desk = vi.hoisted(() => ({ fetch: vi.fn(), reject: vi.fn(), approve: vi.fn() }));
vi.mock("@/features/mediaWorkspace/mediaReviewDesk", () => ({
  fetchMediaSubmissions: desk.fetch,
  rejectMediaSubmission: desk.reject,
  approveMediaSubmission: desk.approve,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  desk.fetch.mockResolvedValue([
    {
      id: "fixture",
      status: "pending_approval",
      payload: { product_id: "canonical-id", file_url: "https://example.invalid/photo.png" },
    },
  ]);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
async function render() {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <MediaReview />
      </MemoryRouter>,
    ),
  );
}
function button(label: string) {
  return Array.from(container.querySelectorAll("button")).find((b) => b.textContent === label);
}
async function reason() {
  await act(async () => {
    const input = container.querySelector("input");
    if (!input) throw new Error("Missing rejection reason input");
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(
      input,
      "Wrong image",
    );
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
it("removes stale actionable rows on refresh failure and offers recovery", async () => {
  await render();
  await reason();
  desk.reject.mockResolvedValue({ ok: true });
  desk.fetch.mockRejectedValueOnce(new Error("offline"));
  await act(async () => button("Reject")?.click());
  expect(container.textContent).toContain("offline");
  expect(button("Reject")).toBeUndefined();
  expect(button("Retry")).toBeDefined();
  await act(async () => button("Retry")?.click());
  expect(container.textContent).toContain("canonical-id");
  expect(container.textContent).not.toContain("offline");
});
it("prevents duplicate actions before React rerenders", async () => {
  await render();
  await reason();
  let resolve!: (result: { ok: boolean }) => void;
  desk.reject.mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  await act(async () => {
    button("Reject")?.click();
    button("Reject")?.click();
  });
  expect(desk.reject).toHaveBeenCalledTimes(1);
  await act(async () => resolve({ ok: true }));
});
