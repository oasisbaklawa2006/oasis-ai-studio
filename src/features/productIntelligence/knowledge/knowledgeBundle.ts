import { normalizeUtterance } from "../runtime/normalizeUtterance";
import type { RuntimeCatalog } from "../runtime/types";
import { sortDeterministicKeys, sortDeterministicStrings } from "./deterministicSort";

function sortedRecord<T>(entries: Iterable<[string, T]>): Record<string, T> {
  const out = Object.create(null) as Record<string, T>;
  for (const [key, value] of sortDeterministicKeys(entries)) {
    Object.defineProperty(out, key, {
      value,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return out;
}

export function normalizeKnowledgeTerm(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const normalized = normalizeUtterance(trimmed);
  const key = normalized.alias_match_text.trim() || normalized.normalized_text.trim();
  return key || null;
}

export async function knowledgeContentChecksum(
  knowledge: WhatsAppIntelligenceKnowledge,
): Promise<string> {
  const canonical = canonicalKnowledgePayload(knowledge);
  const encoded = new TextEncoder().encode(JSON.stringify(canonical));
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const WHATSAPP_KNOWLEDGE_SCHEMA_VERSION = "wa-knowledge/v1";

export type WhatsAppKnowledgeSku = {
  sku: string;
  name: string;
  family: string | null;
  variant: string | null;
  packaging_code: string | null;
};

export type WhatsAppKnowledgePackaging = {
  unit: string;
  notes: string;
  packaging_code: string;
};

export type WhatsAppIntelligenceKnowledge = {
  schema_version: typeof WHATSAPP_KNOWLEDGE_SCHEMA_VERSION;
  terminology: Record<string, string>;
  aliases: Record<string, string>;
  sku_map: Record<string, WhatsAppKnowledgeSku>;
  packaging: Record<string, WhatsAppKnowledgePackaging>;
  ambiguous_terms: string[];
  source_catalogue_version_ids: string[];
};

const FORBIDDEN_KNOWLEDGE_KEYS = [
  "customers",
  "customer_history",
  "orders",
  "inbound_messages",
  "whatsapp_messages",
  "conversation",
  "transaction_history",
  "payment",
  "credit",
  "sales_order",
];

export function assertNoTransactionalPayload(knowledge: WhatsAppIntelligenceKnowledge): void {
  const encoded = JSON.stringify(knowledge).toLowerCase();
  for (const key of FORBIDDEN_KNOWLEDGE_KEYS) {
    if (Object.hasOwn(knowledge, key)) {
      throw new Error(`KNOWLEDGE_TRANSACTION_FIELD_FORBIDDEN:${key}`);
    }
  }
  if (
    encoded.includes("whatsapp_inbound") ||
    encoded.includes("sales_order") ||
    encoded.includes("customer_id") ||
    encoded.includes("order_id")
  ) {
    throw new Error("KNOWLEDGE_TRANSACTION_FIELD_FORBIDDEN:runtime_context");
  }
}

function skuFamily(
  category: string | null | undefined,
  subcategory: string | null | undefined,
): string | null {
  const family = [category, subcategory]
    .filter((part) => typeof part === "string" && part.trim())
    .join(" / ");
  return family || null;
}

type TermOwnership = {
  skus: Set<string>;
  aliasClaimants: Set<string>;
};

function claimTerm(
  ownership: Map<string, TermOwnership>,
  term: string,
  sku: string,
  fromAlias: boolean,
): void {
  const normalized = normalizeKnowledgeTerm(term);
  if (!normalized) return;
  const bucket = ownership.get(normalized) ?? {
    skus: new Set<string>(),
    aliasClaimants: new Set<string>(),
  };
  bucket.skus.add(sku);
  if (fromAlias) bucket.aliasClaimants.add(sku);
  ownership.set(normalized, bucket);
}

export function buildWhatsAppIntelligenceKnowledge(
  catalog: RuntimeCatalog,
  sourceCatalogueVersionIds: string[] = [],
): WhatsAppIntelligenceKnowledge {
  const skuEntries = new Map<string, WhatsAppKnowledgeSku>();
  const packagingEntries = new Map<string, WhatsAppKnowledgePackaging>();
  const ownership = new Map<string, TermOwnership>();
  const productsById = new Map(catalog.products.map((product) => [product.id, product]));

  for (const product of catalog.products) {
    const sku = product.sku.trim();
    if (!sku) continue;
    const name = (product.product_name || product.name || sku).trim();
    skuEntries.set(sku, {
      sku,
      name,
      family: skuFamily(product.category, product.subcategory),
      variant: product.short_name?.trim() || null,
      packaging_code: product.packaging_code?.trim() || null,
    });
    claimTerm(ownership, sku, sku, false);
    claimTerm(ownership, name, sku, false);
    if (product.short_name?.trim()) claimTerm(ownership, product.short_name, sku, false);

    const packagingCode = product.packaging_code?.trim();
    if (packagingCode && !packagingEntries.has(packagingCode)) {
      packagingEntries.set(packagingCode, {
        unit: packagingCode.toLowerCase(),
        packaging_code: packagingCode,
        notes:
          "Reference packaging identifier from product master. Core governs commercial conversion; no quantity is encoded here.",
      });
    }
  }

  for (const alias of catalog.aliases) {
    const text = alias.alias_text.trim();
    if (!text) continue;
    const product = productsById.get(alias.product_id);
    const sku = product?.sku.trim();
    if (!sku) continue;
    claimTerm(ownership, text, sku, true);
    const canonicalName = alias.canonical_name.trim();
    if (canonicalName && canonicalName !== text) {
      claimTerm(ownership, canonicalName, sku, true);
    }
  }

  const terminologyEntries = new Map<string, string>();
  const aliasEntries = new Map<string, string>();
  const ambiguousTerms = new Set<string>();

  for (const [term, claim] of ownership) {
    if (claim.skus.size !== 1) {
      ambiguousTerms.add(term);
      continue;
    }
    const sku = Array.from(claim.skus)[0];
    if (!sku) continue;
    terminologyEntries.set(term, sku);
    if (claim.aliasClaimants.size > 0) aliasEntries.set(term, sku);
  }

  const knowledge: WhatsAppIntelligenceKnowledge = {
    schema_version: WHATSAPP_KNOWLEDGE_SCHEMA_VERSION,
    terminology: sortedRecord(terminologyEntries),
    aliases: sortedRecord(aliasEntries),
    sku_map: sortedRecord(skuEntries),
    packaging: sortedRecord(packagingEntries),
    ambiguous_terms: sortDeterministicStrings(ambiguousTerms),
    source_catalogue_version_ids: sortDeterministicStrings(
      new Set(sourceCatalogueVersionIds.filter(Boolean)),
    ),
  };
  assertNoTransactionalPayload(knowledge);
  return knowledge;
}

export function canonicalKnowledgePayload(
  knowledge: WhatsAppIntelligenceKnowledge,
): WhatsAppIntelligenceKnowledge {
  return {
    schema_version: knowledge.schema_version,
    terminology: sortedRecord(Object.entries(knowledge.terminology)),
    aliases: sortedRecord(Object.entries(knowledge.aliases)),
    sku_map: sortedRecord(Object.entries(knowledge.sku_map)),
    packaging: sortedRecord(Object.entries(knowledge.packaging)),
    ambiguous_terms: sortDeterministicStrings(knowledge.ambiguous_terms),
    source_catalogue_version_ids: sortDeterministicStrings(knowledge.source_catalogue_version_ids),
  };
}

/** Core table row shape for a DRAFT snapshot handoff (browser prepares only). */
export type CoreKnowledgeSnapshotDraftInsert = {
  schema_version: string;
  lifecycle: "DRAFT";
  source_catalogue_version_ids: string[];
  knowledge: WhatsAppIntelligenceKnowledge;
  content_checksum: string;
};

export function toCoreKnowledgeSnapshotDraftInsert(
  candidate: WhatsAppKnowledgePublicationCandidate,
): CoreKnowledgeSnapshotDraftInsert {
  return {
    schema_version: candidate.schema_version,
    lifecycle: "DRAFT",
    source_catalogue_version_ids: candidate.source_catalogue_version_ids,
    knowledge: candidate.knowledge,
    content_checksum: candidate.content_checksum,
  };
}

export type KnowledgeCandidateStatus = "PUBLICATION_CANDIDATE" | "TEST_CANDIDATE";

export type KnowledgeHandoffEligibility =
  | "HANDOFF_READY"
  | "NOT_HANDOFF_READY"
  | "NOT_HANDOFF_ELIGIBLE";

export type WhatsAppKnowledgePublicationCandidate = {
  candidate_status: KnowledgeCandidateStatus;
  handoff_eligibility: KnowledgeHandoffEligibility;
  lifecycle: "DRAFT";
  schema_version: string;
  source_catalogue_version_ids: string[];
  knowledge: WhatsAppIntelligenceKnowledge;
  content_checksum: string;
  generated_at: string;
  prepared_by: string | null;
  provenance_reason: string;
  source_summary: {
    mode: "live_catalogue" | "phase2a_fixture" | "production_fixture";
    product_count: number;
    alias_count: number;
    ambiguous_term_count: number;
  };
  golden_test_summary: {
    phase2a_passed: number;
    phase2a_total: number;
    production_passed: number;
    production_total: number;
  };
  core_review: "NOT_EXECUTED";
  core_approval: "NOT_EXECUTED";
  core_activation: "NOT_EXECUTED";
};

export type BuildKnowledgePublicationCandidateInput = {
  knowledge: WhatsAppIntelligenceKnowledge;
  sourceSummary: WhatsAppKnowledgePublicationCandidate["source_summary"];
  goldenSummary: WhatsAppKnowledgePublicationCandidate["golden_test_summary"];
  preparedBy?: string | null;
  candidateStatus: KnowledgeCandidateStatus;
  handoffEligibility: KnowledgeHandoffEligibility;
  provenanceReason: string;
};

export async function buildKnowledgePublicationCandidate(
  input: BuildKnowledgePublicationCandidateInput,
): Promise<WhatsAppKnowledgePublicationCandidate> {
  assertNoTransactionalPayload(input.knowledge);
  const canonical = canonicalKnowledgePayload(input.knowledge);
  return {
    candidate_status: input.candidateStatus,
    handoff_eligibility: input.handoffEligibility,
    lifecycle: "DRAFT",
    schema_version: canonical.schema_version,
    source_catalogue_version_ids: canonical.source_catalogue_version_ids,
    knowledge: canonical,
    content_checksum: await knowledgeContentChecksum(canonical),
    generated_at: new Date().toISOString(),
    prepared_by: input.preparedBy ?? null,
    provenance_reason: input.provenanceReason,
    source_summary: input.sourceSummary,
    golden_test_summary: input.goldenSummary,
    core_review: "NOT_EXECUTED",
    core_approval: "NOT_EXECUTED",
    core_activation: "NOT_EXECUTED",
  };
}
