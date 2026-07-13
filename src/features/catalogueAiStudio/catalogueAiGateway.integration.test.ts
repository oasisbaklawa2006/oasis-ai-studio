import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeGovernedAi } = vi.hoisted(() => ({ invokeGovernedAi: vi.fn() }));
vi.mock("@/shared/ai/governedAiClient", () => ({ invokeGovernedAi }));

import { generateCatalogueContentDraft } from "./catalogueAiGateway";
import { CATALOGUE_DRAFT_CONTENT_KEYS } from "./catalogueDraftTypes";

const validContent = Object.fromEntries(
  CATALOGUE_DRAFT_CONTENT_KEYS.map((key) => [key, `safe ${key}`]),
);

describe("generateCatalogueContentDraft governed request", () => {
  beforeEach(() => invokeGovernedAi.mockReset());

  it("sends bounded facts as a named task rather than a browser-authored model prompt", async () => {
    invokeGovernedAi.mockResolvedValue({
      ok: true,
      cached: false,
      data: { suggestion_only: true, approved: false, content: validContent },
    });
    const result = await generateCatalogueContentDraft({ productName: "Nut Bite", category: "Sweets" }, "Premium");

    expect(result.ok).toBe(true);
    expect(invokeGovernedAi).toHaveBeenCalledWith("oasis-ai-chat", {
      task: "catalogue_copy",
      facts: { productName: "Nut Bite", category: "Sweets" },
      tone: "Premium",
    });
  });

  it("rejects output that is not explicitly unapproved and suggestion-only", async () => {
    invokeGovernedAi.mockResolvedValue({
      ok: true,
      cached: false,
      data: { suggestion_only: false, approved: true, content: validContent },
    });
    const result = await generateCatalogueContentDraft({ productName: "Nut Bite" });
    expect(result).toMatchObject({ ok: false });
  });

  it("does not admit malformed model content into editor state", async () => {
    invokeGovernedAi.mockResolvedValue({
      ok: true,
      cached: false,
      data: { suggestion_only: true, approved: false, content: { catalogue_title: "Only one field" } },
    });
    const result = await generateCatalogueContentDraft({ productName: "Nut Bite" });
    expect(result.ok).toBe(false);
  });
});
