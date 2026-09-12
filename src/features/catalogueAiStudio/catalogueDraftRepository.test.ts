import { beforeEach, describe, expect, it, vi } from "vitest";

type DraftRow = {
  id: string;
  product_id: string;
  version_number: number;
  status: string;
  rejection_reason: string | null;
  catalogue_title: string;
};

const draftStore = vi.hoisted(() => new Map<string, DraftRow>());
const auditLog = vi.hoisted(() => [] as Array<Record<string, unknown>>);
let nextId = 1;

function makeDraft(overrides: Partial<DraftRow> & Pick<DraftRow, "id" | "product_id">): DraftRow {
  return {
    version_number: 1,
    status: "DRAFT",
    rejection_reason: null,
    catalogue_title: "Title",
    ...overrides,
  };
}

function latestForProduct(productId: string): DraftRow | null {
  const rows = [...draftStore.values()]
    .filter((r) => r.product_id === productId)
    .sort((a, b) => b.version_number - a.version_number);
  return rows[0] ?? null;
}

function chainForTable(table: string) {
  const state: Record<string, unknown> = {
    table,
    filters: [] as Array<[string, unknown]>,
    pendingUpdate: null as Record<string, unknown> | null,
    pendingInsert: null as Record<string, unknown> | null,
  };
  const chain: Record<string, unknown> = {};
  const resolve = async () => {
    if (table === "catalogue_ai_studio_drafts") {
      const idFilter = state.filters.find(([k]) => k === "id");
      const productFilter = state.filters.find(([k]) => k === "product_id");
      const statusFilters = state.filters.filter(([k]) => k === "status");

      if (state.pendingUpdate) {
        const id = idFilter ? String(idFilter[1]) : null;
        const row = id ? draftStore.get(id) : null;
        if (!row) return { data: null, error: null };
        if (statusFilters.length && !statusFilters.every(([, val]) => row.status === val)) {
          return { data: null, error: null };
        }
        Object.assign(row, state.pendingUpdate);
        draftStore.set(row.id, row);
        return { data: row, error: null };
      }

      if (state.pendingInsert) {
        const payload = state.pendingInsert;
        const row: DraftRow = {
          id: `draft-${nextId++}`,
          product_id: String(payload.product_id),
          version_number: Number(payload.version_number),
          status: String(payload.status),
          rejection_reason: null,
          catalogue_title: String(payload.catalogue_title ?? "Title"),
        };
        draftStore.set(row.id, row);
        return { data: row, error: null };
      }

      if (state.op === "select") {
        if (productFilter && !idFilter) {
          const row = latestForProduct(String(productFilter[1]));
          return { data: state.single ? row : row ? [row] : [], error: null };
        }
        if (idFilter) {
          const row = draftStore.get(String(idFilter[1])) ?? null;
          if (row && statusFilters.every(([, val]) => row.status === val)) {
            return { data: state.single ? row : [row], error: null };
          }
          if (!statusFilters.length) {
            return { data: state.single ? row : row ? [row] : [], error: null };
          }
          return { data: state.single ? null : [], error: null };
        }
        return { data: state.single ? null : [], error: null };
      }
    }

    if (table === "catalogue_ai_studio_draft_audit_log") {
      if (state.pendingInsert || (state.op === "insert" && state.payload)) {
        auditLog.push((state.pendingInsert ?? state.payload) as Record<string, unknown>);
        return { data: null, error: null };
      }
    }

    return { data: null, error: null };
  };

  chain.select = () => {
    state.op = "select";
    return chain;
  };
  chain.eq = (col: string, val: unknown) => {
    state.filters.push([col, val]);
    return chain;
  };
  chain.order = () => chain;
  chain.limit = () => chain;
  chain.maybeSingle = () => {
    state.single = true;
    return resolve();
  };
  chain.single = () => {
    state.single = true;
    return resolve();
  };
  chain.update = (payload: Record<string, unknown>) => {
    state.pendingUpdate = payload;
    return chain;
  };
  chain.insert = (payload: Record<string, unknown>) => {
    state.op = "insert";
    state.payload = payload;
    state.pendingInsert = payload;
    const thenable = {
      ...chain,
      then: (resolve: (v: unknown) => void) => resolve(resolveFn()),
    };
    return thenable;
  };

  const resolveFn = () => resolve();

  // Make the chain awaitable for bare `.insert()` calls (audit log).
  (chain as { then?: (resolve: (v: unknown) => void) => void }).then = (resolve) =>
    resolve(resolveFn());
  return chain;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => chainForTable(table),
  },
}));

const { rejectDraft, saveDraft } = await import("./catalogueDraftRepository");

describe("catalogueDraftRepository Point39 correction contract", () => {
  beforeEach(() => {
    draftStore.clear();
    auditLog.length = 0;
    nextId = 1;
  });

  it("rejects without a reason at the repository layer", async () => {
    draftStore.set("d1", makeDraft({ id: "d1", product_id: "p1", status: "UNDER_REVIEW" }));
    await expect(rejectDraft("d1", "reviewer-1", "")).rejects.toThrow(/reason is required/i);
    await expect(rejectDraft("d1", "reviewer-1", "   ")).rejects.toThrow(/reason is required/i);
  });

  it("persists rejection reason on reject and audit metadata", async () => {
    draftStore.set("d1", makeDraft({ id: "d1", product_id: "p1", status: "UNDER_REVIEW" }));
    const row = await rejectDraft("d1", "reviewer-1", "  Missing B2B price  ");
    expect(row.status).toBe("REJECTED");
    expect(row.rejection_reason).toBe("Missing B2B price");
    const rejectAudit = auditLog.find((e) => e.action === "REJECT");
    expect(rejectAudit?.metadata).toEqual({ rejection_reason: "Missing B2B price" });
  });

  it("creates a new version (not in-place update) when correcting a rejected draft", async () => {
    draftStore.set(
      "d1",
      makeDraft({
        id: "d1",
        product_id: "p1",
        version_number: 1,
        status: "REJECTED",
        rejection_reason: "Tone mismatch",
      }),
    );
    const row = await saveDraft({
      productId: "p1",
      content: { catalogue_title: "Corrected title" } as never,
      actorId: "contributor-1",
    });
    expect(row.version_number).toBe(2);
    expect(row.status).toBe("DRAFT");
    expect(draftStore.get("d1")?.status).toBe("REJECTED");
    const versionAudit = auditLog.find((e) => e.action === "CREATE_NEW_VERSION");
    expect(versionAudit?.metadata).toMatchObject({
      predecessor_draft_id: "d1",
      predecessor_version_number: 1,
      predecessor_status: "REJECTED",
      correction_kind: "post_rejection",
      previous_version_rejection_reason: "Tone mismatch",
    });
  });

  it("blocks save while UNDER_REVIEW (no correction during active review)", async () => {
    draftStore.set(
      "d1",
      makeDraft({ id: "d1", product_id: "p1", status: "UNDER_REVIEW" }),
    );
    await expect(
      saveDraft({
        productId: "p1",
        content: { catalogue_title: "Nope" } as never,
        actorId: "contributor-1",
      }),
    ).rejects.toThrow(/submitted for review/i);
  });
});
