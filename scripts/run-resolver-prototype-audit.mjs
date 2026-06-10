#!/usr/bin/env node
/**
 * Read-only resolver prototype audit against Phase 1 anchor catalog fixture.
 * No DB writes. No order creation.
 */

import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// Inline minimal resolver for audit script (mirrors src/features/productResolver)
const FILLER = new Set(["need", "send", "want", "please", "order", "kg", "chahiye", "bhejo"]);

function normalizeUtterance(input) {
  let text = input.toLowerCase().replace(/[₹$,;:!?()[\]{}'"`]/g, " ").replace(/\b\d+(?:\.\d+)?\b/g, " ").replace(/\s+/g, " ").trim();
  return text.split(" ").filter((t) => t && !FILLER.has(t)).join(" ");
}

function tokenOverlapScore(query, target) {
  const q = query.trim();
  const t = target.trim();
  if (!q || !t) return 0;
  if (q === t) return 1;
  if (t.includes(q)) return 0.85 + (q.length / t.length) * 0.1;
  if (q.includes(t)) return 0.75 + (t.length / q.length) * 0.1;
  const qTokens = new Set(q.split(" ").filter(Boolean));
  const tTokens = t.split(" ").filter(Boolean);
  let overlap = 0;
  for (const tok of qTokens) {
    if (tTokens.some((tt) => tt === tok || tt.includes(tok) || tok.includes(tt))) overlap += 1;
  }
  return (overlap / qTokens.size) * 0.7;
}

const SKU_PATTERN = /^OAS-[A-Z0-9-]+$/i;

function resolveProduct(input, catalog, config = { min_threshold: 0.72, ambiguity_delta: 0.08, max_candidates: 3 }) {
  const raw = input.trim();
  const skuQuery = SKU_PATTERN.test(raw) ? raw.toLowerCase() : null;
  const normalized_text = skuQuery ?? normalizeUtterance(input);
  const candidateMap = new Map();
  const productById = new Map(catalog.products.map((p) => [p.id, p]));

  for (const product of catalog.products) {
    const sku = product.sku.toLowerCase();
    const name = product.name.toLowerCase();
    if (sku === normalized_text) candidateMap.set(product.id, { product_id: product.id, sku: product.sku, product_name: product.name, matched_term: product.sku, confidence: 1 });
    else if (sku.includes(normalized_text)) candidateMap.set(product.id, { product_id: product.id, sku: product.sku, product_name: product.name, matched_term: product.sku, confidence: 0.95 });
    const nameScore = tokenOverlapScore(normalized_text, name);
    if (nameScore > 0) {
      const cur = candidateMap.get(product.id);
      const next = { product_id: product.id, sku: product.sku, product_name: product.name, matched_term: product.name, confidence: Math.min(0.92, nameScore) };
      if (!cur || next.confidence > cur.confidence) candidateMap.set(product.id, next);
    }
  }

  for (const alias of catalog.aliases) {
    const product = productById.get(alias.product_id);
    if (!product) continue;
    const score = tokenOverlapScore(normalized_text, alias.alias_text.toLowerCase());
    if (score <= 0) continue;
    const cur = candidateMap.get(product.id);
    const next = { product_id: product.id, sku: product.sku, product_name: product.name, matched_term: alias.alias_text, confidence: Math.min(0.94, score) };
    if (!cur || next.confidence > cur.confidence) candidateMap.set(product.id, next);
  }

  const candidates = [...candidateMap.values()].sort((a, b) => b.confidence - a.confidence).slice(0, config.max_candidates);
  if (!candidates.length) return { input, normalized_text, clarification_required: true, matched_sku: null, confidence: 0, candidates: [] };

  const top = candidates[0];
  const second = candidates[1];
  const ambiguous = second && top.confidence - second.confidence < config.ambiguity_delta;
  const below = top.confidence < config.min_threshold;
  const clarification_required = ambiguous || below;

  return {
    input,
    normalized_text,
    matched_sku: clarification_required ? null : top.sku,
    matched_product: clarification_required ? null : top.product_name,
    confidence: top.confidence,
    clarification_required,
    candidates,
  };
}

const PRODUCT_IDS = {
  "OAS-AS-BKL-0013": "c5e84d04-0d8b-4466-8690-a7e6267b44a8",
  "OAS-AS-BKL-0014": "4af95ba1-ff0f-4740-8869-6a19a41e8c83",
  "OAS-AS-BKL-0020": "b0aee1c4-4502-4a15-9880-e2c01378c0b5",
  "OAS-AS-BKL-0024": "cea65af8-129c-4838-988f-30955fa5bc22",
};

const PRODUCTS = [
  { id: PRODUCT_IDS["OAS-AS-BKL-0013"], sku: "OAS-AS-BKL-0013", name: "Chocolate Cashew Asiyah" },
  { id: PRODUCT_IDS["OAS-AS-BKL-0014"], sku: "OAS-AS-BKL-0014", name: "Mor Cashew Asiyah" },
  { id: PRODUCT_IDS["OAS-AS-BKL-0020"], sku: "OAS-AS-BKL-0020", name: "Tart Cashew" },
  { id: PRODUCT_IDS["OAS-AS-BKL-0024"], sku: "OAS-AS-BKL-0024", name: "Mor Pistachio Durum" },
];

const payload = JSON.parse(readFileSync(join(ROOT, "data/product-language-preview/batch001_phase1_drafts_payload.json"), "utf8"));
const aliases = payload.map((d) => ({
  alias_text: d.payload.alias_text,
  canonical_name: d.payload.canonical_name,
  product_id: d.payload.product_id,
}));

const catalog = { products: PRODUCTS, aliases };

const TEST_CASES = [
  { utterance: "mor kaju asiyah", expectSku: "OAS-AS-BKL-0014", expectClarify: false },
  { utterance: "2 mor kaju asiyah chahiye", expectSku: "OAS-AS-BKL-0014", expectClarify: false },
  { utterance: "chocolate kaju asiyah", expectSku: "OAS-AS-BKL-0013", expectClarify: false },
  { utterance: "tart kaju", expectSku: "OAS-AS-BKL-0020", expectClarify: false },
  { utterance: "mor pistachio durum", expectSku: "OAS-AS-BKL-0024", expectClarify: false },
  { utterance: "OAS-AS-BKL-0020", expectSku: "OAS-AS-BKL-0020", expectClarify: false },
  { utterance: "cashew assiyah", expectSku: null, expectClarify: true },
  { utterance: "cashew high gap baklawa", expectSku: null, expectClarify: true },
  { utterance: "cashew box", expectSku: null, expectClarify: true },
  { utterance: "random sweet", expectSku: null, expectClarify: true },
];

let passed = 0;
const results = [];

for (const tc of TEST_CASES) {
  const res = resolveProduct(tc.utterance, catalog);
  const ok = res.clarification_required === tc.expectClarify && res.matched_sku === tc.expectSku;
  if (ok) passed += 1;
  results.push({ ...tc, ...res, pass: ok });
}

const score = Math.round((passed / TEST_CASES.length) * 100);
console.log(JSON.stringify({ passed, total: TEST_CASES.length, readiness_score: score, results }, null, 2));
