import { normalizeUtterance } from "../runtime/normalizeUtterance";
import { resolveProductUtterance } from "../runtime/resolveProductUtterance";
import type { RuntimeCatalog } from "../runtime/types";

export type KnowledgeWorkbenchResolution = {
  input: string;
  normalizedInput: string;
  aliasMatchText: string;
  resolutionStatus: "RESOLVED" | "AMBIGUOUS" | "UNRESOLVED" | "CLARIFICATION_REQUIRED";
  resolvedSku: string | null;
  resolvedName: string | null;
  candidates: Array<{
    sku: string;
    name: string;
    confidence: number;
    matchSource: string;
    matchedTerm: string;
  }>;
  matchMethod: string;
  whyMatched: string;
  whyFailed: string | null;
  packagingContext: string | null;
  familyContext: string | null;
  knowledgeChecksum: string;
};

const ACTION_LABEL: Record<string, string> = {
  auto_suggest: "Exact or high-confidence match",
  operator_review: "Needs operator review",
  ask_clarification: "Needs clarification",
};

export function resolveKnowledgeWorkbench(
  input: string,
  catalog: RuntimeCatalog,
  knowledgeChecksum: string,
): KnowledgeWorkbenchResolution {
  const normalized = normalizeUtterance(input);
  const result = resolveProductUtterance(input, catalog);
  const resolvedSku = result.resolved_sku;
  const resolvedProduct = resolvedSku
    ? catalog.products.find((product) => product.sku.trim() === resolvedSku)
    : null;

  let resolutionStatus: KnowledgeWorkbenchResolution["resolutionStatus"] = "UNRESOLVED";
  if (result.clarification_required) resolutionStatus = "CLARIFICATION_REQUIRED";
  else if (resolvedSku && result.alternatives.length > 1) resolutionStatus = "AMBIGUOUS";
  else if (resolvedSku) resolutionStatus = "RESOLVED";

  return {
    input,
    normalizedInput: normalized.normalized_text,
    aliasMatchText: normalized.alias_match_text,
    resolutionStatus,
    resolvedSku,
    resolvedName: result.resolved_name,
    candidates: result.alternatives.map((candidate) => ({
      sku: candidate.sku,
      name: candidate.product_name,
      confidence: candidate.confidence,
      matchSource: candidate.match_source,
      matchedTerm: candidate.matched_term,
    })),
    matchMethod: ACTION_LABEL[result.action] ?? result.action,
    whyMatched: resolvedSku ? result.reason : "No unique governed match",
    whyFailed: resolvedSku ? null : result.reason,
    packagingContext: resolvedProduct?.packaging_code?.trim() || null,
    familyContext:
      [resolvedProduct?.category, resolvedProduct?.subcategory].filter(Boolean).join(" / ") || null,
    knowledgeChecksum,
  };
}

export const KNOWLEDGE_WORKBENCH_EXAMPLES = [
  "Pista Bulbul",
  "pista bulbul",
  "Midya",
  "6 pc midya",
  "Kaju Tart",
  "Kunafa Cheese",
  "OAS-AS-BKL-CSH-BULK-0004",
  "cashew assiyah",
] as const;
