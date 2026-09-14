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
  saveFastCreateProduct,
  FAST_CREATE_UNSUPPORTED_CLASS_MESSAGE_PREFIX,
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
    expect(result.draft).toBe(true);
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

    expect(
      rpcMock.mock.calls.some(([fn]) => fn === "submit_catalogue_product_draft_v1"),
    ).toBe(false);
  });
});
