import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertNoBlockingProductCollisions,
  duplicateCollisionSeverity,
  formatBlockingCollisionMessage,
  isBlockingDuplicateKind,
  lookupBlockingProductCollisions,
  normalizeNamePackKey,
  normalizeProductBarcode,
  normalizeProductName,
  normalizeProductSku,
  productCollisionLabel,
} from "./productDuplicateContract";

const fromMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

vi.mock("@/features/fastCreate/intake/barcodeLookup", () => ({
  lookupBarcodeInCatalog: vi.fn(async (barcode: string) => {
    if (barcode === "8901234567890") {
      return {
        outcome: "found",
        hit: {
          productId: "prod-barcode",
          productName: "Barcode Product",
          sku: "OAS-BAR-001",
          barcode,
        },
      };
    }
    return { outcome: "not_found" };
  }),
}));

describe("productDuplicateContract normalization", () => {
  it("normalizes SKU with trim and lowercase", () => {
    expect(normalizeProductSku("  OAS-001  ")).toBe("oas-001");
    expect(normalizeProductSku("")).toBeNull();
  });

  it("normalizes barcode with trim only", () => {
    expect(normalizeProductBarcode(" 5901234123457 ")).toBe("5901234123457");
  });

  it("normalizes product name and name+pack keys", () => {
    expect(normalizeProductName("  Baklawa  ")).toBe("baklawa");
    expect(normalizeNamePackKey("Baklawa", "500 g")).toBe("baklawa|500 g");
    expect(normalizeNamePackKey("Baklawa", null)).toBe("baklawa|");
  });
});

describe("productDuplicateContract severity", () => {
  it("treats exact SKU and barcode as blocking", () => {
    expect(isBlockingDuplicateKind("same_sku")).toBe(true);
    expect(isBlockingDuplicateKind("same_barcode")).toBe(true);
    expect(duplicateCollisionSeverity("same_sku")).toBe("blocking");
    expect(duplicateCollisionSeverity("same_barcode")).toBe("blocking");
  });

  it("treats name and fuzzy signals as review-only", () => {
    expect(isBlockingDuplicateKind("same_name")).toBe(false);
    expect(isBlockingDuplicateKind("similar_name")).toBe(false);
    expect(duplicateCollisionSeverity("same_name")).toBe("review");
    expect(duplicateCollisionSeverity("similar_name")).toBe("review");
  });
});

describe("lookupBlockingProductCollisions", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("returns blocking SKU collision from catalog", async () => {
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          limit: () =>
            Promise.resolve({
              data: [{ id: "prod-1", sku: "OAS-001", product_name: "Alpha" }],
              error: null,
            }),
        }),
      }),
    });

    const hits = await lookupBlockingProductCollisions({ sku: "oas-001" });
    expect(hits).toHaveLength(1);
    expect(hits[0].kind).toBe("same_sku");
    expect(hits[0].severity).toBe("blocking");
    expect(hits[0].existingProductId).toBe("prod-1");
  });

  it("excludes the current product on update", async () => {
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          limit: () =>
            Promise.resolve({
              data: [{ id: "prod-1", sku: "OAS-001", product_name: "Alpha" }],
              error: null,
            }),
        }),
      }),
    });

    const hits = await lookupBlockingProductCollisions({
      sku: "OAS-001",
      excludeProductId: "prod-1",
    });
    expect(hits).toHaveLength(0);
  });

  it("returns blocking barcode collision from labels lookup", async () => {
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          limit: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    });

    const hits = await lookupBlockingProductCollisions({ barcode: "8901234567890" });
    expect(hits).toHaveLength(1);
    expect(hits[0].kind).toBe("same_barcode");
    expect(hits[0].existingLabel).toContain("Barcode Product");
  });
});

describe("assertNoBlockingProductCollisions", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("throws fail-closed on exact SKU collision", async () => {
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          limit: () =>
            Promise.resolve({
              data: [{ id: "prod-1", sku: "OAS-001", product_name: "Alpha" }],
              error: null,
            }),
        }),
      }),
    });

    await expect(assertNoBlockingProductCollisions({ sku: "OAS-001" })).rejects.toThrow(
      /SKU already exists/i,
    );
  });

  it("passes when no blocking collisions exist", async () => {
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          limit: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    });

    await expect(
      assertNoBlockingProductCollisions({ sku: "OAS-NEW-001" }),
    ).resolves.toBeUndefined();
  });
});

describe("formatBlockingCollisionMessage", () => {
  it("formats SKU collision label", () => {
    const message = formatBlockingCollisionMessage([
      {
        kind: "same_sku",
        severity: "blocking",
        matchedValue: "OAS-001",
        existingProductId: "prod-1",
        existingLabel: productCollisionLabel({
          id: "prod-1",
          sku: "OAS-001",
          product_name: "Alpha",
        }),
      },
    ]);
    expect(message).toContain("SKU already exists");
    expect(message).toContain("Alpha (OAS-001)");
  });
});
