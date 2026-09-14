import { describe, expect, it } from "vitest";
import type {
  CatalogueDraftAuditRow,
  CatalogueDraftRow,
} from "@/features/catalogueAiStudio/catalogueDraftTypes";
import {
  assertValidProductVersionHistory,
  auditEventReason,
  buildProductVersionHistory,
  isStaleCatalogueDraftVersion,
  parsePredecessorLinkage,
  stripSecretAuditMetadata,
  summarizeAuditAction,
  versionHistoryPhaseLabel,
} from "./productVersionHistory";

function draft(overrides: Partial<CatalogueDraftRow> & Pick<CatalogueDraftRow, "id">): CatalogueDraftRow {
  return {
    product_id: "product-1",
    version_number: 1,
    status: "DRAFT",
    created_at: "2026-01-01T10:00:00.000Z",
    updated_at: "2026-01-01T10:00:00.000Z",
    created_by: "actor-a",
    reviewed_at: null,
    reviewed_by: null,
    rejection_reason: null,
    catalogue_title: "Title",
    short_description: "",
    long_description: "",
    b2b_sales_copy: "",
    export_catalogue_copy: "",
    whatsapp_product_message: "",
    hindi_description: "",
    storage_shelf_life_copy: "",
    hero_image_prompt: "",
    square_image_prompt: "",
    closeup_image_prompt: "",
    packaging_image_prompt: "",
    lifestyle_image_prompt: "",
    export_bundle_preview: "",
    source_snapshot: {},
    published_at: null,
    published_by: null,
    ...overrides,
  };
}

function audit(
  overrides: Partial<CatalogueDraftAuditRow> & Pick<CatalogueDraftAuditRow, "id" | "draft_id">,
): CatalogueDraftAuditRow {
  return {
    action: "SAVE_DRAFT",
    actor_id: "actor-a",
    created_at: "2026-01-01T10:05:00.000Z",
    from_status: "DRAFT",
    to_status: "DRAFT",
    metadata: {},
    ...overrides,
  };
}

describe("Point40 metadata safety", () => {
  it("strips secret keys from audit metadata", () => {
    expect(
      stripSecretAuditMetadata({
        rejection_reason: "Missing copy",
        source_snapshot: { ai_generation: { raw: "secret" } },
        raw_ai_payload: "hidden",
      }),
    ).toEqual({ rejection_reason: "Missing copy" });
  });

  it("parses predecessor linkage from CREATE_NEW_VERSION metadata", () => {
    const linkage = parsePredecessorLinkage({
      predecessor_draft_id: "d1",
      predecessor_version_number: 1,
      predecessor_status: "REJECTED",
      correction_kind: "post_rejection",
      previous_version_rejection_reason: "Tone mismatch",
    });
    expect(linkage).toEqual({
      predecessor_draft_id: "d1",
      predecessor_version_number: 1,
      predecessor_status: "REJECTED",
      correction_kind: "post_rejection",
      previous_version_rejection_reason: "Tone mismatch",
    });
  });

  it("extracts rejection and predecessor reasons without throwing on shape drift", () => {
    const row = audit({
      id: "a1",
      draft_id: "d1",
      action: "REJECT",
      metadata: { rejection_reason: "  Missing B2B  " },
    });
    const safe = stripSecretAuditMetadata(row.metadata);
    expect(auditEventReason(row, safe)).toBe("Missing B2B");
    expect(summarizeAuditAction(row)).toMatch(/Rejected/);
  });
});

describe("Point40 version chain read model", () => {
  it("builds a valid single-version history with actor metadata", () => {
    const d1 = draft({ id: "d1", version_number: 1, status: "DRAFT" });
    const model = buildProductVersionHistory({
      productId: "product-1",
      drafts: [d1],
      auditByDraftId: new Map([
        [
          "d1",
          [
            audit({
              id: "a1",
              draft_id: "d1",
              action: "CREATE_DRAFT",
              actor_id: "actor-a",
              created_at: "2026-01-01T10:00:00.000Z",
              from_status: null,
              to_status: "DRAFT",
            }),
          ],
        ],
      ]),
    });

    expect(model.schema).toBe("point40_v1");
    expect(model.chain_valid).toBe(true);
    expect(model.versions).toHaveLength(1);
    expect(model.versions[0].is_current).toBe(true);
    expect(model.versions[0].is_stale).toBe(false);
    expect(model.events[0].change_summary).toBe("Initial draft created");
    assertValidProductVersionHistory(model);
  });

  it("chains v2 to v1 via predecessor linkage and marks stale/current", () => {
    const d1 = draft({
      id: "d1",
      version_number: 1,
      status: "REJECTED",
      rejection_reason: "Missing export copy",
      reviewed_at: "2026-01-02T12:00:00.000Z",
      created_at: "2026-01-01T10:00:00.000Z",
    });
    const d2 = draft({
      id: "d2",
      version_number: 2,
      status: "DRAFT",
      created_at: "2026-01-03T09:00:00.000Z",
    });

    const model = buildProductVersionHistory({
      productId: "product-1",
      drafts: [d1, d2],
      auditByDraftId: new Map([
        ["d1", [audit({ id: "a1", draft_id: "d1", action: "CREATE_DRAFT", actor_id: "a" })]],
        [
          "d2",
          [
            audit({
              id: "a2",
              draft_id: "d2",
              action: "CREATE_NEW_VERSION",
              actor_id: "b",
              from_status: "REJECTED",
              to_status: "DRAFT",
              metadata: {
                predecessor_draft_id: "d1",
                predecessor_version_number: 1,
                predecessor_status: "REJECTED",
                correction_kind: "post_rejection",
                previous_version_rejection_reason: "Missing export copy",
              },
            }),
          ],
        ],
      ]),
    });

    expect(model.chain_valid).toBe(true);
    expect(model.head_version_number).toBe(2);
    expect(model.versions[0].is_stale).toBe(true);
    expect(model.versions[0].is_terminal).toBe(true);
    expect(model.versions[1].is_current).toBe(true);
    expect(model.versions[1].predecessor?.correction_kind).toBe("post_rejection");
    expect(model.events.find((e) => e.action === "CREATE_NEW_VERSION")?.reason).toBe(
      "Missing export copy",
    );
  });

  it("fail-closed on missing predecessor linkage for v2+", () => {
    const d1 = draft({ id: "d1", version_number: 1, status: "APPROVED" });
    const d2 = draft({ id: "d2", version_number: 2, status: "DRAFT" });
    const model = buildProductVersionHistory({
      productId: "product-1",
      drafts: [d1, d2],
      auditByDraftId: new Map([
        ["d1", [audit({ id: "a1", draft_id: "d1", action: "CREATE_DRAFT", actor_id: "a" })]],
        ["d2", [audit({ id: "a2", draft_id: "d2", action: "SAVE_DRAFT", actor_id: "b" })]],
      ]),
    });

    expect(model.chain_valid).toBe(false);
    expect(model.chain_errors.some((e) => /predecessor linkage/i.test(e))).toBe(true);
    expect(() => assertValidProductVersionHistory(model)).toThrow(/predecessor/i);
  });

  it("fail-closed on impossible chronology (successor before predecessor)", () => {
    const d1 = draft({
      id: "d1",
      version_number: 1,
      status: "REJECTED",
      created_at: "2026-01-05T10:00:00.000Z",
    });
    const d2 = draft({
      id: "d2",
      version_number: 2,
      status: "DRAFT",
      created_at: "2026-01-01T10:00:00.000Z",
    });
    const model = buildProductVersionHistory({
      productId: "product-1",
      drafts: [d1, d2],
      auditByDraftId: new Map([
        ["d1", [audit({ id: "a1", draft_id: "d1", action: "CREATE_DRAFT", actor_id: "a" })]],
        [
          "d2",
          [
            audit({
              id: "a2",
              draft_id: "d2",
              action: "CREATE_NEW_VERSION",
              actor_id: "b",
              metadata: {
                predecessor_draft_id: "d1",
                predecessor_version_number: 1,
                predecessor_status: "REJECTED",
                correction_kind: "post_rejection",
              },
            }),
          ],
        ],
      ]),
    });

    expect(model.chain_valid).toBe(false);
    expect(model.chain_errors.some((e) => /created_at precedes/i.test(e))).toBe(true);
  });

  it("fail-closed when governed audit events lack actor_id", () => {
    const d1 = draft({ id: "d1" });
    const model = buildProductVersionHistory({
      productId: "product-1",
      drafts: [d1],
      auditByDraftId: new Map([
        [
          "d1",
          [
            audit({
              id: "a1",
              draft_id: "d1",
              action: "APPROVE",
              actor_id: null,
              from_status: "UNDER_REVIEW",
              to_status: "APPROVED",
            }),
          ],
        ],
      ]),
    });

    expect(model.chain_valid).toBe(false);
    expect(model.chain_errors.some((e) => /missing actor_id/i.test(e))).toBe(true);
  });

  it("detects terminal in-place mutation in audit history", () => {
    const d1 = draft({ id: "d1", status: "APPROVED" });
    const model = buildProductVersionHistory({
      productId: "product-1",
      drafts: [d1],
      auditByDraftId: new Map([
        [
          "d1",
          [
            audit({
              id: "a1",
              draft_id: "d1",
              action: "SAVE_DRAFT",
              actor_id: "a",
              from_status: "APPROVED",
              to_status: "APPROVED",
            }),
          ],
        ],
      ]),
    });

    expect(model.chain_valid).toBe(false);
    expect(model.chain_errors.some((e) => /in-place terminal mutation/i.test(e))).toBe(true);
  });

  it("flags version gap in predecessor chain", () => {
    const d3 = draft({ id: "d3", version_number: 3, status: "DRAFT" });
    const model = buildProductVersionHistory({
      productId: "product-1",
      drafts: [d3],
      auditByDraftId: new Map([
        [
          "d3",
          [
            audit({
              id: "a1",
              draft_id: "d3",
              action: "CREATE_NEW_VERSION",
              actor_id: "a",
              metadata: {
                predecessor_draft_id: "missing",
                predecessor_version_number: 2,
                predecessor_status: "APPROVED",
                correction_kind: "post_approval",
              },
            }),
          ],
        ],
      ]),
    });

    expect(model.chain_valid).toBe(false);
    expect(model.chain_errors.some((e) => /Missing version_number 1/i.test(e))).toBe(true);
  });
});

describe("Point40 stale/current distinction", () => {
  it("marks older versions stale against head", () => {
    expect(isStaleCatalogueDraftVersion(1, 3)).toBe(true);
    expect(isStaleCatalogueDraftVersion(3, 3)).toBe(false);
  });

  it("labels workflow phases for history surfaces", () => {
    expect(versionHistoryPhaseLabel("APPROVED")).toBe("Approved (terminal)");
    expect(versionHistoryPhaseLabel("REJECTED")).toBe("Rejected (terminal)");
    expect(versionHistoryPhaseLabel(null)).toBe("Pre-draft");
  });
});
