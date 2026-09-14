/**
 * Point 40 — immutable product workflow version / audit history read model.
 *
 * Reads Core audit rows (`catalogue_ai_studio_draft_audit_log`) and draft versions
 * (`catalogue_ai_studio_drafts`) — never writes or rewrites audit authority.
 *
 * Boundaries (not absorbed):
 * - Point 39 — correction/resubmission mechanics (`productCorrectionContract.ts`)
 * - Point 54 — publication (`published` / `synced`)
 */
import type {
  CatalogueDraftAuditRow,
  CatalogueDraftRow,
  CatalogueDraftStatus,
} from "@/features/catalogueAiStudio/catalogueDraftTypes";
import {
  type PredecessorLinkage,
  isTerminalDraftStatus,
} from "./productCorrectionContract";
import { mapCatalogueDraftStatus } from "./productWorkflowState";

export const POINT_40_READ_MODEL_SCHEMA = "point40_v1" as const;

/** Metadata keys that must never surface in version history UI. */
const SECRET_METADATA_KEYS = new Set([
  "source_snapshot",
  "ai_generation",
  "raw_prompt",
  "raw_ai_payload",
  "internal_prompt",
]);

const GOVERNED_AUDIT_ACTIONS = new Set([
  "CREATE_DRAFT",
  "CREATE_NEW_VERSION",
  "SAVE_DRAFT",
  "SUBMIT_FOR_REVIEW",
  "APPROVE",
  "REJECT",
]);

export type ProductWorkflowVersionRecord = {
  draft_id: string;
  version_number: number;
  status: CatalogueDraftStatus;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  rejection_reason: string | null;
  is_terminal: boolean;
  is_current: boolean;
  is_stale: boolean;
  predecessor: PredecessorLinkage | null;
};

export type ProductWorkflowAuditEvent = {
  id: string;
  draft_id: string;
  version_number: number;
  action: string;
  from_status: string | null;
  to_status: string | null;
  actor_id: string | null;
  created_at: string;
  reason: string | null;
  change_summary: string;
  metadata_safe: Record<string, unknown>;
};

export type ProductVersionHistoryReadModel = {
  schema: typeof POINT_40_READ_MODEL_SCHEMA;
  product_id: string;
  head_version_number: number;
  versions: ProductWorkflowVersionRecord[];
  events: ProductWorkflowAuditEvent[];
  chain_valid: boolean;
  chain_errors: string[];
};

export function stripSecretAuditMetadata(
  metadata: CatalogueDraftAuditRow["metadata"],
): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata as Record<string, unknown>)) {
    if (SECRET_METADATA_KEYS.has(key)) continue;
    safe[key] = value;
  }
  return safe;
}

export function parsePredecessorLinkage(
  metadata: CatalogueDraftAuditRow["metadata"],
): PredecessorLinkage | null {
  const safe = stripSecretAuditMetadata(metadata);
  const draftId = safe.predecessor_draft_id;
  const versionNumber = safe.predecessor_version_number;
  const status = safe.predecessor_status;
  const kind = safe.correction_kind;
  if (typeof draftId !== "string" || typeof versionNumber !== "number") return null;
  if (typeof status !== "string" || typeof kind !== "string") return null;
  const linkage: PredecessorLinkage = {
    predecessor_draft_id: draftId,
    predecessor_version_number: versionNumber,
    predecessor_status: status as CatalogueDraftStatus,
    correction_kind: kind as PredecessorLinkage["correction_kind"],
  };
  const priorReason = safe.previous_version_rejection_reason;
  if (typeof priorReason === "string" && priorReason.trim()) {
    linkage.previous_version_rejection_reason = priorReason.trim();
  }
  return linkage;
}

export function auditEventReason(
  entry: CatalogueDraftAuditRow,
  safeMetadata: Record<string, unknown>,
): string | null {
  const rejection = safeMetadata.rejection_reason;
  if (typeof rejection === "string" && rejection.trim()) return rejection.trim();
  const prior = safeMetadata.previous_version_rejection_reason;
  if (typeof prior === "string" && prior.trim()) return prior.trim();
  return null;
}

export function summarizeAuditAction(entry: CatalogueDraftAuditRow): string {
  const from = entry.from_status ?? "—";
  const to = entry.to_status ?? "—";
  switch (entry.action) {
    case "CREATE_DRAFT":
      return "Initial draft created";
    case "CREATE_NEW_VERSION":
      return "New version started from terminal predecessor";
    case "SAVE_DRAFT":
      return "Draft content saved";
    case "SUBMIT_FOR_REVIEW":
      return `Submitted for review (${from} → ${to})`;
    case "APPROVE":
      return `Approved (${from} → ${to})`;
    case "REJECT":
      return `Rejected (${from} → ${to})`;
    default:
      return `${entry.action} (${from} → ${to})`;
  }
}

export function isStaleCatalogueDraftVersion(
  versionNumber: number,
  headVersionNumber: number,
): boolean {
  return versionNumber < headVersionNumber;
}

/**
 * Builds the canonical Point 40 read model from persisted draft rows and audit log entries.
 * Fail-closed: `chain_valid=false` when predecessor linkage or chronology is broken.
 */
export function buildProductVersionHistory(input: {
  productId: string;
  drafts: CatalogueDraftRow[];
  auditByDraftId: Map<string, CatalogueDraftAuditRow[]>;
}): ProductVersionHistoryReadModel {
  const sortedDrafts = [...input.drafts].sort((a, b) => a.version_number - b.version_number);
  const headVersionNumber =
    sortedDrafts.length > 0
      ? Math.max(...sortedDrafts.map((d) => d.version_number))
      : 0;

  const draftByVersion = new Map(sortedDrafts.map((d) => [d.version_number, d]));
  const chainErrors: string[] = [];

  if (sortedDrafts.length > 0) {
    const numbers = sortedDrafts.map((d) => d.version_number);
    for (let expected = 1; expected <= headVersionNumber; expected++) {
      if (!numbers.includes(expected)) {
        chainErrors.push(`Missing version_number ${expected} in predecessor chain.`);
      }
    }
  }

  const versions: ProductWorkflowVersionRecord[] = sortedDrafts.map((draft) => {
    const audits = input.auditByDraftId.get(draft.id) ?? [];
    const createAudit = audits.find(
      (e) => e.action === "CREATE_NEW_VERSION" || e.action === "CREATE_DRAFT",
    );
    const predecessor =
      createAudit?.action === "CREATE_NEW_VERSION"
        ? parsePredecessorLinkage(createAudit.metadata)
        : null;

    if (draft.version_number > 1 && !predecessor) {
      chainErrors.push(
        `Version v${draft.version_number} (${draft.id}) lacks CREATE_NEW_VERSION predecessor linkage.`,
      );
    }

    if (predecessor) {
      const predDraft = draftByVersion.get(predecessor.predecessor_version_number);
      if (!predDraft) {
        chainErrors.push(
          `Version v${draft.version_number} references missing predecessor v${predecessor.predecessor_version_number}.`,
        );
      } else if (predDraft.id !== predecessor.predecessor_draft_id) {
        chainErrors.push(
          `Version v${draft.version_number} predecessor_draft_id does not match v${predecessor.predecessor_version_number} row.`,
        );
      }
      if (predDraft && new Date(draft.created_at).getTime() < new Date(predDraft.created_at).getTime()) {
        chainErrors.push(
          `Version v${draft.version_number} created_at precedes predecessor v${predecessor.predecessor_version_number}.`,
        );
      }
    }

    const status = draft.status as CatalogueDraftStatus;
    const terminalSave = audits.some(
      (e) =>
        e.action === "SAVE_DRAFT" &&
        (e.from_status === "APPROVED" || e.from_status === "REJECTED"),
    );
    if (terminalSave) {
      chainErrors.push(
        `Version v${draft.version_number} audit log shows in-place terminal mutation — history may be unreliable.`,
      );
    }

    return {
      draft_id: draft.id,
      version_number: draft.version_number,
      status,
      created_at: draft.created_at,
      updated_at: draft.updated_at,
      created_by: draft.created_by,
      reviewed_at: draft.reviewed_at,
      reviewed_by: draft.reviewed_by,
      rejection_reason: draft.rejection_reason,
      is_terminal: isTerminalDraftStatus(status),
      is_current: draft.version_number === headVersionNumber,
      is_stale: isStaleCatalogueDraftVersion(draft.version_number, headVersionNumber),
      predecessor,
    };
  });

  const events: ProductWorkflowAuditEvent[] = [];
  for (const draft of sortedDrafts) {
    const audits = input.auditByDraftId.get(draft.id) ?? [];
    for (const entry of audits) {
      const metadataSafe = stripSecretAuditMetadata(entry.metadata);
      if (GOVERNED_AUDIT_ACTIONS.has(entry.action) && !entry.actor_id) {
        chainErrors.push(
          `Audit ${entry.action} on v${draft.version_number} missing actor_id — fail-closed.`,
        );
      }
      events.push({
        id: entry.id,
        draft_id: entry.draft_id,
        version_number: draft.version_number,
        action: entry.action,
        from_status: entry.from_status,
        to_status: entry.to_status,
        actor_id: entry.actor_id,
        created_at: entry.created_at,
        reason: auditEventReason(entry, metadataSafe),
        change_summary: summarizeAuditAction(entry),
        metadata_safe: metadataSafe,
      });
    }
  }

  events.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  for (let i = 1; i < versions.length; i++) {
    const prev = versions[i - 1];
    const curr = versions[i];
    if (!prev.is_terminal) {
      chainErrors.push(
        `Version v${curr.version_number} starts before v${prev.version_number} reached a terminal snapshot.`,
      );
    }
  }

  const uniqueErrors = [...new Set(chainErrors)];

  return {
    schema: POINT_40_READ_MODEL_SCHEMA,
    product_id: input.productId,
    head_version_number: headVersionNumber,
    versions,
    events,
    chain_valid: uniqueErrors.length === 0,
    chain_errors: uniqueErrors,
  };
}

export function assertValidProductVersionHistory(model: ProductVersionHistoryReadModel): void {
  if (!model.chain_valid) {
    throw new Error(
      model.chain_errors[0] ?? "Product version history chain is invalid — fail-closed.",
    );
  }
}

/** Maps a draft row to its canonical workflow phase label for history surfaces. */
export function versionHistoryPhaseLabel(status: CatalogueDraftStatus | null): string {
  switch (mapCatalogueDraftStatus(status)) {
    case "draft":
      return "Draft";
    case "submitted":
      return "Under review";
    case "approved":
      return "Approved (terminal)";
    case "rejected":
      return "Rejected (terminal)";
    default:
      return "Pre-draft";
  }
}
