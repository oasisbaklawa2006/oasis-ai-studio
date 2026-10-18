import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CATALOGUE_AI_TIMEOUT_MS, generateCatalogueContentDraft } from "./catalogueAiGateway";

const session = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession: session } } }));
beforeEach(() => {
  vi.stubEnv("VITE_CATALOGUE_AI_ENABLED", "true");
  vi.stubEnv("VITE_SUPABASE_URL", "https://example.invalid");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "public-test-key");
  session.mockResolvedValue({
    data: { session: { access_token: "synthetic-token" } },
    error: null,
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
describe("catalogue AI transport recovery", () => {
  it("returns an actionable result when session lookup rejects without calling provider", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    session.mockRejectedValue(new Error("network"));
    expect(await generateCatalogueContentDraft({ productName: "Test" })).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/Session unavailable/),
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("aborts stalled requests once, with no automatic paid retry", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(
      (_url, opts) =>
        new Promise((_resolve, reject) => {
          opts.signal.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );
    vi.stubGlobal("fetch", fetcher);
    const result = generateCatalogueContentDraft({ productName: "Test" });
    await vi.advanceTimersByTimeAsync(CATALOGUE_AI_TIMEOUT_MS);
    expect(await result).toMatchObject({ ok: false, reason: expect.stringMatching(/timed out/) });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("covers a stalled response body and clears its timer", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url, opts) =>
        Promise.resolve({
          ok: true,
          json: () =>
            new Promise((_resolve, reject) => {
              opts.signal.addEventListener("abort", () => reject(new Error("aborted")));
            }),
        }),
      ),
    );
    const result = generateCatalogueContentDraft({ productName: "Test" });
    await vi.advanceTimersByTimeAsync(CATALOGUE_AI_TIMEOUT_MS);
    expect(await result).toMatchObject({ ok: false, reason: expect.stringMatching(/timed out/) });
    expect(vi.getTimerCount()).toBe(0);
  });
  it("rejects malformed output and clears timer after normal completion", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error("invalid json");
        },
      }),
    );
    expect(await generateCatalogueContentDraft({ productName: "Test" })).toMatchObject({
      ok: false,
    });
    expect(vi.getTimerCount()).toBe(0);
  });
});
