import { beforeEach, describe, expect, it, vi } from "vitest";
import { approveMediaSubmission, rejectMediaSubmission } from "./mediaReviewDesk";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
beforeEach(() => {
  rpc.mockReset();
});
describe("media review RPC failure recovery", () => {
  it.each([
    "approval",
    "rejection",
  ])("does not claim successful %s when the transport rejects", async (action) => {
    rpc.mockRejectedValue(new Error("network"));
    const result =
      action === "approval"
        ? await approveMediaSubmission("fixture")
        : await rejectMediaSubmission("fixture", "wrong image");
    expect(result).toMatchObject({
      ok: false,
      message: expect.stringMatching(/Refresh submissions before retrying/),
    });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("preserves backend denial and never retries", async () => {
    rpc.mockResolvedValue({ error: { message: "Catalogue reviewer permission required" } });
    expect(await approveMediaSubmission("fixture")).toEqual({
      ok: false,
      message: "Catalogue reviewer permission required",
    });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("requires a nonblank reason before network I/O", async () => {
    expect(await rejectMediaSubmission("fixture", "  ")).toMatchObject({ ok: false });
    expect(rpc).not.toHaveBeenCalled();
  });
});

it("fails closed on HTTP-success application denial and malformed payload", async () => {
  rpc.mockResolvedValue({
    error: null,
    data: { ok: false, message: "Approval mapping not finalized" },
  });
  expect(await approveMediaSubmission("fixture")).toMatchObject({ ok: false });
  rpc.mockResolvedValue({ error: null, data: null });
  expect(await rejectMediaSubmission("fixture", "wrong image")).toMatchObject({ ok: false });
});
it("accepts only the canonical matching review outcome", async () => {
  rpc.mockResolvedValue({
    error: null,
    data: {
      ok: true,
      action: "approved",
      draft_id: "fixture",
      draft_table: "catalogue_media_submissions",
    },
  });
  expect(await approveMediaSubmission("fixture")).toEqual({ ok: true, message: "Approved" });
});
