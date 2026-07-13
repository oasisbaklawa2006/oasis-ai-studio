import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FastCreateSuggestions } from "./fastCreateSuggestions";

const rpcMock = vi.fn(async (fn: string, args: Record<string, unknown>) => {
  if (fn === "save_product_aggregate_v1") {
    const product = args._product as Record<string, unknown>;
    return {
      data: {
        schema_version: "oasis.product-aggregate-save.v1",
        status: "saved",
        operation: "create",
        product_id: "prod-1",
        product: { ...product, id: "prod-1", is_active: false, is_catalogue_ready: false },
        pricing_rules_written: 0,
        moq_rules_written: 0,
        updated_at: "2026-07-14T03:00:00.000Z",
        aggregate_revision: 0,
      },
      error: null,
    };
  }
  return {
    data: `OAS-${args._division_code}-${args._category_code}-${args._subcategory_code}-${args._packaging_code}-0001`,
    error: null,
  };
});

vi.mock("@/integrations/supabase/client", () => {
  const insertChain: Record<string, unknown> = {};
  insertChain.select = () => insertChain;
  insertChain.single = () => Promise.resolve({ data: { id: "prod-1", sku: "OAS-AS-BKL-ASS-LOOSE-0001" }, error: null });
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

vi.mock("@/lib/aliasSchemaAdapter", () => ({
  insertProductAliases: async () => ({ error: null }),
}));

const { requireFastCreateSku, saveFastCreateProduct, FAST_CREATE_UNSUPPORTED_CLASS_MESSAGE_PREFIX } = await import(
  "./saveFastCreateProduct"
);
const minimalSuggestions: FastCreateSuggestions = {
  formPatch: {
    product_name: "Test Product",
    category: "Baklawa",
    production_department: "arabic_sweets",
  },
  aliases: [],
  whatsappKeywords: [],
  searchKeywords: [],
  labelStarter: { product_name: "Test Product", ingredients_hint: "", allergen_hint: "", net_weight_hint: "" },
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
    // Existing SKU was generated for RBOX, but the operator has since changed the packaging
    // dropdown to PAPERBOX — the stale SKU must be regenerated, not reused with RBOX codes.
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

    const regenerated = await requireFastCreateSku("ready_packs", "OAS-AS-BKL-ASS-RBOX-0001", "TIN");
    expect(skuPackagingOf(regenerated.sku)).toBe(regenerated.codes.packaging_code);
  });
});

function skuPackagingOf(sku: string): string {
  return sku.split("-")[4];
}

describe("saveFastCreateProduct — internal sale type never becomes sellable (Defect 2 regression)", () => {
  beforeEach(() => {
    rpcMock.mockClear();
  });

  it("blocks direct creation of an internal_bom product instead of defaulting to bulk_loose_product", async () => {
    await expect(
      saveFastCreateProduct({
        suggestions: minimalSuggestions,
        heroUrl: null,
        roles: ["owner"], // direct-write role
        categoryKey: "other",
        saleType: "internal_bom",
      }),
    ).rejects.toThrow(FAST_CREATE_UNSUPPORTED_CLASS_MESSAGE_PREFIX);
    // Guard must fire before any SKU RPC call — no product should be generated at all.
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("blocks internal_bom even when heuristic category defaults already set product_class (Bugbot regression)", async () => {
    // buildHeuristicSuggestions' applyCategoryDefaults always sets a product_class,
    // independent of the chosen sale type — the guard must not rely on product_class
    // being empty, or this exact case (the real Fast Create flow) bypasses it entirely.
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
});
