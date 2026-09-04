import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FastCreateSuggestions } from "./fastCreateSuggestions";

const rpcMock = vi.fn(async (fn: string, args: Record<string, unknown>) => {
  if (fn === "catalogue_claim_intake_barcode") {
    return { data: String(args.p_barcode), error: null };
  }
  if (fn === "submit_catalogue_product_draft_v1") {
    return { data: [{ draft_id: "draft-1", already_pending: false }], error: null };
  }
  return {
    data: `OAS-${args._division_code}-${args._category_code}-${args._subcategory_code}-${args._packaging_code}-0001`,
    error: null,
  };
});

vi.mock("@/integrations/supabase/client", () => {
  const insertChain: Record<string, unknown> = {};
  insertChain.select = () => insertChain;
  insertChain.single = () =>
    Promise.resolve({ data: { id: "prod-1", sku: "OAS-AS-BKL-ASS-LOOSE-0001" }, error: null });
  return {
    supabase: {
      rpc: (fn: string, args: Record<string, unknown>) => rpcMock(fn, args),
      from: () => ({ insert: () => insertChain }),
    },
  };
});

vi.mock("@/shared/auth/centralPermissions", () => ({
  canWriteProductsDirectly: async (roles?: string[]) =>
    !!roles?.some((r) => ["super_admin", "owner", "admin", "product_manager"].includes(r)),
  isCatalogueContributor: async () => false,
}));

const insertProductAliasesMock = vi.hoisted(() => vi.fn(async () => ({ error: null })));

vi.mock("@/lib/aliasSchemaAdapter", () => ({
  insertProductAliases: insertProductAliasesMock,
}));

const {
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

describe("requireFastCreateSku — packaging authority (Defect 1 regression)", () => {
  beforeEach(() => {
    rpcMock.mockClear();
  });

  it("generates a fresh SKU using the operator's packaging selection when there is no prior SKU", async () => {
    const result = await requireFastCreateSku("ready_packs", null, "PAPERBOX");
    expect(result.sku).toBe("OAS-AS-BKL-ASS-PAPERBOX-0001");
    expect(result.codes.packaging_code).toBe("PAPERBOX");
  });

  it("reuses an existing valid SKU when its packaging segment still matches the current selection", async () => {
    const existing = "OAS-AS-BKL-ASS-PAPERBOX-0042";
    const result = await requireFastCreateSku("ready_packs", existing, "PAPERBOX");
    expect(result.sku).toBe(existing);
    expect(result.codes.packaging_code).toBe("PAPERBOX");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("does NOT let a stale preset overwrite a changed packaging selection (regression for Defect 1)", async () => {
    const staleExisting = "OAS-AS-BKL-ASS-RBOX-0042";
    const result = await requireFastCreateSku("ready_packs", staleExisting, "PAPERBOX");
    expect(result.sku).not.toBe(staleExisting);
    expect(result.sku).toContain("PAPERBOX");
    expect(result.codes.packaging_code).toBe("PAPERBOX");
  });

  it("keeps the SKU and returned packaging code in agreement in every branch", async () => {
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

describe("saveFastCreateProduct — unapproved AI aliases are not persisted", () => {
  beforeEach(() => {
    rpcMock.mockClear();
    insertProductAliasesMock.mockClear();
  });

  it("persists only approved/heuristic aliases and excludes pending AI suggestions", async () => {
    const result = await saveFastCreateProduct({
      suggestions: {
        ...minimalSuggestions,
        aliases: [
          { alias: "heuristic alias", alias_type: "search_term" },
          { alias: "ai alias one", alias_type: "search_term" },
        ],
        pendingAiAliases: [{ alias: "ai alias one", alias_type: "search_term" }],
        whatsappKeywords: ["heuristic", "ai alias one"],
        searchKeywords: ["heuristic alias", "ai alias one"],
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

    expect("id" in result).toBe(true);
    expect(insertProductAliasesMock).toHaveBeenCalledTimes(1);
    const rows = insertProductAliasesMock.mock.calls[0]?.[1] as Array<{ alias: string }>;
    expect(rows.some((row) => row.alias === "ai alias one")).toBe(false);
    expect(rows.some((row) => row.alias === "heuristic alias")).toBe(true);
  });
});

describe("saveFastCreateProduct — internal sale type never becomes sellable (Defect 2 regression)", () => {
  beforeEach(() => {
    rpcMock.mockClear();
  });

  it("blocks direct creation of an internal_bom product instead of defaulting to bulk_loose_product", async () => {
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

  it("blocks internal_bom even when heuristic category defaults already set product_class (Bugbot regression)", async () => {
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

  it("still allows a b2b_horeca product to default to bulk_loose_product (unchanged behavior)", async () => {
    const result = await saveFastCreateProduct({
      suggestions: minimalSuggestions,
      heroUrl: null,
      roles: ["owner"],
      categoryKey: "other",
      saleType: "b2b_horeca",
    });
    expect("id" in result).toBe(true);
  });

  it("still allows direct creation with no saleType supplied at all (backward compatibility)", async () => {
    const result = await saveFastCreateProduct({
      suggestions: minimalSuggestions,
      heroUrl: null,
      roles: ["owner"],
      categoryKey: "other",
    });
    expect("id" in result).toBe(true);
  });

  it("claims intake barcode through Core authority before direct product insert", async () => {
    const result = await saveFastCreateProduct({
      suggestions: minimalSuggestions,
      heroUrl: null,
      roles: ["owner"],
      categoryKey: "other",
      extraFormPatch: { intake_barcode: "5901234123457" },
    });
    expect("id" in result).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith(
      "catalogue_claim_intake_barcode",
      expect.objectContaining({ p_barcode: "5901234123457" }),
    );
  });
});
