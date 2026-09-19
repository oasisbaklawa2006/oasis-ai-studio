import { beforeEach, describe, expect, it, vi } from "vitest";

const fromMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

import {
  changeProductVariantBasis,
  createProductVariantRelationship,
  loadProductVariantRelationship,
  removeProductVariantRelationship,
  updateProductVariantKey,
} from "./productVariantRelationshipStore";

const ROW = {
  id: "pv-1",
  product_id: "prod-variant",
  basis_product_id: "prod-basis",
  variant_key: "size_500g",
  basis_sku: "OAS-BASE-001",
  sku: "OAS-VAR-001",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

/** A minimal thenable query-builder stand-in — every chain method returns itself, and awaiting it resolves `result`. */
function chain(result: { data: unknown; error: unknown }) {
  const c: Record<string, unknown> = {
    select: () => c,
    eq: () => c,
    neq: () => c,
    or: () => c,
    order: () => c,
    limit: () => c,
    update: () => c,
    insert: () => c,
    delete: () => c,
    maybeSingle: async () => result,
    single: async () => result,
    // biome-ignore lint/suspicious/noThenProperty: intentionally thenable — stands in for supabase-js's PostgrestFilterBuilder, which `await builder` (no terminal method) relies on.
    then: (resolve: (v: unknown) => unknown) => resolve(result),
  };
  return c;
}

beforeEach(() => {
  fromMock.mockReset();
});

describe("createProductVariantRelationship", () => {
  it("rejects self-parenting without touching the database", async () => {
    const result = await createProductVariantRelationship({
      productId: "prod-1",
      productSku: "SKU-1",
      basisProductId: "prod-1",
      basisSku: "SKU-1",
      variantKey: "x",
    });
    expect(result).toEqual({
      ok: false,
      code: "validation",
      message: "A product cannot be its own basis product.",
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("rejects a missing/blank variant key without touching the database", async () => {
    const result = await createProductVariantRelationship({
      productId: "prod-variant",
      productSku: "SKU-1",
      basisProductId: "prod-basis",
      basisSku: "SKU-2",
      variantKey: "   ",
    });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.code).toBe("validation");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("creates the relationship: sets products.basis_product_id then inserts product_variants", async () => {
    fromMock
      .mockImplementationOnce(() => chain({ data: null, error: null })) // products update
      .mockImplementationOnce(() => chain({ data: ROW, error: null })); // product_variants insert

    const result = await createProductVariantRelationship({
      productId: "prod-variant",
      productSku: "OAS-VAR-001",
      basisProductId: "prod-basis",
      basisSku: "OAS-BASE-001",
      variantKey: "size_500g",
    });

    expect(result).toEqual({ ok: true, data: ROW });
    expect(fromMock).toHaveBeenNthCalledWith(1, "products");
    expect(fromMock).toHaveBeenNthCalledWith(2, "product_variants");
  });

  it("fails closed on RLS denial when setting products.basis_product_id", async () => {
    fromMock.mockImplementationOnce(() =>
      chain({
        data: null,
        error: { message: "new row violates row-level security policy", code: "42501" },
      }),
    );

    const result = await createProductVariantRelationship({
      productId: "prod-variant",
      productSku: "OAS-VAR-001",
      basisProductId: "prod-basis",
      basisSku: "OAS-BASE-001",
      variantKey: "size_500g",
    });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.code).toBe("rls_denied");
  });

  it("reports a deleted/missing basis product and compensates the products write", async () => {
    fromMock
      .mockImplementationOnce(() => chain({ data: null, error: null })) // products update succeeds
      .mockImplementationOnce(() =>
        chain({
          data: null,
          error: {
            message: "insert or update on table violates foreign key constraint",
            code: "23503",
          },
        }),
      ) // insert fails: basis product gone
      .mockImplementationOnce(() => chain({ data: null, error: null })); // compensating clear

    const result = await createProductVariantRelationship({
      productId: "prod-variant",
      productSku: "OAS-VAR-001",
      basisProductId: "prod-basis",
      basisSku: "OAS-BASE-001",
      variantKey: "size_500g",
    });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.code).toBe("not_found");
    expect(fromMock).toHaveBeenCalledTimes(3);
    expect(fromMock).toHaveBeenNthCalledWith(3, "products");
  });

  it("treats a duplicate-submit / accepted-but-response-lost retry that matches the intended row as success", async () => {
    fromMock
      .mockImplementationOnce(() => chain({ data: null, error: null })) // products update
      .mockImplementationOnce(() =>
        chain({
          data: null,
          error: { message: "duplicate key value violates unique constraint", code: "23505" },
        }),
      ) // insert races a prior successful insert
      .mockImplementationOnce(() => chain({ data: ROW, error: null })) // existing-row lookup: matches intent
      .mockImplementationOnce(() => chain({ data: null, error: null })); // restore products.basis_product_id

    const result = await createProductVariantRelationship({
      productId: ROW.product_id,
      productSku: ROW.sku,
      basisProductId: ROW.basis_product_id,
      basisSku: ROW.basis_sku,
      variantKey: ROW.variant_key,
    });

    expect(result).toEqual({ ok: true, data: ROW });
  });

  it("surfaces Core's basis-product immutability rule clearly instead of the raw trigger message", async () => {
    fromMock.mockImplementationOnce(() =>
      chain({
        data: null,
        error: { message: "POINT32_PRODUCT_IDENTITY_LOCKED", code: "23514" },
      }),
    );

    const result = await createProductVariantRelationship({
      productId: "prod-variant",
      productSku: "OAS-VAR-001",
      basisProductId: "prod-basis",
      basisSku: "OAS-BASE-001",
      variantKey: "size_500g",
    });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.code).toBe("identity_locked");
    expect(result.ok === false && result.message).not.toContain("POINT32_PRODUCT_IDENTITY_LOCKED");
  });

  it("reports a real conflict when the duplicate-key row does not match what was intended", async () => {
    fromMock
      .mockImplementationOnce(() => chain({ data: null, error: null })) // products update
      .mockImplementationOnce(() =>
        chain({
          data: null,
          error: { message: "duplicate key value violates unique constraint", code: "23505" },
        }),
      ) // insert conflicts with someone else's row
      .mockImplementationOnce(() => chain({ data: null, error: null })) // existing-row lookup: no row for us
      .mockImplementationOnce(() => chain({ data: null, error: null })); // compensating clear

    const result = await createProductVariantRelationship({
      productId: "prod-variant",
      productSku: "OAS-VAR-001",
      basisProductId: "prod-basis",
      basisSku: "OAS-BASE-001",
      variantKey: "size_500g",
    });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.code).toBe("conflict");
  });
});

describe("updateProductVariantKey", () => {
  it("updates the key when the expected updated_at still matches (no concurrent write)", async () => {
    const updated = { ...ROW, variant_key: "size_1kg", updated_at: "2026-01-02T00:00:00Z" };
    fromMock.mockImplementationOnce(() => chain({ data: updated, error: null }));

    const result = await updateProductVariantKey({
      productId: ROW.product_id,
      variantKey: "size_1kg",
      expectedUpdatedAt: ROW.updated_at,
    });

    expect(result).toEqual({ ok: true, data: updated });
  });

  it("fails closed with stale_state on a concurrent update (row moved since it was loaded)", async () => {
    fromMock
      .mockImplementationOnce(() => chain({ data: null, error: null })) // update matches zero rows
      .mockImplementationOnce(() =>
        chain({ data: { ...ROW, updated_at: "2026-02-01T00:00:00Z" }, error: null }),
      ); // re-check: updated_at moved

    const result = await updateProductVariantKey({
      productId: ROW.product_id,
      variantKey: "size_1kg",
      expectedUpdatedAt: ROW.updated_at,
    });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.code).toBe("stale_state");
  });

  it("fails closed with rls_denied when zero rows match and the row is otherwise unchanged", async () => {
    fromMock
      .mockImplementationOnce(() => chain({ data: null, error: null })) // update matches zero rows (RLS)
      .mockImplementationOnce(() => chain({ data: ROW, error: null })); // re-check: same updated_at

    const result = await updateProductVariantKey({
      productId: ROW.product_id,
      variantKey: "size_1kg",
      expectedUpdatedAt: ROW.updated_at,
    });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.code).toBe("rls_denied");
  });
});

describe("removeProductVariantRelationship", () => {
  it("deletes the row then clears products.basis_product_id", async () => {
    fromMock
      .mockImplementationOnce(() => chain({ data: null, error: null }))
      .mockImplementationOnce(() => chain({ data: null, error: null }));

    const result = await removeProductVariantRelationship("prod-variant");

    expect(result).toEqual({ ok: true, data: null });
    expect(fromMock).toHaveBeenNthCalledWith(1, "product_variants");
    expect(fromMock).toHaveBeenNthCalledWith(2, "products");
  });

  it("fails closed on RLS denial for the delete", async () => {
    fromMock.mockImplementationOnce(() =>
      chain({
        data: null,
        error: { message: "row-level security policy violated", code: "42501" },
      }),
    );

    const result = await removeProductVariantRelationship("prod-variant");

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.code).toBe("rls_denied");
    expect(fromMock).toHaveBeenCalledTimes(1);
  });
});

describe("changeProductVariantBasis (re-parent)", () => {
  it("removes the old relationship and creates the new one", async () => {
    fromMock
      .mockImplementationOnce(() => chain({ data: null, error: null })) // delete old product_variants row
      .mockImplementationOnce(() => chain({ data: null, error: null })) // clear old basis_product_id
      .mockImplementationOnce(() => chain({ data: null, error: null })) // set new basis_product_id
      .mockImplementationOnce(() => chain({ data: ROW, error: null })); // insert new product_variants row

    const result = await changeProductVariantBasis({
      productId: ROW.product_id,
      productSku: ROW.sku,
      newBasisProductId: ROW.basis_product_id,
      basisSku: ROW.basis_sku,
      variantKey: ROW.variant_key,
    });

    expect(result).toEqual({ ok: true, data: ROW });
  });

  it("reports explicitly when removal succeeds but the new relationship cannot be created", async () => {
    fromMock
      .mockImplementationOnce(() => chain({ data: null, error: null })) // delete old row
      .mockImplementationOnce(() => chain({ data: null, error: null })) // clear old basis_product_id
      .mockImplementationOnce(() =>
        chain({
          data: null,
          error: { message: "row-level security policy violated", code: "42501" },
        }),
      ); // new basis_product_id write denied

    const result = await changeProductVariantBasis({
      productId: "prod-variant",
      productSku: "OAS-VAR-001",
      newBasisProductId: "prod-other-basis",
      basisSku: "OAS-BASE-002",
      variantKey: "size_1kg",
    });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toContain(
      "Previous basis relationship was removed",
    );
  });
});

describe("network loss", () => {
  it("fails closed when the client throws instead of resolving", async () => {
    fromMock.mockImplementationOnce(() => {
      throw new Error("network loss");
    });

    const result = await loadProductVariantRelationship("prod-variant");

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.code).toBe("network");
  });
});
