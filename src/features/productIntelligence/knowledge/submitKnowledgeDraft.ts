import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type {
  CoreKnowledgeSnapshotRow,
  ExtendedDatabase,
} from "@/integrations/supabase/types.extensions";
import type { WhatsAppKnowledgePublicationCandidate } from "./knowledgeBundle";

export type { CoreKnowledgeSnapshotRow };

export const CORE_SUBMIT_KNOWLEDGE_DRAFT_RPC =
  "whatsapp_submit_intelligence_knowledge_draft" as const;

export type KnowledgeSubmissionFailureCode =
  | "AUTHENTICATION_REQUIRED"
  | "NOT_AUTHORIZED"
  | "CANDIDATE_NOT_HANDOFF_READY"
  | "INVALID_KNOWLEDGE"
  | "CHECKSUM_MISMATCH"
  | "CATALOGUE_PROVENANCE_INVALID"
  | "IDEMPOTENCY_CONFLICT"
  | "LIFECYCLE_CONFLICT"
  | "INVALID_CORE_RESPONSE"
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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isKnowledgeObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function optionalNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === "string" ? value : null;
}

function invalidCoreResponse(detail: string): Error {
  const classified: KnowledgeSubmissionError = {
    code: "INVALID_CORE_RESPONSE",
    message: `Core response invalid: ${detail}`,
    serverCode: null,
  };
  return Object.assign(new Error(classified.message), { classified });
}

/** Fail-closed parser for governed Core DRAFT snapshot RPC responses. */
export function parseKnowledgeSnapshotResponse(
  data: Record<string, unknown>,
  expectedChecksum: string,
): CoreKnowledgeSnapshotRow {
  if (!isNonEmptyString(data.id)) {
    throw invalidCoreResponse("missing or invalid snapshot id");
  }
  if (!isNonEmptyString(data.schema_version)) {
    throw invalidCoreResponse("missing or invalid schema_version");
  }
  if (data.lifecycle !== "DRAFT") {
    throw invalidCoreResponse(`lifecycle must be DRAFT, received ${String(data.lifecycle)}`);
  }
  if (!isNonEmptyString(data.content_checksum)) {
    throw invalidCoreResponse("missing or invalid content_checksum");
  }
  if (data.content_checksum !== expectedChecksum) {
    throw invalidCoreResponse("content_checksum does not match submitted candidate");
  }
  if (!isStringArray(data.source_catalogue_version_ids)) {
    throw invalidCoreResponse("source_catalogue_version_ids must be a string array");
  }
  if (!isKnowledgeObject(data.knowledge)) {
    throw invalidCoreResponse("knowledge must be a JSON object");
  }
  if (!isNonEmptyString(data.created_at)) {
    throw invalidCoreResponse("missing or invalid created_at");
  }

  return {
    id: data.id,
    schema_version: data.schema_version,
    lifecycle: data.lifecycle,
    source_catalogue_version_ids: data.source_catalogue_version_ids,
    knowledge: data.knowledge,
    content_checksum: data.content_checksum,
    created_by: optionalNullableString(data.created_by),
    created_at: data.created_at,
    reviewed_by: optionalNullableString(data.reviewed_by),
    reviewed_at: optionalNullableString(data.reviewed_at),
    approved_by: optionalNullableString(data.approved_by),
    approved_at: optionalNullableString(data.approved_at),
    published_at: optionalNullableString(data.published_at),
    activated_at: optionalNullableString(data.activated_at),
    superseded_at: optionalNullableString(data.superseded_at),
    superseded_by: optionalNullableString(data.superseded_by),
  };
}

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

type ErrorClassifierContext = {
  message: string;
  normalized: string;
  serverCode: string | null;
};

type ErrorClassifierRule = {
  code: KnowledgeSubmissionFailureCode;
  match: (ctx: ErrorClassifierContext) => boolean;
};

const ERROR_CLASSIFIER_RULES: ErrorClassifierRule[] = [
  {
    code: "AUTHENTICATION_REQUIRED",
    match: ({ normalized, serverCode }) =>
      serverCode === "PGRST301" ||
      normalized.includes("jwt") ||
      normalized.includes("not authenticated") ||
      normalized.includes("authentication required"),
  },
  {
    code: "NOT_AUTHORIZED",
    match: ({ normalized, serverCode }) =>
      serverCode === "42501" ||
      normalized.includes("not authorized") ||
      normalized.includes("authority required"),
  },
  {
    code: "IDEMPOTENCY_CONFLICT",
    match: ({ normalized, serverCode }) =>
      serverCode === "23505" ||
      normalized.includes("idempotency key reused with conflicting payload"),
  },
  {
    code: "LIFECYCLE_CONFLICT",
    match: ({ normalized, serverCode }) =>
      serverCode === "55000" || normalized.includes("lifecycle conflict"),
  },
  {
    code: "CHECKSUM_MISMATCH",
    match: ({ normalized }) => normalized.includes("content_checksum does not match"),
  },
  {
    code: "CATALOGUE_PROVENANCE_INVALID",
    match: ({ normalized }) =>
      normalized.includes("catalogue version") ||
      normalized.includes("source_catalogue_version_ids") ||
      normalized.includes("provenance"),
  },
  {
    code: "CANDIDATE_NOT_HANDOFF_READY",
    match: ({ normalized }) =>
      normalized.includes("only handoff_ready") ||
      normalized.includes("only publication_candidate") ||
      normalized.includes("not_handoff_ready"),
  },
  {
    code: "INVALID_KNOWLEDGE",
    match: ({ normalized, serverCode }) =>
      serverCode === "22023" ||
      normalized.includes("knowledge bundle") ||
      normalized.includes("forbidden transactional") ||
      normalized.includes("unknown top-level knowledge field"),
  },
  {
    code: "NETWORK_OR_RPC_FAILURE",
    match: ({ normalized, serverCode }) =>
      normalized.includes("fetch failed") ||
      normalized.includes("network") ||
      normalized.includes("failed to fetch") ||
      serverCode === "PGRST000",
  },
];

export function classifyKnowledgeSubmissionError(error: {
  message: string;
  code?: string | null;
}): KnowledgeSubmissionError {
  const message = error.message || "Unknown submission failure";
  const serverCode = error.code ?? null;
  const ctx: ErrorClassifierContext = {
    message,
    normalized: message.toLowerCase(),
    serverCode,
  };

  for (const rule of ERROR_CLASSIFIER_RULES) {
    if (rule.match(ctx)) {
      return { code: rule.code, message, serverCode };
    }
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

  const snapshot = parseKnowledgeSnapshotResponse(data, candidate.content_checksum);

  return {
    snapshot,
    idempotencyKey,
    replayed: options.replayed ?? false,
  };
}
