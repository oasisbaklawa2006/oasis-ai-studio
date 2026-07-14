import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  LEGACY_APPROVAL_CONTRACT,
  LEGACY_APPROVAL_CONTRACT_BY_TYPE,
  getLegacyApprovalContract,
  isApprovalSoftBlocked,
  interpretApprovalRpcResult,
  type LegacyDraftType,
} from "./legacyApprovalContract";

const EXPECTED_APPROVE_RPC: Record<LegacyDraftType, string> = {
  product: "approve_catalogue_product_draft",
  media: "approve_catalogue_media_submission",
  alias: "approve_catalogue_alias_draft",
  bom: "approve_catalogue_bom_draft",
  moq: "approve_catalogue_moq_draft",
  pricing: "approve_catalogue_pricing_draft",
  tag: "approve_catalogue_tag_draft",
};

const EXPECTED_REJECT_RPC: Record<LegacyDraftType, string> = {
  product: "reject_catalogue_product_draft",
  media: "reject_catalogue_media_submission",
  alias: "reject_catalogue_alias_draft",
  bom: "reject_catalogue_bom_draft",
  moq: "reject_catalogue_moq_draft",
  pricing: "reject_catalogue_pricing_draft",
  tag: "reject_catalogue_tag_draft",
};

const EXPECTED_TABLE: Record<LegacyDraftType, string> = {
  product: "catalogue_product_drafts",
  media: "catalogue_media_submissions",
  alias: "catalogue_alias_drafts",
  bom: "catalogue_bom_drafts",
  moq: "catalogue_moq_drafts",
  pricing: "catalogue_pricing_drafts",
  tag: "catalogue_tag_drafts",
};

const SOFT_BLOCKED_TYPES: LegacyDraftType[] = ["bom", "moq", "pricing", "media"];
const MAPPED_TYPES: LegacyDraftType[] = ["product", "alias", "tag"];

describe("LEGACY_APPROVAL_CONTRACT", () => {
  it("contains exactly the 7 known draft types, no more, no fewer", () => {
    const types = LEGACY_APPROVAL_CONTRACT.map((e) => e.draftType).sort();
    expect(types).toEqual(["alias", "bom", "media", "moq", "pricing", "product", "tag"].sort());
  });

  it("has the exact live approve RPC name for all 7 draft types", () => {
    for (const draftType of Object.keys(EXPECTED_APPROVE_RPC) as LegacyDraftType[]) {
      expect(getLegacyApprovalContract(draftType).approveRpc).toBe(EXPECTED_APPROVE_RPC[draftType]);
    }
  });

  it("has the exact live reject RPC name for all 7 draft types", () => {
    for (const draftType of Object.keys(EXPECTED_REJECT_RPC) as LegacyDraftType[]) {
      expect(getLegacyApprovalContract(draftType).rejectRpc).toBe(EXPECTED_REJECT_RPC[draftType]);
    }
  });

  it("maps each draft type to its correct legacy draft table", () => {
    for (const draftType of Object.keys(EXPECTED_TABLE) as LegacyDraftType[]) {
      expect(getLegacyApprovalContract(draftType).table).toBe(EXPECTED_TABLE[draftType]);
    }
  });

  it("LEGACY_APPROVAL_CONTRACT_BY_TYPE is index-consistent with the array form", () => {
    for (const entry of LEGACY_APPROVAL_CONTRACT) {
      expect(LEGACY_APPROVAL_CONTRACT_BY_TYPE[entry.draftType]).toBe(entry);
    }
  });
});

describe("soft-blocked vs mapped approval types", () => {
  it.each(SOFT_BLOCKED_TYPES)("marks %s as soft_blocked with no master target", (draftType) => {
    const entry = getLegacyApprovalContract(draftType);
    expect(entry.approvalMappingStatus).toBe("soft_blocked");
    expect(entry.masterTarget).toBeNull();
    expect(isApprovalSoftBlocked(draftType)).toBe(true);
  });

  it.each(MAPPED_TYPES)("marks %s as mapped with a real master target", (draftType) => {
    const entry = getLegacyApprovalContract(draftType);
    expect(entry.approvalMappingStatus).toBe("mapped");
    expect(entry.masterTarget).not.toBeNull();
    expect(isApprovalSoftBlocked(draftType)).toBe(false);
  });

  it("product maps to public.products", () => {
    expect(getLegacyApprovalContract("product").masterTarget).toBe("products");
  });

  it("alias maps to public.product_aliases", () => {
    expect(getLegacyApprovalContract("alias").masterTarget).toBe("product_aliases");
  });

  it("tag maps to public.product_tags", () => {
    expect(getLegacyApprovalContract("tag").masterTarget).toBe("product_tags");
  });
});

describe("interpretApprovalRpcResult — soft-blocked approvals must never read as success", () => {
  it("classifies a real approval ({ok:true}) as approved", () => {
    const outcome = interpretApprovalRpcResult(
      { ok: true, action: "approved", draft_table: "catalogue_product_drafts" },
      null,
    );
    expect(outcome.kind).toBe("approved");
  });

  it("classifies the soft-block fallback response ({ok:false}) as soft_blocked, not approved", () => {
    const outcome = interpretApprovalRpcResult(
      {
        ok: false,
        action: "approve_blocked_mapping_not_finalized",
        draft_table: "catalogue_bom_drafts",
        message: "Approval mapping not finalized for this draft type",
      },
      null,
    );
    expect(outcome.kind).toBe("soft_blocked");
    expect(outcome.kind).not.toBe("approved");
    expect(outcome.message).toBe("Approval mapping not finalized for this draft type");
  });

  it("falls back to a safe default message when {ok:false} carries no message field", () => {
    const outcome = interpretApprovalRpcResult({ ok: false }, null);
    expect(outcome.kind).toBe("soft_blocked");
    expect(outcome.message.length).toBeGreaterThan(0);
  });

  it("classifies a genuine SQL error as error, independent of any response body", () => {
    const outcome = interpretApprovalRpcResult(null, { message: "Draft not found: catalogue_product_drafts.x" });
    expect(outcome.kind).toBe("error");
  });

  it("SQL error takes precedence even if a truthy-looking data payload is also present", () => {
    const outcome = interpretApprovalRpcResult({ ok: true }, { message: "permission denied" });
    expect(outcome.kind).toBe("error");
  });
});

// ---------------------------------------------------------------------------
// Static guardrail: no UI caller may invoke the two internal dispatcher RPCs by
// name. Only the wrapper RPCs named in this contract are permitted call targets;
// approve_catalogue_draft_internal / reject_catalogue_draft_internal are reached
// exclusively through those wrappers, live in the database only.
// ---------------------------------------------------------------------------

const BANNED_RPC_NAMES = ["approve_catalogue_draft_internal", "reject_catalogue_draft_internal"];

/** This file's own directory — used to resolve src/ regardless of cwd. */
const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(THIS_DIR, "..", "..");

/** Files allowed to reference the internal RPC names (documentation of the contract itself). */
const ALLOWED_FILES = new Set([path.resolve(THIS_DIR, "legacyApprovalContract.ts")]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts") && !entry.name.endsWith(".test.tsx")) {
      out.push(full);
    }
  }
  return out;
}

describe("no UI caller invokes the internal dispatcher RPCs directly", () => {
  const files = walk(SRC_ROOT);

  it("scanned at least the known legacy-draft caller files", () => {
    const relPaths = files.map((f) => path.relative(SRC_ROOT, f));
    expect(relPaths).toContain(path.join("features", "approvals", "ApprovalInbox.tsx"));
    expect(relPaths).toContain(path.join("features", "productAuthority", "infraProbe.ts"));
  });

  for (const bannedName of BANNED_RPC_NAMES) {
    it(`no non-contract source file contains the literal RPC name "${bannedName}"`, () => {
      const offenders: string[] = [];
      for (const file of files) {
        if (ALLOWED_FILES.has(file)) continue;
        const content = fs.readFileSync(file, "utf8");
        if (content.includes(bannedName)) offenders.push(path.relative(SRC_ROOT, file));
      }
      expect(offenders).toEqual([]);
    });
  }
});
