import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FastCreateSuggestions } from "./fastCreateSuggestions";

const rpcMock = vi.fn(async (fn: string, args: Record<string, unknown>) => {
  if (fn === "submit_catalogue_product_draft_v1") {
    return { data: [{ draft_id: "draft-1", already_pending: false }], error: null };
  }
  return {
    data: `OAS-${args._division_code}-${args._category_code}-${args._subcategory_code}-${args._packaging_code}-0001`,
    error: null,
  };
});

const fromMock = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (fn: string, args: Record<string, unknown>) => rpcMock(fn, args),
    from: fromMock,
  },
}));

const assertNoBlockingProductCollisionsMock = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("@/features/productGovernance/productDuplicateContract", () => ({
  assertNoBlockingProductCollisions: assertNoBlockingProductCollisionsMock,
}));

vi.mock("@/shared/auth/centralPermissions", () => ({
  canWriteProductsDirectly: async (roles?: string[]) =>
    !!roles?.some((r) => ["super_admin", "owner", "admin", "product_manager"].includes(r)),
  isCatalogueContributor: async () => false,
}));

const {
  buildFastCreateGroupedDraftPayload,
  requireFastCreateSku,
  resolveFastCreateSubmitReceipt,
  saveFastCreateProduct,
  FAST_CREATE_UNSUPPORTED_CLASS_MESSAGE_PREFIX,
  verifiedFastCreatePieceQuantity,
} = await import("./saveFastCreateProduct");

const minimalSuggestions: FastCreateSuggestions = {
  formPatch: {
    product_name: "Test Product",
    category: "Baklawa",
    production_department: "arabic_sweets",
  },
  aliases: [],
  whatsappKeywords: [],
  searchKeywords: [],
  labelStarter: {
    product_name: "Test Product",
    ingredients_hint: "",
    allergen_hint: "",
    net_weight_hint: "",
  },
  productTruthStarters: { piecesPerKg: null, traysPerMasterCarton: null, primaryPackSummary: null },
  sources: { defaults: true, heuristicAliases: false, aiCompliance: false, aiAliases: false },
};

describe("Fast Create Core submission receipts", () => {
  it("retains the operator draft on idempotent already-pending results", () => {
    const receipt = resolveFastCreateSubmitReceipt({
      draft: true,
      draftId: "existing-draft",
      alreadyPending: true,
    });
    expect(receipt).toMatchObject({
      clearDraft: false,
      navigateTo: null,
      tone: "warning",
    });
    expect(receipt.message).toContain("NOT submitted");
    expect(receipt.message).toContain("Inputs remain here");
  });

  it("clears the draft and opens approvals only when a new draft was submitted", () => {
    const receipt = resolveFastCreateSubmitReceipt({
      draft: true,
      draftId: "new-draft",
      alreadyPending: false,
    });
    expect(receipt).toMatchObject({
      clearDraft: true,
      navigateTo: "/approvals",
      tone: "success",
      message: "Product draft submitted for approval.",
    });
  });

  it("preserves the legacy direct-create compatibility receipt", () => {
    const receipt = resolveFastCreateSubmitReceipt({
      id: "product-123",
      sku: "OAS-AS-BKL-ASS-PAPERBOX-0001",
    });
    expect(receipt).toMatchObject({
      clearDraft: true,
      navigateTo: "/products/product-123",
      tone: "success",
    });
  });
});

describe("requireFastCreateSku — packaging authority", () => {
  beforeEach(() => {
    rpcMock.mockClear();
  });

  it("generates a fresh SKU using the operator's packaging selection", async () => {
    const result = await requireFastCreateSku("ready_packs", null, "PAPERBOX");
    expect(result.sku).toBe("OAS-AS-BKL-ASS-PAPERBOX-0001");
    expect(result.codes.packaging_code).toBe("PAPERBOX");
  });

  it("reuses an existing valid SKU when its packaging segment still matches", async () => {
    const existing = "OAS-AS-BKL-ASS-PAPERBOX-0042";
    const result = await requireFastCreateSku("ready_packs", existing, "PAPERBOX");
    expect(result.sku).toBe(existing);
    expect(result.codes.packaging_code).toBe("PAPERBOX");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("regenerates a stale SKU after packaging changes", async () => {
    const staleExisting = "OAS-AS-BKL-ASS-RBOX-0042";
    const result = await requireFastCreateSku("ready_packs", staleExisting, "PAPERBOX");
    expect(result.sku).not.toBe(staleExisting);
    expect(result.sku).toContain("PAPERBOX");
    expect(result.codes.packaging_code).toBe("PAPERBOX");
  });

  it("keeps the SKU and returned packaging code aligned", async () => {
    const noOverride = await requireFastCreateSku("baklawa", null, null);
    expect(skuPackagingOf(noOverride.sku)).toBe(noOverride.codes.packaging_code);

    const reused = await requireFastCreateSku("ready_packs", "OAS-AS-BKL-ASS-RBOX-0001", "RBOX");
    expect(skuPackagingOf(reused.sku)).toBe(reused.codes.packaging_code);

    const regenerated = await requireFastCreateSku(
      "ready_packs",
      "OAS-AS-BKL-ASS-RBOX-0001",
      "TIN",
    );
    expect(skuPackagingOf(regenerated.sku)).toBe(regenerated.codes.packaging_code);
  });
});

function skuPackagingOf(sku: string): string {
  return sku.split("-")[4];
}

describe("buildFastCreateGroupedDraftPayload", () => {
  it("includes structured SKU and governed Fast Create metadata", () => {
    const payload = buildFastCreateGroupedDraftPayload(
      {
        product_name: "Test Product",
        category: "Baklawa",
        product_class: "bulk_loose_product",
      },
      "https://example.com/hero.jpg",
      minimalSuggestions,
      {
        sku: "OAS-AS-BKL-ASS-LOOSE-0001",
        codes: {
          division_code: "AS",
          category_code: "BKL",
          subcategory_code: "ASS",
          packaging_code: "LOOSE",
        },
      },
    );

    expect(payload.sku_draft).toMatchObject({
      sku: "OAS-AS-BKL-ASS-LOOSE-0001",
      packaging_code: "LOOSE",
    });
    expect(payload.fast_create_meta).toMatchObject({
      source: "fast_create",
      is_catalogue_ready: false,
      is_active: true,
    });
    expect(payload.media).toEqual({ hero_image_url: "https://example.com/hero.jpg" });
  });
});

describe("saveFastCreateProduct — governed draft only", () => {
  beforeEach(() => {
    rpcMock.mockClear();
    fromMock.mockClear();
    assertNoBlockingProductCollisionsMock.mockReset();
    assertNoBlockingProductCollisionsMock.mockResolvedValue(undefined);
  });

  it("submits via Core draft RPC for privileged roles and never writes products directly", async () => {
    const result = await saveFastCreateProduct({
      suggestions: minimalSuggestions,
      heroUrl: null,
      roles: ["owner"],
      categoryKey: "other",
    });

    expect(result).toEqual({ draft: true, draftId: "draft-1", alreadyPending: false });
    expect(rpcMock).toHaveBeenCalledWith(
      "submit_catalogue_product_draft_v1",
      expect.objectContaining({ p_operation: "create" }),
    );
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("propagates Core already_pending without overwriting the prior product draft", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [{ draft_id: "prior-draft", already_pending: true }],
      error: null,
    });

    const result = await saveFastCreateProduct({
      suggestions: minimalSuggestions,
      heroUrl: null,
      roles: ["owner"],
      categoryKey: "other",
      resolvedSku: "OAS-AS-BKL-ASS-LOOSE-0001",
    });

    expect(result).toEqual({ draft: true, draftId: "prior-draft", alreadyPending: true });
    expect(resolveFastCreateSubmitReceipt(result).clearDraft).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("does not claim success when Core omits the idempotency receipt field", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [{ draft_id: "unverified-draft", already_pending: undefined as unknown as boolean }],
      error: null,
    });

    await expect(
      saveFastCreateProduct({
        suggestions: minimalSuggestions,
        heroUrl: null,
        roles: ["owner"],
        categoryKey: "other",
        resolvedSku: "OAS-AS-BKL-ASS-LOOSE-0001",
      }),
    ).rejects.toThrow(/Core draft receipt is incomplete/i);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("excludes pending AI aliases from the governed draft search payload", async () => {
    await saveFastCreateProduct({
      suggestions: {
        ...minimalSuggestions,
        aliases: [
          { alias: "heuristic alias", alias_type: "search_term" },
          { alias: "ai alias one", alias_type: "search_term" },
        ],
        pendingAiAliases: [{ alias: "ai alias one", alias_type: "search_term" }],
        sources: {
          defaults: true,
          heuristicAliases: true,
          aiCompliance: false,
          aiAliases: true,
        },
      },
      heroUrl: null,
      roles: ["owner"],
      categoryKey: "other",
    });

    const rpcArgs = rpcMock.mock.calls.find(
      ([fn]) => fn === "submit_catalogue_product_draft_v1",
    )?.[1] as { p_payload?: { search?: { suggested_aliases?: string[] } } };
    const aliases = rpcArgs?.p_payload?.search?.suggested_aliases ?? [];
    expect(aliases).toContain("heuristic alias");
    expect(aliases).not.toContain("ai alias one");
  });

  it("blocks internal_bom instead of defaulting it to a sellable class", async () => {
    await expect(
      saveFastCreateProduct({
        suggestions: minimalSuggestions,
        heroUrl: null,
        roles: ["owner"],
        categoryKey: "other",
        saleType: "internal_bom",
      }),
    ).rejects.toThrow(FAST_CREATE_UNSUPPORTED_CLASS_MESSAGE_PREFIX);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("blocks internal_bom even when heuristics already set a product_class", async () => {
    await expect(
      saveFastCreateProduct({
        suggestions: {
          ...minimalSuggestions,
          formPatch: { ...minimalSuggestions.formPatch, product_class: "bulk_loose_product" },
        },
        heroUrl: null,
        roles: ["owner"],
        categoryKey: "other",
        saleType: "internal_bom",
      }),
    ).rejects.toThrow(FAST_CREATE_UNSUPPORTED_CLASS_MESSAGE_PREFIX);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("allows b2b_horeca as a governed draft", async () => {
    const result = await saveFastCreateProduct({
      suggestions: minimalSuggestions,
      heroUrl: null,
      roles: ["owner"],
      categoryKey: "other",
      saleType: "b2b_horeca",
    });
    expect("draft" in result && result.draft).toBe(true);
  });

  it("carries intake barcode into the draft and checks exact duplicate collisions", async () => {
    await saveFastCreateProduct({
      suggestions: minimalSuggestions,
      heroUrl: null,
      roles: ["owner"],
      categoryKey: "other",
      extraFormPatch: { intake_barcode: "5901234123457" },
    });

    expect(assertNoBlockingProductCollisionsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        barcode: "5901234123457",
        sku: expect.any(String),
      }),
    );
    expect(rpcMock).toHaveBeenCalledWith(
      "submit_catalogue_product_draft_v1",
      expect.objectContaining({
        p_payload: expect.objectContaining({ intake_barcode: "5901234123457" }),
      }),
    );
  });

  it("fails closed when the Point28 exact duplicate probe blocks", async () => {
    assertNoBlockingProductCollisionsMock.mockRejectedValueOnce(
      new Error("SKU already exists: Alpha (OAS-001)."),
    );

    await expect(
      saveFastCreateProduct({
        suggestions: minimalSuggestions,
        heroUrl: null,
        roles: ["owner"],
        categoryKey: "other",
      }),
    ).rejects.toThrow(/SKU already exists/i);

    expect(rpcMock.mock.calls.some(([fn]) => fn === "submit_catalogue_product_draft_v1")).toBe(
      false,
    );
  });
});


describe("Fast Create typed content quantity — Core #486 draft evidence", () => {
  const skuResult = {
    sku: "OAS-AS-BKL-ASS-PAPERBOX-0001",
    codes: {
      division_code: "AS",
      category_code: "BKL",
      subcategory_code: "ASS",
      packaging_code: "PAPERBOX",
    },
  };

  it("preserves only an operator-confirmed positive integer as pieces, not weight", () => {
    expect(verifiedFastCreatePieceQuantity("retail_ready_pack", "6")).toEqual({
      value: 6,
      unit: "pcs",
    });
    for (const malformed of [undefined, null, 0, 6, "", "0", "-3", "2.5", "1e3", "0x6", "6 pcs"]) {
      expect(() => verifiedFastCreatePieceQuantity("retail_ready_pack", malformed)).toThrow(
        /positive whole number of pieces/i,
      );
    }
  });

  it("drops stale counts for sale types that do not ask for a piece count", () => {
    expect(verifiedFastCreatePieceQuantity("b2b_horeca", "6")).toBeNull();
    expect(verifiedFastCreatePieceQuantity("internal_bom", "6")).toBeNull();
    expect(verifiedFastCreatePieceQuantity(undefined, "6")).toBeNull();
  });

  it("puts a verified content quantity in the governed draft only", () => {
    const payload = buildFastCreateGroupedDraftPayload(
      { product_name: "Pack of Six", category: "Baklawa", pcs_per_pack: "6" },
      null,
      minimalSuggestions,
      skuResult,
      verifiedFastCreatePieceQuantity("retail_ready_pack", "6"),
    );
    expect(payload.packing).toEqual({ content_quantity: { value: 6, unit: "pcs" } });
    expect(payload).not.toHaveProperty("pricing");
    expect(payload).not.toHaveProperty("uom");
    const hidden = buildFastCreateGroupedDraftPayload(
      { product_name: "Bulk", category: "Baklawa", pcs_per_pack: "6" },
      null,
      minimalSuggestions,
      skuResult,
      verifiedFastCreatePieceQuantity("b2b_horeca", "6"),
    );
    expect(hidden).not.toHaveProperty("packing");
  });

  it("rejects a retail draft with unverified quantity before calling Core", async () => {
    rpcMock.mockClear();
    await expect(
      saveFastCreateProduct({
        suggestions: minimalSuggestions,
        heroUrl: null,
        roles: ["owner"],
        categoryKey: "ready_packs",
        saleType: "retail_ready_pack",
        extraFormPatch: { pcs_per_pack: "3.5" },
      }),
    ).rejects.toThrow(/positive whole number of pieces/i);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("does not serialize a hidden stale count in a valid non-retail draft", async () => {
    rpcMock.mockClear();
    await saveFastCreateProduct({
      suggestions: minimalSuggestions,
      heroUrl: null,
      roles: ["owner"],
      categoryKey: "other",
      saleType: "b2b_horeca",
      extraFormPatch: { pcs_per_pack: "6" },
    });
    const args = rpcMock.mock.calls.find(([fn]) => fn === "submit_catalogue_product_draft_v1")?.[1] as
      | { p_payload?: Record<string, unknown> }
      | undefined;
    expect(args?.p_payload).not.toHaveProperty("packing");
  });
});
