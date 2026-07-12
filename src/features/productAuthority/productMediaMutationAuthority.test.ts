import { beforeEach, describe, expect, it, vi } from "vitest";

const selectMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => selectMock(),
        }),
      }),
    }),
  },
}));

const repairMock = vi.fn(async (_productId: string, rows: unknown[]) => rows);
const syncMock = vi.fn(
  async (_productId: string, rows: { file_url?: string | null }[], _opts?: unknown) => ({
    media_status: "approved" as const,
    hero_image_url: rows[0]?.file_url ?? null,
  }),
);

vi.mock("@/features/mediaReadiness/mediaAuthorityContract", () => ({
  repairDirectMasterMediaRows: (productId: string, rows: unknown[]) => repairMock(productId, rows),
  syncProductMediaAuthority: (productId: string, rows: { file_url?: string | null }[], opts?: unknown) =>
    syncMock(productId, rows, opts),
}));

const {
  beginProductMediaOperation,
  fetchProductMediaRows,
  getCachedProductMediaAuthority,
  reconcileProductMediaAuthority,
  subscribeToProductMediaAuthority,
} = await import("./productMediaMutationAuthority");

function rowsResult(rows: { file_url?: string | null }[]) {
  return { data: rows, error: null };
}

beforeEach(() => {
  selectMock.mockReset();
  repairMock.mockClear();
  syncMock.mockClear();
});

describe("beginProductMediaOperation (per-product monotonic sequencing)", () => {
  it("returns strictly increasing ids for the same product", () => {
    const a = beginProductMediaOperation("prod-seq-1");
    const b = beginProductMediaOperation("prod-seq-1");
    const c = beginProductMediaOperation("prod-seq-1");
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });

  it("tracks each product's sequence independently — one product's count never affects another's", () => {
    beginProductMediaOperation("prod-seq-a");
    beginProductMediaOperation("prod-seq-a");
    const firstForB = beginProductMediaOperation("prod-seq-b");
    expect(firstForB).toBe(1);
  });
});

describe("reconcileProductMediaAuthority (the one completion pipeline)", () => {
  it("reads rows, syncs authority, caches, and publishes the result to every subscriber", async () => {
    selectMock.mockResolvedValueOnce(rowsResult([{ file_url: "https://cdn/hero.jpg" }]));
    const productId = "prod-reconcile-1";
    const opId = beginProductMediaOperation(productId);

    const received: unknown[] = [];
    const unsubscribe = subscribeToProductMediaAuthority((r) => received.push(r));

    const result = await reconcileProductMediaAuthority(productId, opId);

    expect(result).not.toBeNull();
    expect(result?.productId).toBe(productId);
    expect(result?.operationId).toBe(opId);
    expect(result?.heroUrl).toBe("https://cdn/hero.jpg");
    expect(result?.mediaStatus).toBe("approved");
    expect(received).toEqual([result]);
    expect(getCachedProductMediaAuthority(productId)).toEqual(result);
    unsubscribe();
  });

  it("delivers a published result to multiple subscribers, and stops delivering after unsubscribe", async () => {
    selectMock.mockResolvedValueOnce(rowsResult([]));
    const productId = "prod-reconcile-multi";
    const opId = beginProductMediaOperation(productId);

    const a: unknown[] = [];
    const b: unknown[] = [];
    const unsubA = subscribeToProductMediaAuthority((r) => a.push(r));
    const unsubB = subscribeToProductMediaAuthority((r) => b.push(r));
    unsubA();

    await reconcileProductMediaAuthority(productId, opId);

    expect(a).toEqual([]);
    expect(b.length).toBe(1);
    unsubB();
  });

  it("only calls repairDirectMasterMediaRows when repair is explicitly requested", async () => {
    selectMock.mockResolvedValue(rowsResult([]));
    const productId = "prod-reconcile-repair";

    const op1 = beginProductMediaOperation(productId);
    await reconcileProductMediaAuthority(productId, op1);
    expect(repairMock).not.toHaveBeenCalled();

    const op2 = beginProductMediaOperation(productId);
    await reconcileProductMediaAuthority(productId, op2, { repair: true });
    expect(repairMock).toHaveBeenCalledWith(productId, []);
  });

  it("passes fallbackHeroUrl through to syncProductMediaAuthority", async () => {
    selectMock.mockResolvedValueOnce(rowsResult([]));
    const productId = "prod-reconcile-fallback";
    const opId = beginProductMediaOperation(productId);

    await reconcileProductMediaAuthority(productId, opId, { fallbackHeroUrl: "https://legacy/hero.jpg" });

    expect(syncMock).toHaveBeenCalledWith(productId, [], { fallbackHeroUrl: "https://legacy/hero.jpg" });
  });

  it("out-of-order completions never overwrite a newer result for the same product (regression matrix #12)", async () => {
    const productId = "prod-out-of-order";
    // Operation 1 starts first...
    const op1 = beginProductMediaOperation(productId);
    // ...then operation 2 starts before operation 1's own read resolves (e.g. a second, faster
    // mutation fired while the first was still in flight).
    const op2 = beginProductMediaOperation(productId);

    // Operation 2 (newer) finishes first and reconciles successfully.
    selectMock.mockResolvedValueOnce(rowsResult([{ file_url: "https://cdn/newer.jpg" }]));
    const result2 = await reconcileProductMediaAuthority(productId, op2);
    expect(result2?.heroUrl).toBe("https://cdn/newer.jpg");
    expect(getCachedProductMediaAuthority(productId)?.heroUrl).toBe("https://cdn/newer.jpg");

    // Operation 1 (older) finally resolves its read afterwards — it must be discarded entirely,
    // not cached, not published, even though its own read succeeded.
    selectMock.mockResolvedValueOnce(rowsResult([{ file_url: "https://cdn/older.jpg" }]));
    const received: unknown[] = [];
    const unsubscribe = subscribeToProductMediaAuthority((r) => received.push(r));
    const result1 = await reconcileProductMediaAuthority(productId, op1);
    unsubscribe();

    expect(result1).toBeNull();
    expect(received).toEqual([]);
    expect(getCachedProductMediaAuthority(productId)?.heroUrl).toBe("https://cdn/newer.jpg");
  });

  it("never reconciles a different product's rows into the requested product's authority", async () => {
    selectMock.mockResolvedValueOnce(rowsResult([{ file_url: "https://cdn/a.jpg" }]));
    const opA = beginProductMediaOperation("prod-isolation-a");
    await reconcileProductMediaAuthority("prod-isolation-a", opA);

    selectMock.mockResolvedValueOnce(rowsResult([{ file_url: "https://cdn/b.jpg" }]));
    const opB = beginProductMediaOperation("prod-isolation-b");
    await reconcileProductMediaAuthority("prod-isolation-b", opB);

    expect(getCachedProductMediaAuthority("prod-isolation-a")?.heroUrl).toBe("https://cdn/a.jpg");
    expect(getCachedProductMediaAuthority("prod-isolation-b")?.heroUrl).toBe("https://cdn/b.jpg");
  });
});

describe("fetchProductMediaRows (passive read)", () => {
  it("returns rows on success", async () => {
    selectMock.mockResolvedValueOnce(rowsResult([{ file_url: "https://cdn/x.jpg" }]));
    const rows = await fetchProductMediaRows("prod-fetch-1");
    expect(rows).toEqual([{ file_url: "https://cdn/x.jpg" }]);
  });

  it("throws on a query error rather than silently returning an empty/optimistic result", async () => {
    selectMock.mockResolvedValueOnce({ data: null, error: { message: "network down" } });
    await expect(fetchProductMediaRows("prod-fetch-error")).rejects.toThrow("network down");
  });
});
