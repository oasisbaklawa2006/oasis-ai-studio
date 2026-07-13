import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: {
          session: {
            access_token: "test-session-token",
            user: { id: "user-1" },
          },
        },
      })),
    },
  },
}));

import { invokeGovernedAi, resetGovernedAiClientState } from "./governedAiClient";

describe("invokeGovernedAi", () => {
  beforeEach(() => {
    resetGovernedAiClientState();
    vi.restoreAllMocks();
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "anon-key");
  });

  it("coalesces simultaneous identical requests and briefly caches a success", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ suggestion_only: true, aliases: ["Nut Bite"] }), { status: 200 }),
    );

    const [first, second] = await Promise.all([
      invokeGovernedAi("oasis-ai-chat", { task: "aliases", facts: { product_name: "Nut Bite" } }),
      invokeGovernedAi("oasis-ai-chat", { facts: { product_name: "Nut Bite" }, task: "aliases" }),
    ]);
    const third = await invokeGovernedAi("oasis-ai-chat", {
      task: "aliases",
      facts: { product_name: "Nut Bite" },
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(third.ok && third.cached).toBe(true);
  });

  it("rejects malformed JSON without caching it", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response("not-json", { status: 200 }),
    );
    const result = await invokeGovernedAi("generate-product-attributes", { product_name: "Baklawa" });
    const retry = await invokeGovernedAi("generate-product-attributes", { product_name: "Baklawa" });

    expect(result).toMatchObject({ ok: false, code: "malformed_response" });
    expect(retry).toMatchObject({ ok: false, code: "malformed_response" });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("maps rate limiting to an actionable retryable failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 429 }));
    const result = await invokeGovernedAi("oasis-ai-chat", { task: "aliases", facts: { product_name: "X" } });
    expect(result).toMatchObject({ ok: false, code: "rate_limited", retryable: true });
  });

  it("aborts a stalled provider request at the requested timeout", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));

    const result = await invokeGovernedAi(
      "oasis-ai-chat",
      { task: "aliases", facts: { product_name: "X" } },
      { timeoutMs: 1 },
    );
    expect(result).toMatchObject({ ok: false, code: "timeout", retryable: true });
  });
});
