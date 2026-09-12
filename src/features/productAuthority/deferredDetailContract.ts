/**
 * Point 53 — canonical deferred-detail contract for governed product creation/editing.
 *
 * Single source of truth for nullable / unknown / deferred / pending field semantics across
 * Fast Create, Full Editor handoff, contributor drafts, Catalogue Studio workflow, and
 * publication gates. Fail-closed: deferred and unknown are never coerced to guessed values
 * and never treated as complete at a blocking stage.
 */

import type { GovernedAiConfidence } from "@/features/governedAiExtraction/types";

/** Contract version — bump when serialized shape changes. */
export const DEFERRED_DETAIL_CONTRACT_VERSION = 1;

/** Missing-field placeholder prefix used in catalogue content generators. */
export const MISSING_FIELD_PLACEHOLDER_PREFIX = "Add missing field first:";

export type DeferredDetailState = "known" | "deferred" | "unknown" | "pending_review";

export type WorkflowStage = "draft_creation" | "approval" | "publication";

export type DeferredDetailProvenanceSource =
  | "operator"
  | "ai_suggestion"
  | "category_default"
  | "correction_resubmit"
  | "system";

export interface DeferredDetailProvenance {
  source: DeferredDetailProvenanceSource;
  recorded_at: string;
  /** Prior state when a correction/resubmission resolves or reopens a field. */
  previous_state?: DeferredDetailState;
  note?: string;
}

export interface DeferredDetailField {
  field_key: string;
  state: DeferredDetailState;
  reason: string | null;
  /** Stage until which an explicit deferral is permitted without blocking. */
  deferred_until_stage: WorkflowStage | null;
  provenance: DeferredDetailProvenance | null;
  /** Stages at which this field blocks transition when not `known`. */
  blocking_stages: WorkflowStage[];
}

export interface DeferredDetailManifest {
  contract_version: number;
  fields: DeferredDetailField[];
}

export interface TransitionGateResult {
  allowed: boolean;
  blocking_fields: DeferredDetailField[];
  stage: WorkflowStage;
}

/** Only `known` counts as complete — never coerce deferred/unknown/pending_review. */
export function isFieldComplete(state: DeferredDetailState): boolean {
  return state === "known";
}

/** Map readiness tri-state (pass/warn/missing) to deferred-detail state. */
export function fieldStateFromReadiness(
  readiness: "pass" | "warn" | "missing",
  opts?: { deferredUntilStage?: WorkflowStage; reason?: string },
): Pick<DeferredDetailField, "state" | "reason" | "deferred_until_stage"> {
  switch (readiness) {
    case "pass":
      return { state: "known", reason: null, deferred_until_stage: null };
    case "warn":
      return {
        state: "deferred",
        reason: opts?.reason ?? "Complete in a later workflow stage.",
        deferred_until_stage: opts?.deferredUntilStage ?? "approval",
      };
    case "missing":
      return {
        state: "unknown",
        reason: opts?.reason ?? "Required value not provided.",
        deferred_until_stage: null,
      };
  }
}

/** Map governed AI confidence to deferred-detail state. */
export function fieldStateFromAiConfidence(confidence: GovernedAiConfidence): DeferredDetailState {
  switch (confidence) {
    case "high":
    case "medium":
      return "pending_review";
    case "low":
      return "deferred";
    case "unresolved":
      return "unknown";
  }
}

/**
 * Distinguish null / empty-string / whitespace from a known value.
 * Empty string is NOT treated as known — avoids null/"" ambiguity at gates.
 */
export function fieldStateFromValue(
  value: unknown,
  opts?: { allowZero?: boolean },
): DeferredDetailState {
  if (value === null || value === undefined) return "unknown";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return "unknown";
    return "known";
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "unknown";
    if (!opts?.allowZero && value <= 0) return "unknown";
    return "known";
  }
  if (typeof value === "boolean") return "known";
  return "known";
}

/** Whether a field blocks the given workflow stage transition. */
export function fieldBlocksStage(field: DeferredDetailField, stage: WorkflowStage): boolean {
  if (isFieldComplete(field.state)) return false;
  if (!field.blocking_stages.includes(stage)) return false;
  if (field.state === "deferred" && field.deferred_until_stage) {
    const stageOrder: WorkflowStage[] = ["draft_creation", "approval", "publication"];
    const deferIdx = stageOrder.indexOf(field.deferred_until_stage);
    const targetIdx = stageOrder.indexOf(stage);
    // Deferred fields are permitted before deferred_until_stage; block at that stage and after.
    if (targetIdx < deferIdx) return false;
  }
  return true;
}

/** Fail-closed transition gate — returns blocking fields for the target stage. */
export function evaluateTransitionGate(
  manifest: DeferredDetailManifest | null | undefined,
  stage: WorkflowStage,
): TransitionGateResult {
  const fields = manifest?.fields ?? [];
  const blocking = fields.filter((f) => fieldBlocksStage(f, stage));
  return { allowed: blocking.length === 0, blocking_fields: blocking, stage };
}

export function createDeferredDetailField(
  fieldKey: string,
  state: DeferredDetailState,
  opts?: {
    reason?: string | null;
    deferredUntilStage?: WorkflowStage | null;
    provenance?: DeferredDetailProvenance | null;
    blockingStages?: WorkflowStage[];
  },
): DeferredDetailField {
  const defaultBlocking: WorkflowStage[] = state === "known" ? [] : ["approval", "publication"];
  return {
    field_key: fieldKey,
    state,
    reason: opts?.reason ?? null,
    deferred_until_stage: opts?.deferredUntilStage ?? null,
    provenance: opts?.provenance ?? null,
    blocking_stages: opts?.blockingStages ?? defaultBlocking,
  };
}

export function emptyDeferredDetailManifest(): DeferredDetailManifest {
  return { contract_version: DEFERRED_DETAIL_CONTRACT_VERSION, fields: [] };
}

/** Serialize for contributor draft payload, source_snapshot, or session handoff. */
export function serializeDeferredDetailManifest(
  manifest: DeferredDetailManifest,
): Record<string, unknown> {
  return {
    contract_version: manifest.contract_version,
    fields: manifest.fields.map((f) => ({
      field_key: f.field_key,
      state: f.state,
      reason: f.reason,
      deferred_until_stage: f.deferred_until_stage,
      provenance: f.provenance,
      blocking_stages: f.blocking_stages,
    })),
  };
}

/** Rehydrate from JSON — returns null when shape is invalid (fail-closed). */
export function parseDeferredDetailManifest(raw: unknown): DeferredDetailManifest | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.contract_version !== "number") return null;
  if (!Array.isArray(obj.fields)) return null;

  const fields: DeferredDetailField[] = [];
  for (const item of obj.fields) {
    if (!item || typeof item !== "object") return null;
    const f = item as Record<string, unknown>;
    if (typeof f.field_key !== "string") return null;
    if (
      f.state !== "known" &&
      f.state !== "deferred" &&
      f.state !== "unknown" &&
      f.state !== "pending_review"
    ) {
      return null;
    }
    fields.push({
      field_key: f.field_key,
      state: f.state as DeferredDetailState,
      reason: typeof f.reason === "string" ? f.reason : f.reason === null ? null : null,
      deferred_until_stage:
        f.deferred_until_stage === "draft_creation" ||
        f.deferred_until_stage === "approval" ||
        f.deferred_until_stage === "publication"
          ? f.deferred_until_stage
          : f.deferred_until_stage === null
            ? null
            : null,
      provenance: parseProvenance(f.provenance),
      blocking_stages: parseBlockingStages(f.blocking_stages),
    });
  }

  return { contract_version: obj.contract_version, fields };
}

function parseProvenance(raw: unknown): DeferredDetailProvenance | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const validSources: DeferredDetailProvenanceSource[] = [
    "operator",
    "ai_suggestion",
    "category_default",
    "correction_resubmit",
    "system",
  ];
  if (!validSources.includes(p.source as DeferredDetailProvenanceSource)) return null;
  if (typeof p.recorded_at !== "string") return null;
  return {
    source: p.source as DeferredDetailProvenanceSource,
    recorded_at: p.recorded_at,
    previous_state: parseOptionalState(p.previous_state),
    note: typeof p.note === "string" ? p.note : undefined,
  };
}

function parseOptionalState(raw: unknown): DeferredDetailState | undefined {
  if (raw === "known" || raw === "deferred" || raw === "unknown" || raw === "pending_review") {
    return raw;
  }
  return undefined;
}

function parseBlockingStages(raw: unknown): WorkflowStage[] {
  if (!Array.isArray(raw)) return ["approval", "publication"];
  const valid: WorkflowStage[] = [];
  for (const s of raw) {
    if (s === "draft_creation" || s === "approval" || s === "publication") {
      valid.push(s);
    }
  }
  return valid.length > 0 ? valid : ["approval", "publication"];
}

/**
 * Merge manifests on correction/resubmission — preserves provenance of resolved fields
 * and carries forward still-deferred fields from the prior version.
 */
export function mergeDeferredDetailOnResubmit(
  previous: DeferredDetailManifest | null,
  current: DeferredDetailManifest,
  correctionNote?: string,
): DeferredDetailManifest {
  if (!previous) return current;
  const now = new Date().toISOString();
  const prevByKey = new Map(previous.fields.map((f) => [f.field_key, f]));
  const mergedFields = current.fields.map((field) => {
    const prev = prevByKey.get(field.field_key);
    if (!prev) return field;
    if (prev.state !== field.state && isFieldComplete(field.state)) {
      return {
        ...field,
        provenance: {
          source: "correction_resubmit",
          recorded_at: now,
          previous_state: prev.state,
          note: correctionNote ?? `Resolved from ${prev.state}`,
        },
      };
    }
    return field;
  });
  return { contract_version: DEFERRED_DETAIL_CONTRACT_VERSION, fields: mergedFields };
}

/** Attach deferred-detail manifest into an existing source_snapshot blob. */
export function attachDeferredDetailToSourceSnapshot(
  snapshot: Record<string, unknown>,
  manifest: DeferredDetailManifest,
): Record<string, unknown> {
  return {
    ...snapshot,
    deferred_detail: serializeDeferredDetailManifest(manifest),
  };
}

/** Read deferred_detail from a source_snapshot or contributor payload. */
export function deferredDetailFromPayload(
  payload: Record<string, unknown> | null | undefined,
): DeferredDetailManifest | null {
  if (!payload) return null;
  const nested = payload.deferred_detail ?? payload.deferred_fields;
  return parseDeferredDetailManifest(nested);
}

/** Detect catalogue missing-field placeholder text (whole-block or embedded). */
export function contentHasMissingFieldPlaceholder(text: string): boolean {
  return text.includes(MISSING_FIELD_PLACEHOLDER_PREFIX);
}

/** Infer deferred-detail fields from catalogue content blocks carrying placeholders. */
export function deferredDetailFromCatalogueContent(
  content: Record<string, string>,
): DeferredDetailField[] {
  const now = new Date().toISOString();
  return Object.entries(content)
    .filter(([, text]) => contentHasMissingFieldPlaceholder(text))
    .map(([key]) =>
      createDeferredDetailField(key, "unknown", {
        reason: "Content block contains missing-field placeholder.",
        blockingStages: ["approval", "publication"],
        provenance: { source: "system", recorded_at: now },
      }),
    );
}
