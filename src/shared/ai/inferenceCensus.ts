/**
 * Point 26 — durable machine-readable census of AI/LLM inference boundaries
 * owned or consumed by AI Studio. Used by certification scripts and audit evidence.
 *
 * Separates Point 26 audit/governance from Point 30 extraction (governedAiExtraction/*)
 * and later product workflow features (Points 27–40).
 */

import type { InferenceServiceId } from "./inferenceProvenance";

export type InferenceBoundaryKind = "llm" | "heuristic" | "deterministic";

export type InferenceBoundaryRecord = {
  id: string;
  service: InferenceServiceId | "template-generator";
  kind: InferenceBoundaryKind;
  programme_scope: "point26-audit" | "point30-extraction" | "out-of-scope";
  owner_repo: "ai-studio-client" | "central-edge-deployed" | "ai-studio-edge-legacy";
  edge_function?: string;
  client_module: string;
  structured_output: boolean;
  validation_before_use: boolean;
  fail_closed_on_malformed: boolean;
  human_review_gate: boolean;
  can_mutate_canonical_without_approval: boolean;
  records_provenance: boolean;
  production_vs_test: string;
  retry_timeout_owner: string;
  pii_secrets_handling: string;
  notes: string;
};

/** Current AI Studio main SHA — update on each Point 26 census refresh. */
export const POINT26_CENSUS_BASELINE_SHA = "6f8e16417dcef2323d833072d23a92a32b87a833";

export const AI_INFERENCE_BOUNDARY_CENSUS: readonly InferenceBoundaryRecord[] = [
  {
    id: "catalogue-copy-llm",
    service: "catalogue-ai-copy",
    kind: "llm",
    programme_scope: "point26-audit",
    owner_repo: "central-edge-deployed",
    edge_function: "catalogue-ai-copy",
    client_module: "src/features/catalogueAiStudio/catalogueAiGateway.ts",
    structured_output: true,
    validation_before_use: true,
    fail_closed_on_malformed: true,
    human_review_gate: true,
    can_mutate_canonical_without_approval: false,
    records_provenance: true,
    production_vs_test:
      "Production edge fn on tcxvcatsqqertcnycuop; client gated by VITE_CATALOGUE_AI_ENABLED=true",
    retry_timeout_owner: "Edge function (Point 24); client never retries or falls back to oasis-ai-chat",
    pii_secrets_handling: "Staff JWT required; OPENAI_API_KEY server-side only; no secrets in client",
    notes:
      "Dedicated catalogue copy contract. Gateway refuses oasis-ai-chat fallback. validateAiCatalogueContent before editor state.",
  },
  {
    id: "alias-suggestion-llm",
    service: "oasis-ai-chat",
    kind: "llm",
    programme_scope: "point30-extraction",
    owner_repo: "central-edge-deployed",
    edge_function: "oasis-ai-chat",
    client_module: "src/features/governedAiExtraction/fastCreateEnrichment.ts",
    structured_output: false,
    validation_before_use: true,
    fail_closed_on_malformed: true,
    human_review_gate: true,
    can_mutate_canonical_without_approval: false,
    records_provenance: true,
    production_vs_test:
      "Streaming chat proxy; Fast Create alias path uses anon key + 15s AbortSignal.timeout",
    retry_timeout_owner: "Client single attempt; fail_closed provenance on HTTP/parse failure",
    pii_secrets_handling: "Product name/category only in prompt; aliases land in pendingAiAliases",
    notes:
      "Point 30 governed extraction. sanitizeAiFragments + extractGovernedAliases fail closed. Not used by catalogue gateway.",
  },
  {
    id: "compliance-heuristic-edge",
    service: "generate-product-attributes",
    kind: "heuristic",
    programme_scope: "point30-extraction",
    owner_repo: "ai-studio-edge-legacy",
    edge_function: "generate-product-attributes",
    client_module: "src/shared/ai/complianceSuggestions.ts",
    structured_output: true,
    validation_before_use: true,
    fail_closed_on_malformed: true,
    human_review_gate: true,
    can_mutate_canonical_without_approval: false,
    records_provenance: true,
    production_vs_test:
      "Repo edge fn is heuristic placeholder until model provider configured; same contract as Central",
    retry_timeout_owner: "supabase.functions.invoke single call; heuristic fallback on invalid shape",
    pii_secrets_handling: "product_name/category only; suggestion_only + approved:false enforced client-side",
    notes:
      "ComplianceAiPanel + Fast Create enrichment. prepareFormForComplianceSave strips unapproved fields on save.",
  },
  {
    id: "compliance-heuristic-client",
    service: "heuristic",
    kind: "heuristic",
    programme_scope: "point30-extraction",
    owner_repo: "ai-studio-client",
    client_module: "src/shared/ai/complianceSuggestions.ts",
    structured_output: true,
    validation_before_use: true,
    fail_closed_on_malformed: true,
    human_review_gate: true,
    can_mutate_canonical_without_approval: false,
    records_provenance: true,
    production_vs_test: "Deterministic client fallback when edge unavailable or response non-governed",
    retry_timeout_owner: "Client-owned fallback in extractGovernedCompliance",
    pii_secrets_handling: "Category/name pattern match only",
    notes: "Never marks approved:true. Used when edge returns invalid shape or transport error.",
  },
  {
    id: "catalogue-template-generator",
    service: "template-generator",
    kind: "deterministic",
    programme_scope: "out-of-scope",
    owner_repo: "ai-studio-client",
    client_module: "src/features/catalogueAiStudio/catalogueContentGenerators.ts",
    structured_output: true,
    validation_before_use: true,
    fail_closed_on_malformed: true,
    human_review_gate: true,
    can_mutate_canonical_without_approval: false,
    records_provenance: false,
    production_vs_test: "Pure template functions; no provider call",
    retry_timeout_owner: "N/A",
    pii_secrets_handling: "Uses existing product fields only",
    notes: "Not LLM inference. Listed for census completeness; excluded from Point 26 provider audit.",
  },
  {
    id: "ocr-tesseract",
    service: "tesseract-ocr",
    kind: "deterministic",
    programme_scope: "out-of-scope",
    owner_repo: "ai-studio-client",
    client_module: "src/features/fastCreate/intake/ocrTesseractRuntime.ts",
    structured_output: true,
    validation_before_use: true,
    fail_closed_on_malformed: true,
    human_review_gate: true,
    can_mutate_canonical_without_approval: false,
    records_provenance: false,
    production_vs_test: "Client-side Tesseract WASM; Point 29 multimodal intake",
    retry_timeout_owner: "Client intake module",
    pii_secrets_handling: "Local pixel extract only",
    notes: "OCR not LLM. Out of Point 26 scope per programme matrix.",
  },
  {
    id: "product-resolver-runtime",
    service: "product-resolver-runtime",
    kind: "deterministic",
    programme_scope: "out-of-scope",
    owner_repo: "ai-studio-client",
    client_module: "supabase/functions/_shared/runtime/resolveProductUtterance.ts",
    structured_output: true,
    validation_before_use: true,
    fail_closed_on_malformed: true,
    human_review_gate: true,
    can_mutate_canonical_without_approval: false,
    records_provenance: true,
    production_vs_test: "Lexicon/scoring runtime at edge ingest; confidence bands not LLM",
    retry_timeout_owner: "Edge resolver module",
    pii_secrets_handling: "Utterance text only; operator confirmation required for drafts",
    notes: "Deterministic resolver with confidence bands. Not an LLM boundary.",
  },
] as const;

export type ShadowInferenceRisk = {
  id: string;
  severity: "high" | "medium" | "low" | "resolved";
  description: string;
  mitigation: string;
};

/** Known shadow/unaudited paths and their closure state as of POINT26_CENSUS_BASELINE_SHA. */
export const SHADOW_INFERENCE_RISKS: readonly ShadowInferenceRisk[] = [
  {
    id: "catalogue-gateway-no-oasis-fallback",
    severity: "resolved",
    description:
      "catalogueAiGateway previously could have fallen back to general oasis-ai-chat B2B prompt.",
    mitigation: "Gateway calls catalogue-ai-copy only; explicit comment + no fallback code path.",
  },
  {
    id: "alias-stream-json-leak",
    severity: "resolved",
    description: "Raw SSE JSON chunks could enter alias lists when split naively on commas.",
    mitigation: "aiOutputSanitizer.sanitizeAiFragments + extractGovernedAliases fail closed.",
  },
  {
    id: "catalogue-provenance-service-marker",
    severity: "resolved",
    description:
      "Persisted ai_generation.service was hardcoded oasis-ai-chat while gateway uses catalogue-ai-copy.",
    mitigation:
      "catalogueAiGenerationMerge accepts both legacy and canonical service markers; new saves use catalogue-ai-copy.",
  },
  {
    id: "compliance-panel-unmounted",
    severity: "medium",
    description: "ComplianceAiPanel exists but may not be mounted on ProductEdit in all builds.",
    mitigation: "Panel wired via governed extraction contract; mounting tracked separately from Point 26 audit census.",
  },
  {
    id: "edge-fn-not-in-repo",
    severity: "low",
    description: "catalogue-ai-copy and oasis-ai-chat edge functions deploy from Central/backend repo.",
    mitigation:
      "Client census + smoke/cert scripts document contracts; no AI Studio edge deploy from this repo.",
  },
  {
    id: "generate-product-attributes-no-live-llm",
    severity: "low",
    description: "In-repo edge fn is heuristic-only until provider configured in deployment target.",
    mitigation:
      "Client enforces suggestion_only/approved:false regardless of provider; fail-closed parse + heuristic fallback.",
  },
];

export function getPoint26AuditBoundaries(): InferenceBoundaryRecord[] {
  return AI_INFERENCE_BOUNDARY_CENSUS.filter((b) => b.programme_scope === "point26-audit");
}

export function getLlmBoundaries(): InferenceBoundaryRecord[] {
  return AI_INFERENCE_BOUNDARY_CENSUS.filter((b) => b.kind === "llm");
}

export function getBoundaryByService(
  service: InferenceServiceId | "template-generator",
): InferenceBoundaryRecord | undefined {
  return AI_INFERENCE_BOUNDARY_CENSUS.find((b) => b.service === service);
}

export function summarizeCensusForAudit(): {
  baseline_sha: string;
  total_boundaries: number;
  llm_boundaries: number;
  point26_boundaries: number;
  point30_boundaries: number;
  shadow_risks_open: number;
  all_llm_fail_closed: boolean;
  all_llm_human_review: boolean;
} {
  const llm = getLlmBoundaries();
  return {
    baseline_sha: POINT26_CENSUS_BASELINE_SHA,
    total_boundaries: AI_INFERENCE_BOUNDARY_CENSUS.length,
    llm_boundaries: llm.length,
    point26_boundaries: getPoint26AuditBoundaries().length,
    point30_boundaries: AI_INFERENCE_BOUNDARY_CENSUS.filter((b) => b.programme_scope === "point30-extraction")
      .length,
    shadow_risks_open: SHADOW_INFERENCE_RISKS.filter((r) => r.severity !== "resolved").length,
    all_llm_fail_closed: llm.every((b) => b.fail_closed_on_malformed),
    all_llm_human_review: llm.every((b) => b.human_review_gate),
  };
}
