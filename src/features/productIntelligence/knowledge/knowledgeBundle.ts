import type { RuntimeCatalog } from "../runtime/types";

export async function knowledgeContentChecksum(
  knowledge: WhatsAppIntelligenceKnowledge,
): Promise<string> {
  const encoded = new TextEncoder().encode(JSON.stringify(knowledge));
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const WHATSAPP_KNOWLEDGE_SCHEMA_VERSION = "wa-knowledge/v1";

export type WhatsAppKnowledgeSku = {
  sku: string;
  name: string;
  family: string | null;
  variant: string | null;
};

export type WhatsAppIntelligenceKnowledge = {
  schema_version: typeof WHATSAPP_KNOWLEDGE_SCHEMA_VERSION;
  terminology: Record<string, string>;
  aliases: Record<string, string>;
  sku_map: Record<string, WhatsAppKnowledgeSku>;
  packaging: Record<string, { unit: string; notes: string }>;
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
];

export function assertNoTransactionalPayload(knowledge: WhatsAppIntelligenceKnowledge): void {
  const encoded = JSON.stringify(knowledge).toLowerCase();
  for (const key of FORBIDDEN_KNOWLEDGE_KEYS) {
    if (Object.hasOwn(knowledge, key)) {
      throw new Error(`KNOWLEDGE_TRANSACTION_FIELD_FORBIDDEN:${key}`);
    }
  }
  if (encoded.includes("whatsapp_inbound") || encoded.includes("sales_order")) {
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

export function buildWhatsAppIntelligenceKnowledge(
  catalog: RuntimeCatalog,
  sourceCatalogueVersionIds: string[] = [],
): WhatsAppIntelligenceKnowledge {
  const sku_map: Record<string, WhatsAppKnowledgeSku> = Object.create(null);
  const terminology: Record<string, string> = Object.create(null);
  const aliases: Record<string, string> = Object.create(null);
  const nameToSkus = new Map<string, Set<string>>();
  const productsById = new Map(catalog.products.map((product) => [product.id, product]));

  for (const product of catalog.products) {
    const sku = product.sku.trim();
    if (!sku) continue;
    const name = (product.product_name || product.name || sku).trim();
    sku_map[sku] = {
      sku,
      name,
      family: skuFamily(product.category, product.subcategory),
      variant: product.short_name,
    };
    terminology[name.toLowerCase()] = sku;
    if (product.short_name?.trim()) terminology[product.short_name.trim().toLowerCase()] = sku;
    const nameKey = name.toLowerCase();
    const bucket = nameToSkus.get(nameKey) ?? new Set<string>();
    bucket.add(sku);
    nameToSkus.set(nameKey, bucket);
  }

  for (const alias of catalog.aliases) {
    const text = alias.alias_text.trim().toLowerCase();
    if (!text) continue;
    const product = productsById.get(alias.product_id);
    if (!product?.sku) continue;
    aliases[text] = product.sku;
    terminology[text] = product.sku;
  }

  const ambiguous_terms = [...nameToSkus.entries()]
    .filter(([, skus]) => skus.size > 1)
    .map(([term]) => term)
    .sort();

  const knowledge: WhatsAppIntelligenceKnowledge = {
    schema_version: WHATSAPP_KNOWLEDGE_SCHEMA_VERSION,
    terminology,
    aliases,
    sku_map,
    packaging: {
      carton: {
        unit: "carton",
        notes: "Governed conversion must come from Core packaging master, not this snapshot.",
      },
      box: { unit: "box", notes: "Ambiguous unless uniquely mapped in Core packaging master." },
    },
    ambiguous_terms,
    source_catalogue_version_ids: [...new Set(sourceCatalogueVersionIds.filter(Boolean))].sort(),
  };
  assertNoTransactionalPayload(knowledge);
  return knowledge;
}

export type WhatsAppKnowledgePublicationPreview = {
  lifecycle: "DRAFT" | "APPROVED";
  schema_version: string;
  content_checksum: string;
  knowledge: WhatsAppIntelligenceKnowledge;
  core_activation: "NOT_EXECUTED";
};

export async function previewApprovedKnowledgePublication(
  knowledge: WhatsAppIntelligenceKnowledge,
): Promise<WhatsAppKnowledgePublicationPreview> {
  assertNoTransactionalPayload(knowledge);
  return {
    lifecycle: "APPROVED",
    schema_version: knowledge.schema_version,
    content_checksum: await knowledgeContentChecksum(knowledge),
    knowledge,
    core_activation: "NOT_EXECUTED",
  };
}
