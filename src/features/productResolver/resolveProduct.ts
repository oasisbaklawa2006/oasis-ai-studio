import { normalizeUtterance } from "./normalizeUtterance";
import {
  DEFAULT_RESOLVER_CONFIG,
  type ProductResolverResult,
  type ResolverCandidate,
  type ResolverCatalog,
  type ResolverConfig,
} from "./types";

function tokenOverlapScore(query: string, target: string): number {
  const q = query.trim();
  const t = target.trim();
  if (!q || !t) return 0;
  if (q === t) return 1;
  if (t.includes(q)) return 0.85 + (q.length / t.length) * 0.1;
  if (q.includes(t)) return 0.75 + (t.length / q.length) * 0.1;

  const qTokens = new Set(q.split(" ").filter(Boolean));
  const tTokens = t.split(" ").filter(Boolean);
  if (!qTokens.size || !tTokens.length) return 0;

  let overlap = 0;
  for (const tok of qTokens) {
    if (tTokens.some((tt) => tt === tok || tt.includes(tok) || tok.includes(tt))) overlap += 1;
  }

  return (overlap / qTokens.size) * 0.7;
}

function considerCandidate(
  map: Map<string, ResolverCandidate>,
  candidate: ResolverCandidate,
) {
  const existing = map.get(candidate.product_id);
  if (!existing || candidate.confidence > existing.confidence) {
    map.set(candidate.product_id, candidate);
  }
}

/**
 * Read-only product resolver prototype for WhatsApp-style utterances.
 * Uses products.name, sku, approved aliases, and canonical_name only.
 */
const SKU_PATTERN = /^OAS-[A-Z0-9-]+$/i;

export function resolveProductFromCatalog(
  input: string,
  catalog: ResolverCatalog,
  config: ResolverConfig = DEFAULT_RESOLVER_CONFIG,
): ProductResolverResult {
  const raw = input.trim();
  const skuQuery = SKU_PATTERN.test(raw) ? raw.toLowerCase() : null;
  const normalized_text = skuQuery ?? normalizeUtterance(input);
  const candidateMap = new Map<string, ResolverCandidate>();

  if (!normalized_text) {
    return {
      input,
      normalized_text,
      matched_sku: null,
      matched_product: null,
      matched_product_id: null,
      confidence: 0,
      clarification_required: true,
      candidates: [],
    };
  }

  const productById = new Map(catalog.products.map((p) => [p.id, p]));

  for (const product of catalog.products) {
    const sku = product.sku.toLowerCase();
    const name = product.name.toLowerCase();

    if (sku === normalized_text) {
      considerCandidate(candidateMap, {
        product_id: product.id,
        sku: product.sku,
        product_name: product.name,
        matched_term: product.sku,
        match_source: "sku",
        confidence: 1,
      });
    } else if (sku.includes(normalized_text) || normalized_text.includes(sku)) {
      considerCandidate(candidateMap, {
        product_id: product.id,
        sku: product.sku,
        product_name: product.name,
        matched_term: product.sku,
        match_source: "sku",
        confidence: 0.95,
      });
    }

    const nameScore = tokenOverlapScore(normalized_text, name);
    if (nameScore > 0) {
      considerCandidate(candidateMap, {
        product_id: product.id,
        sku: product.sku,
        product_name: product.name,
        matched_term: product.name,
        match_source: "name",
        confidence: Math.min(0.92, nameScore),
      });
    }
  }

  for (const alias of catalog.aliases) {
    const aliasText = alias.alias_text.trim();
    if (!aliasText) continue;

    const product = productById.get(alias.product_id);
    if (!product) continue;

    const aliasScore = tokenOverlapScore(normalized_text, aliasText.toLowerCase());
    if (aliasScore <= 0) continue;

    considerCandidate(candidateMap, {
      product_id: product.id,
      sku: product.sku,
      product_name: product.name,
      matched_term: aliasText,
      match_source: "alias",
      confidence: Math.min(0.94, aliasScore),
    });

    const canonicalScore = tokenOverlapScore(normalized_text, alias.canonical_name.toLowerCase());
    if (canonicalScore > 0) {
      considerCandidate(candidateMap, {
        product_id: product.id,
        sku: product.sku,
        product_name: product.name,
        matched_term: alias.canonical_name,
        match_source: "canonical_name",
        confidence: Math.min(0.9, canonicalScore),
      });
    }
  }

  const candidates = Array.from(candidateMap.values())
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, config.max_candidates);

  if (!candidates.length) {
    return {
      input,
      normalized_text,
      matched_sku: null,
      matched_product: null,
      matched_product_id: null,
      confidence: 0,
      clarification_required: true,
      candidates: [],
    };
  }

  const top = candidates[0];
  const second = candidates[1];
  const ambiguous =
    second != null && top.confidence - second.confidence < config.ambiguity_delta;
  const belowThreshold = top.confidence < config.min_threshold;
  const clarification_required = ambiguous || belowThreshold;

  if (clarification_required) {
    return {
      input,
      normalized_text,
      matched_sku: null,
      matched_product: null,
      matched_product_id: null,
      confidence: top.confidence,
      clarification_required: true,
      candidates,
    };
  }

  return {
    input,
    normalized_text,
    matched_sku: top.sku,
    matched_product: top.product_name,
    matched_product_id: top.product_id,
    confidence: top.confidence,
    clarification_required: false,
    candidates,
  };
}
