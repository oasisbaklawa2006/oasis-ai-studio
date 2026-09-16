import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FastCreateSuggestions } from "@/features/fastCreate/fastCreateSuggestions";
import { enrichFastCreateWithGovernedAi } from "./index";

const invokeMock = vi.fn();
const getSessionMock = vi.fn();
const fetchMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => getSessionMock(...args),
    },
    functions: {
      invoke: (...args: unknown[]) => invokeMock(...args),
    },
  },
}));

function buildBaseSuggestions(): FastCreateSuggestions {
  return {
    formPatch: { ingredients: "", allergen_warnings: "" },
    aliases: [{ alias: "heuristic alias", alias_type: "search_term" }],
    whatsappKeywords: ["heuristic"],
    searchKeywords: ["heuristic alias"],
    labelStarter: {
      product_name: "Pyramid Baklawa",
      ingredients_hint: "base ingredients",
      allergen_hint: "base allergens",
      net_weight_hint: "500g",
    },
    productTruthStarters: {
      piecesPerKg: null,
      traysPerMasterCarton: null,
      primaryPackSummary: null,
    },
    sources: {
      defaults: true,
      heuristicAliases: true,
      aiCompliance: false,
      aiAliases: false,
    },
  };
}

beforeEach(() => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({ data: null, error: { message: "offline" } });
  getSessionMock.mockReset();
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as typeof fetch;
  import.meta.env.VITE_SUPABASE_URL = "https://test-project.supabase.co";
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY = "must-never-be-used-as-bearer";
});

describe("oasis-ai-chat authenticated alias enrichment", () => {
  it("sends the active staff access token and never the publishable key", async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: "test-user-access-token" } },
      error: null,
    });
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "data: [DONE]",
    });

    await enrichFastCreateWithGovernedAi(
      buildBaseSuggestions(),
      "Pyramid Baklawa",
      "baklawa",
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://test-project.supabase.co/functions/v1/oasis-ai-chat");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
      Authorization: "Bearer test-user-access-token",
    });
    expect(JSON.stringify(init.headers)).not.toContain("must-never-be-used-as-bearer");
  });

  it("fails closed and does not call the provider when the staff session is missing", async () => {
    getSessionMock.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const { provenance } = await enrichFastCreateWithGovernedAi(
      buildBaseSuggestions(),
      "Pyramid Baklawa",
      "baklawa",
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      provenance.some(
        (entry) =>
          entry.service === "oasis-ai-chat" &&
          entry.provider_status === "degraded" &&
          entry.fail_closed === true &&
          entry.uncertainty_reason?.includes("Authenticated staff session required"),
      ),
    ).toBe(true);
  });

  it("fails closed and does not call the provider when session lookup errors", async () => {
    getSessionMock.mockResolvedValue({
      data: { session: null },
      error: { message: "auth unavailable" },
    });

    const { provenance } = await enrichFastCreateWithGovernedAi(
      buildBaseSuggestions(),
      "Pyramid Baklawa",
      "baklawa",
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      provenance.some(
        (entry) =>
          entry.service === "oasis-ai-chat" &&
          entry.provider_status === "degraded" &&
          entry.fail_closed === true,
      ),
    ).toBe(true);
  });
});
