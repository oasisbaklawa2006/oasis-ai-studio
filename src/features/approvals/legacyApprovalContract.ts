/**
 * Single source of truth for the legacy seven-table catalogue draft/approval RPC contract.
 *
 * Every value here is verified against the live production function definitions captured in
 * docs/recovery/LIVE_CATALOGUE_APPROVAL_RPC_PROVENANCE_2026-07-14.md (SHA-256 per function
 * recorded there). This module does not call the database — it only names what is already live.
 *
 * `masterTarget` reflects what `approve_catalogue_draft_internal` actually does today, not what
 * any table-name convention implies: only product/tag/alias have a real mapping branch. bom, moq,
 * pricing, and media fall through to that function's soft-block fallback (an audit row with
 * action = 'approve_blocked_mapping_not_finalized', no master-table write) — so their
 * `masterTarget` is `null` and `approvalMappingStatus` is `"soft_blocked"`, never `"mapped"`.
 */

export type LegacyDraftType = "product" | "media" | "alias" | "bom" | "moq" | "pricing" | "tag";

export type LegacyApprovalMappingStatus = "mapped" | "soft_blocked";

export interface LegacyApprovalContractEntry {
  readonly draftType: LegacyDraftType;
  /** The catalogue_*_drafts/catalogue_media_submissions table this draft type is stored in. */
  readonly table: string;
  /** Exact live RPC name for public.{approve_catalogue_draft_internal} delegation (approve path). */
  readonly approveRpc: string;
  /** Exact live RPC name for public.{reject_catalogue_draft_internal} delegation (reject path). */
  readonly rejectRpc: string;
  /**
   * Master table `approve_catalogue_draft_internal` actually writes to on success, or `null` if
   * approval for this draft type is currently soft-blocked (no master-table write occurs).
   */
  readonly masterTarget: "products" | "product_tags" | "product_aliases" | null;
  /** Whether calling `approveRpc` today can ever result in a real master-table write. */
  readonly approvalMappingStatus: LegacyApprovalMappingStatus;
}

export const LEGACY_APPROVAL_CONTRACT: readonly LegacyApprovalContractEntry[] = [
  {
    draftType: "product",
    table: "catalogue_product_drafts",
    approveRpc: "approve_catalogue_product_draft",
    rejectRpc: "reject_catalogue_product_draft",
    masterTarget: "products",
    approvalMappingStatus: "mapped",
  },
  {
    draftType: "media",
    table: "catalogue_media_submissions",
    approveRpc: "approve_catalogue_media_submission",
    rejectRpc: "reject_catalogue_media_submission",
    masterTarget: null,
    approvalMappingStatus: "soft_blocked",
  },
  {
    draftType: "alias",
    table: "catalogue_alias_drafts",
    approveRpc: "approve_catalogue_alias_draft",
    rejectRpc: "reject_catalogue_alias_draft",
    masterTarget: "product_aliases",
    approvalMappingStatus: "mapped",
  },
  {
    draftType: "bom",
    table: "catalogue_bom_drafts",
    approveRpc: "approve_catalogue_bom_draft",
    rejectRpc: "reject_catalogue_bom_draft",
    masterTarget: null,
    approvalMappingStatus: "soft_blocked",
  },
  {
    draftType: "moq",
    table: "catalogue_moq_drafts",
    approveRpc: "approve_catalogue_moq_draft",
    rejectRpc: "reject_catalogue_moq_draft",
    masterTarget: null,
    approvalMappingStatus: "soft_blocked",
  },
  {
    draftType: "pricing",
    table: "catalogue_pricing_drafts",
    approveRpc: "approve_catalogue_pricing_draft",
    rejectRpc: "reject_catalogue_pricing_draft",
    masterTarget: null,
    approvalMappingStatus: "soft_blocked",
  },
  {
    draftType: "tag",
    table: "catalogue_tag_drafts",
    approveRpc: "approve_catalogue_tag_draft",
    rejectRpc: "reject_catalogue_tag_draft",
    masterTarget: "product_tags",
    approvalMappingStatus: "mapped",
  },
] as const;

export const LEGACY_APPROVAL_CONTRACT_BY_TYPE: Readonly<Record<LegacyDraftType, LegacyApprovalContractEntry>> =
  Object.fromEntries(LEGACY_APPROVAL_CONTRACT.map((entry) => [entry.draftType, entry])) as Record<
    LegacyDraftType,
    LegacyApprovalContractEntry
  >;

export function getLegacyApprovalContract(draftType: LegacyDraftType): LegacyApprovalContractEntry {
  return LEGACY_APPROVAL_CONTRACT_BY_TYPE[draftType];
}

/** True when approving this draft type today can never produce a real master-table write. */
export function isApprovalSoftBlocked(draftType: LegacyDraftType): boolean {
  return LEGACY_APPROVAL_CONTRACT_BY_TYPE[draftType].approvalMappingStatus === "soft_blocked";
}

export interface ApprovalRpcOutcome {
  readonly kind: "approved" | "soft_blocked" | "error";
  readonly message: string;
}

/**
 * All seven `approve_catalogue_*_draft` RPCs return successfully (no SQL `error`) even when
 * `approve_catalogue_draft_internal`'s soft-block fallback ran for bom/moq/pricing/media — the
 * call succeeds, but the response body is `{ok:false,...}` and no master-table write happened.
 * Callers MUST branch on the response body's `ok` field, not just the SQL error, or a soft-blocked
 * approval gets silently mispresented to the reviewer as a genuine, publishable approval.
 */
export function interpretApprovalRpcResult(
  data: unknown,
  error: { message?: string } | null | undefined,
): ApprovalRpcOutcome {
  if (error) {
    return { kind: "error", message: error.message ?? "Approval failed." };
  }
  if (data && typeof data === "object" && (data as { ok?: unknown }).ok === false) {
    const rawMessage = (data as { message?: unknown }).message;
    return {
      kind: "soft_blocked",
      message:
        typeof rawMessage === "string" && rawMessage.length > 0
          ? rawMessage
          : "Approval mapping not finalized for this draft type — no master record was created.",
    };
  }
  return { kind: "approved", message: "Approved" };
}
