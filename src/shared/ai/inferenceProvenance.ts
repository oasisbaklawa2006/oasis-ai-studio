/**
 * Point 26 — shared inference operation provenance contract.
 * Every AI Studio inference boundary must record provider/model/prompt identity where
 * operationally consumed, and fail closed when structured validation does not pass.
 */

export type InferenceProviderStatus = "ok" | "degraded" | "failed";

/** Canonical service identifiers for inference boundaries owned or consumed by AI Studio. */
export type InferenceServiceId =
  | "catalogue-ai-copy"
  | "oasis-ai-chat"
  | "generate-product-attributes"
  | "heuristic"
  | "tesseract-ocr"
  | "product-resolver-runtime";

export type InferenceOperationProvenance = {
  service: InferenceServiceId;
  provider?: string;
  model?: string;
  prompt_version?: string;
  provider_status: InferenceProviderStatus;
  human_review_required: boolean;
  suggestion_only: boolean;
  fail_closed: boolean;
  invoked_at: string;
  uncertainty_reason?: string;
};

export const CATALOGUE_AI_COPY_SERVICE: InferenceServiceId = "catalogue-ai-copy";
export const OASIS_AI_CHAT_SERVICE: InferenceServiceId = "oasis-ai-chat";
export const GENERATE_PRODUCT_ATTRIBUTES_SERVICE: InferenceServiceId =
  "generate-product-attributes";

/** Legacy persisted drafts used oasis-ai-chat before catalogue-ai-copy gateway landed. */
export const LEGACY_CATALOGUE_AI_SERVICE_MARKERS = [
  "oasis-ai-chat",
  "catalogue-ai-copy",
] as const;

export type LegacyCatalogueAiServiceMarker = (typeof LEGACY_CATALOGUE_AI_SERVICE_MARKERS)[number];

export function isLegacyCatalogueAiServiceMarker(
  value: unknown,
): value is LegacyCatalogueAiServiceMarker {
  return (
    typeof value === "string" &&
    (LEGACY_CATALOGUE_AI_SERVICE_MARKERS as readonly string[]).includes(value)
  );
}

export function normalizeCatalogueAiServiceMarker(value: unknown): InferenceServiceId {
  return isLegacyCatalogueAiServiceMarker(value) ? CATALOGUE_AI_COPY_SERVICE : CATALOGUE_AI_COPY_SERVICE;
}

export function extractInferenceProvenanceFromPayload(
  payload: unknown,
  defaults: {
    service: InferenceServiceId;
    provider_status?: InferenceProviderStatus;
    human_review_required?: boolean;
    suggestion_only?: boolean;
    fail_closed?: boolean;
  },
): InferenceOperationProvenance {
  const row =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};

  const provenanceBlock =
    row.provenance && typeof row.provenance === "object" && !Array.isArray(row.provenance)
      ? (row.provenance as Record<string, unknown>)
      : row;

  const provider_status =
    defaults.provider_status ??
    (provenanceBlock.provider_status === "ok" ||
    provenanceBlock.provider_status === "degraded" ||
    provenanceBlock.provider_status === "failed"
      ? provenanceBlock.provider_status
      : "ok");

  const human_review_required =
    defaults.human_review_required ?? row.human_review_required === true;

  const suggestion_only = defaults.suggestion_only ?? row.suggestion_only !== false;

  return {
    service: defaults.service,
    provider: readOptionalString(provenanceBlock.provider ?? row.provider),
    model: readOptionalString(provenanceBlock.model ?? row.model),
    prompt_version: readOptionalString(
      provenanceBlock.prompt_version ?? row.prompt_version ?? row.promptVersion,
    ),
    provider_status,
    human_review_required,
    suggestion_only,
    fail_closed: defaults.fail_closed ?? provider_status !== "ok",
    invoked_at: new Date().toISOString(),
    uncertainty_reason: readOptionalString(provenanceBlock.uncertainty_reason ?? row.uncertainty_reason),
  };
}

function readOptionalString(value: unknown): string | undefined {
  if (value == null) return undefined;
  const text = String(value).trim();
  return text.length > 0 ? text : undefined;
}

/** Fail closed when governed catalogue copy response lacks the human-review gate. */
export function isGovernedCatalogueCopyResponse(payload: unknown): boolean {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
  const row = payload as Record<string, unknown>;
  return row.ok === true && row.human_review_required === true;
}

/** Ensures operational provenance is present enough for audit closure checks. */
export function assertOperationalProvenanceComplete(
  provenance: InferenceOperationProvenance,
): { ok: true } | { ok: false; missing: string[] } {
  const missing: string[] = [];
  if (!provenance.service) missing.push("service");
  if (provenance.human_review_required !== true && provenance.service === CATALOGUE_AI_COPY_SERVICE) {
    missing.push("human_review_required");
  }
  if (provenance.suggestion_only !== true && provenance.service !== "product-resolver-runtime") {
    missing.push("suggestion_only");
  }
  return missing.length === 0 ? { ok: true } : { ok: false, missing };
}
