import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { ExtendedDatabase } from "@/integrations/supabase/types.extensions";
import type { WhatsAppKnowledgePublicationCandidate } from "./knowledgeBundle";

export const CORE_SUBMIT_KNOWLEDGE_DRAFT_RPC =
  "whatsapp_submit_intelligence_knowledge_draft" as const;

export type CoreKnowledgeSnapshotRow = {
  id: string;
  schema_version: string;
  lifecycle: string;
  source_catalogue_version_ids: string[];
  knowledge: Record<string, unknown>;
  content_checksum: string;
  created_by: string | null;
  created_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  published_at: string | null;
  activated_at: string | null;
  superseded_at: string | null;
  superseded_by: string | null;
};

export type KnowledgeSubmissionFailureCode =
  | "AUTHENTICATION_REQUIRED"
  | "NOT_AUTHORIZED"
  | "CANDIDATE_NOT_HANDOFF_READY"
  | "INVALID_KNOWLEDGE"
  | "CHECKSUM_MISMATCH"
  | "CATALOGUE_PROVENANCE_INVALID"
  | "IDEMPOTENCY_CONFLICT"
  | "LIFECYCLE_CONFLICT"
  | "NETWORK_OR_RPC_FAILURE"
  | "UNKNOWN_SERVER_FAILURE";

export type KnowledgeSubmissionError = {
  code: KnowledgeSubmissionFailureCode;
  message: string;
  serverCode: string | null;
};

export type SubmitKnowledgeDraftResult = {
  snapshot: CoreKnowledgeSnapshotRow;
  idempotencyKey: string;
  replayed: boolean;
};

export type SubmitKnowledgeDraftRpcArgs = {
  p_schema_version: string;
  p_source_catalogue_version_ids: string[];
  p_knowledge: Record<string, unknown>;
  p_content_checksum: string;
  p_candidate_status: string;
  p_handoff_eligibility: string;
  p_idempotency_key: string | null;
};

export type SubmitKnowledgeDraftDeps = {
  rpc: (
    fn: typeof CORE_SUBMIT_KNOWLEDGE_DRAFT_RPC,
    args: SubmitKnowledgeDraftRpcArgs,
  ) => Promise<{
    data: Record<string, unknown> | null;
    error: { message: string; code?: string } | null;
  }>;
};

const authorityDb = supabase as unknown as SupabaseClient<ExtendedDatabase>;

const defaultDeps: SubmitKnowledgeDraftDeps = {
  rpc: async (fn, args) => {
    const { data, error } = await authorityDb.rpc(fn, args);
    return {
      data: data as Record<string, unknown> | null,
      error: error ? { message: error.message, code: error.code } : null,
    };
  },
};

/** Stable per-candidate idempotency key — changes when canonical checksum changes. */
export function buildKnowledgeSubmissionIdempotencyKey(
  candidate: Pick<
    WhatsAppKnowledgePublicationCandidate,
    "content_checksum" | "source_catalogue_version_ids"
  >,
): string {
  const provenance = [...candidate.source_catalogue_version_ids].sort().join(",");
  return `wa-knowledge-handoff:${candidate.content_checksum}:${provenance}`;
}

export function toCoreSubmitKnowledgeDraftRpcArgs(
  candidate: WhatsAppKnowledgePublicationCandidate,
  idempotencyKey: string,
): SubmitKnowledgeDraftRpcArgs {
  return {
    p_schema_version: candidate.schema_version,
    p_source_catalogue_version_ids: candidate.source_catalogue_version_ids,
    p_knowledge: candidate.knowledge,
    p_content_checksum: candidate.content_checksum,
    p_candidate_status: candidate.candidate_status,
    p_handoff_eligibility: candidate.handoff_eligibility,
    p_idempotency_key: idempotencyKey,
  };
}

export function rowFromKnowledgeSnapshotPayload(
  data: Record<string, unknown>,
): CoreKnowledgeSnapshotRow {
  return {
    id: String(data.id),
    schema_version: String(data.schema_version),
    lifecycle: String(data.lifecycle),
    source_catalogue_version_ids: (data.source_catalogue_version_ids as string[] | null) ?? [],
    knowledge: (data.knowledge as Record<string, unknown>) ?? {},
    content_checksum: String(data.content_checksum),
    created_by: (data.created_by as string | null) ?? null,
    created_at: String(data.created_at),
    reviewed_by: (data.reviewed_by as string | null) ?? null,
    reviewed_at: (data.reviewed_at as string | null) ?? null,
    approved_by: (data.approved_by as string | null) ?? null,
    approved_at: (data.approved_at as string | null) ?? null,
    published_at: (data.published_at as string | null) ?? null,
    activated_at: (data.activated_at as string | null) ?? null,
    superseded_at: (data.superseded_at as string | null) ?? null,
    superseded_by: (data.superseded_by as string | null) ?? null,
  };
}

export function classifyKnowledgeSubmissionError(error: {
  message: string;
  code?: string | null;
}): KnowledgeSubmissionError {
  const message = error.message || "Unknown submission failure";
  const serverCode = error.code ?? null;
  const normalized = message.toLowerCase();

  if (
    serverCode === "PGRST301" ||
    normalized.includes("jwt") ||
    normalized.includes("not authenticated") ||
    normalized.includes("authentication required")
  ) {
    return { code: "AUTHENTICATION_REQUIRED", message, serverCode };
  }

  if (
    serverCode === "42501" ||
    normalized.includes("not authorized") ||
    normalized.includes("authority required")
  ) {
    return { code: "NOT_AUTHORIZED", message, serverCode };
  }

  if (
    serverCode === "23505" ||
    normalized.includes("idempotency key reused with conflicting payload")
  ) {
    return { code: "IDEMPOTENCY_CONFLICT", message, serverCode };
  }

  if (serverCode === "55000" || normalized.includes("lifecycle conflict")) {
    return { code: "LIFECYCLE_CONFLICT", message, serverCode };
  }

  if (normalized.includes("content_checksum does not match")) {
    return { code: "CHECKSUM_MISMATCH", message, serverCode };
  }

  if (
    normalized.includes("catalogue version") ||
    normalized.includes("source_catalogue_version_ids") ||
    normalized.includes("provenance")
  ) {
    return { code: "CATALOGUE_PROVENANCE_INVALID", message, serverCode };
  }

  if (
    normalized.includes("only handoff_ready") ||
    normalized.includes("only publication_candidate") ||
    normalized.includes("not_handoff_ready")
  ) {
    return { code: "CANDIDATE_NOT_HANDOFF_READY", message, serverCode };
  }

  if (
    serverCode === "22023" ||
    normalized.includes("knowledge bundle") ||
    normalized.includes("forbidden transactional") ||
    normalized.includes("unknown top-level knowledge field")
  ) {
    return { code: "INVALID_KNOWLEDGE", message, serverCode };
  }

  if (
    normalized.includes("fetch failed") ||
    normalized.includes("network") ||
    normalized.includes("failed to fetch") ||
    serverCode === "PGRST000"
  ) {
    return { code: "NETWORK_OR_RPC_FAILURE", message, serverCode };
  }

  return { code: "UNKNOWN_SERVER_FAILURE", message, serverCode };
}

export async function submitKnowledgeDraftToCore(
  candidate: WhatsAppKnowledgePublicationCandidate,
  options: {
    idempotencyKey?: string;
    replayed?: boolean;
  } = {},
  deps: SubmitKnowledgeDraftDeps = defaultDeps,
): Promise<SubmitKnowledgeDraftResult> {
  if (candidate.candidate_status !== "PUBLICATION_CANDIDATE") {
    throw Object.assign(new Error("only PUBLICATION_CANDIDATE may be submitted"), {
      classified: {
        code: "CANDIDATE_NOT_HANDOFF_READY",
        message: "only PUBLICATION_CANDIDATE may be submitted",
        serverCode: "22023",
      } satisfies KnowledgeSubmissionError,
    });
  }

  if (candidate.handoff_eligibility !== "HANDOFF_READY") {
    throw Object.assign(new Error("only HANDOFF_READY candidates may be submitted"), {
      classified: {
        code: "CANDIDATE_NOT_HANDOFF_READY",
        message: "only HANDOFF_READY candidates may be submitted",
        serverCode: "22023",
      } satisfies KnowledgeSubmissionError,
    });
  }

  const idempotencyKey =
    options.idempotencyKey ?? buildKnowledgeSubmissionIdempotencyKey(candidate);
  const args = toCoreSubmitKnowledgeDraftRpcArgs(candidate, idempotencyKey);

  const { data, error } = await deps.rpc(CORE_SUBMIT_KNOWLEDGE_DRAFT_RPC, args);
  if (error) {
    const classified = classifyKnowledgeSubmissionError(error);
    throw Object.assign(new Error(classified.message), { classified });
  }
  if (!data) {
    const classified: KnowledgeSubmissionError = {
      code: "UNKNOWN_SERVER_FAILURE",
      message: "Core submission RPC returned no snapshot row",
      serverCode: null,
    };
    throw Object.assign(new Error(classified.message), { classified });
  }

  return {
    snapshot: rowFromKnowledgeSnapshotPayload(data),
    idempotencyKey,
    replayed: options.replayed ?? false,
  };
}
