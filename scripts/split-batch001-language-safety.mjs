#!/usr/bin/env node
/**
 * Split Batch 001 language preview into safe-to-draft vs review-only.
 * Preview only — no DB writes, drafts, or imports.
 */

import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PREVIEW_DIR = join(ROOT, "data/product-language-preview");

const BARE_TOKENS = new Set([
  "pyramid",
  "pistachio",
  "pista",
  "baklava",
  "baklawa",
  "cashew",
  "kaju",
  "asiyah",
  "assiyah",
  "durum",
  "boukaj",
  "bokaj",
  "ring",
  "tart",
  "kitta",
  "square",
  "mor",
  "chocolate",
  "almond",
  "badam",
  "date",
  "coconut",
  "nariyal",
  "durum",
  "lebanese",
  "turkish",
]);

const CROSS_SKU_CLUSTERS = {
  pyramid: ["OAS-AS-BKL-0006", "OAS-AS-BKL-0011", "OAS-AS-BKL-0019"],
  boukaj: ["OAS-AS-BKL-0006", "OAS-AS-BKL-0011", "OAS-AS-BKL-0019"],
  asiyah: [
    "OAS-AS-BKL-0012",
    "OAS-AS-BKL-0013",
    "OAS-AS-BKL-0014",
    "OAS-AS-BKL-0015",
    "OAS-AS-BKL-0016",
    "OAS-AS-BKL-0017",
  ],
  kitta: ["OAS-AS-BKL-0001"],
  durum: ["OAS-AS-BKL-0024", "OAS-AS-BKL-0025"],
};

const MIN_SAFE = {
  official_alias: 2,
  customer_term: 3,
  whatsapp_keyword: 5,
  search_keyword: 2,
};

function parseCsv(text) {
  const lines = text.trim().split("\n");
  const header = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    return Object.fromEntries(header.map((h, i) => [h, cols[i] ?? ""]));
  });
}

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function escapeCsv(v) {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function normalizeTerm(t) {
  return t.trim().toLowerCase().replace(/\s+/g, " ");
}

function significantTokens(officialName) {
  return officialName
    .toLowerCase()
    .replace(/[()]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !["the", "and"].includes(t));
}

function isBareToken(term) {
  const n = normalizeTerm(term);
  if (BARE_TOKENS.has(n)) return true;
  const stripped = n.replace(/^(need|send)\s+/, "").replace(/\s+kg$/, "");
  if (BARE_TOKENS.has(stripped)) return true;
  return false;
}

function hasSkuContext(term, officialName, sku) {
  const n = normalizeTerm(term);
  const nameLower = officialName.toLowerCase();

  if (n.includes(nameLower) || nameLower.includes(n)) return true;

  const tokens = significantTokens(officialName);
  const matched = tokens.filter((tok) => n.includes(tok));
  if (matched.length >= 2) return true;

  if (officialName.includes("(Topping)") && /topping/i.test(term)) return true;
  if (/mor/i.test(officialName) && /mor|beetroot|purple/i.test(term)) return true;
  if (/chocolate/i.test(officialName) && /chocolate|choco/i.test(term)) return true;
  if (/cashew|kaju/i.test(officialName) && /cashew|kaju/i.test(term)) return true;
  if (/pistachio|pista/i.test(officialName) && /pistachio|pista/i.test(term)) return true;
  if (/durum|roll/i.test(officialName) && /durum|roll/i.test(term)) return true;
  if (/kitta|diamond/i.test(officialName) && /kitta|diamond/i.test(term)) return true;
  if (/pyramid|boukaj/i.test(officialName) && /pyramid|boukaj/i.test(term)) return true;
  if (/asiyah|assiyah|high jump|high gap/i.test(officialName) && /asiyah|assiyah|high jump|high gap/i.test(term)) return true;
  if (/ring/i.test(officialName) && /ring/i.test(term)) return true;
  if (/tart|katori/i.test(officialName) && /tart|katori/i.test(term)) return true;
  if (/square/i.test(officialName) && /square/i.test(term)) return true;
  if (/date|khajur|khajoor/i.test(officialName) && /date|khajur|khajoor/i.test(term)) return true;
  if (/coconut|nariyal/i.test(officialName) && /coconut|nariyal/i.test(term)) return true;
  if (/almond|badam|crosole/i.test(officialName) && /almond|badam|crosole/i.test(term)) return true;
  if (/finger|asabi|asabeh/i.test(officialName) && /finger|asabi|asabeh/i.test(term)) return true;
  if (/rosebud/i.test(officialName) && /rosebud|rose/i.test(term)) return true;
  if (/mix nut/i.test(officialName) && /mix nut/i.test(term)) return true;

  if (n.includes(sku.toLowerCase())) return true;

  return false;
}

function matchesCrossSkuCluster(term) {
  const n = normalizeTerm(term);
  for (const [cluster, skus] of Object.entries(CROSS_SKU_CLUSTERS)) {
    if (n === cluster || n.endsWith(` ${cluster}`) || n.startsWith(`${cluster} `)) {
      if (skus.length > 1) return { cluster, skus };
    }
    if (cluster === "boukaj" && /\bboukaj\b|\bbokaj\b/.test(n) && !/cashew|kaju|pistachio|pista/i.test(n)) {
      return { cluster: "boukaj", skus };
    }
    if (cluster === "asiyah" && /\basiyah\b|\bassiyah\b/.test(n) && !/chocolate|mor|cashew|kaju|pistachio|pista/i.test(n)) {
      return { cluster: "asiyah", skus };
    }
    if (cluster === "pyramid" && /\bpyramid\b/.test(n) && !/cashew|kaju|pistachio|pista|topping/i.test(n)) {
      return { cluster: "pyramid", skus };
    }
  }
  return null;
}

function recommendedClarification(row, reason) {
  if (row.clarification_question?.trim()) return row.clarification_question.trim();
  if (reason.includes("bare")) {
    return `Customer said "${row.term_text}" — which ${row.official_name}? Reply with SKU ${row.sku} or full product name.`;
  }
  if (reason.includes("cross-sku")) {
    return `Ambiguous phrase "${row.term_text}" may match multiple Batch 001 products. Ask: cashew or pistachio? plain, chocolate, or mor? topping or plain pyramid?`;
  }
  return `Clarify intent for "${row.term_text}" before mapping to ${row.sku} (${row.official_name}).`;
}

function classifyRow(row, termSkuIndex) {
  const termKey = normalizeTerm(row.term_text);
  const skusForTerm = termSkuIndex.get(termKey) ?? new Set();

  if (row.conflict_risk === "HIGH") {
    return {
      bucket: "REVIEW_ONLY",
      reason: "conflict_risk=HIGH",
      clarification: recommendedClarification(row, "high"),
    };
  }

  if (isBareToken(row.term_text)) {
    return {
      bucket: "REVIEW_ONLY",
      reason: "bare family/shape/filling token",
      clarification: recommendedClarification(row, "bare"),
    };
  }

  const cluster = matchesCrossSkuCluster(row.term_text);
  if (cluster && cluster.skus.length > 1 && !hasSkuContext(row.term_text, row.official_name, row.sku)) {
    return {
      bucket: "REVIEW_ONLY",
      reason: `cross-sku cluster: ${cluster.cluster} (${cluster.skus.join(", ")})`,
      clarification: recommendedClarification(row, "cross-sku"),
    };
  }

  if (skusForTerm.size > 1) {
    const sameTextSkus = [...skusForTerm];
    if (!hasSkuContext(row.term_text, row.official_name, row.sku)) {
      return {
        bucket: "REVIEW_ONLY",
        reason: `term_text appears on ${skusForTerm.size} SKUs: ${sameTextSkus.join(", ")}`,
        clarification: recommendedClarification(row, "cross-sku"),
      };
    }
  }

  if (!hasSkuContext(row.term_text, row.official_name, row.sku)) {
    if (row.conflict_risk === "MEDIUM") {
      return {
        bucket: "REVIEW_ONLY",
        reason: "MEDIUM risk without sufficient SKU-specific context",
        clarification: recommendedClarification(row, "medium"),
      };
    }
    return {
      bucket: "REVIEW_ONLY",
      reason: "insufficient context to identify single SKU",
      clarification: recommendedClarification(row, "context"),
    };
  }

  if (row.conflict_risk === "LOW" || row.conflict_risk === "MEDIUM") {
    return { bucket: "SAFE_TO_DRAFT", reason: "sufficient SKU context", clarification: "" };
  }

  return {
    bucket: "REVIEW_ONLY",
    reason: `unclassified risk: ${row.conflict_risk}`,
    clarification: recommendedClarification(row, "unknown"),
  };
}

function writeCsv(path, rows, extraCols) {
  const base = [
    "sku",
    "official_name",
    "category",
    "hsn",
    "term_type",
    "term_text",
    "language",
    "script",
    "conflict_risk",
    "safety_bucket",
    ...extraCols,
  ];
  const lines = [base.join(",")];
  for (const r of rows) {
    lines.push(base.map((h) => escapeCsv(r[h])).join(","));
  }
  writeFileSync(path, lines.join("\n") + "\n");
}

function main() {
  const inputPath = join(PREVIEW_DIR, "batch001_language_terms_preview.csv");
  const rows = parseCsv(readFileSync(inputPath, "utf8"));

  const termSkuIndex = new Map();
  for (const row of rows) {
    const key = normalizeTerm(row.term_text);
    if (!termSkuIndex.has(key)) termSkuIndex.set(key, new Set());
    termSkuIndex.get(key).add(row.sku);
  }

  const safe = [];
  const review = [];

  for (const row of rows) {
    const { bucket, reason, clarification } = classifyRow(row, termSkuIndex);
    const enriched = {
      ...row,
      safety_bucket: bucket,
      safety_reason: reason,
      recommended_clarification: clarification,
    };
    if (bucket === "SAFE_TO_DRAFT") safe.push(enriched);
    else review.push(enriched);
  }

  writeCsv(join(PREVIEW_DIR, "batch001_language_terms_safe_to_draft.csv"), safe, [
    "safety_reason",
  ]);
  writeCsv(join(PREVIEW_DIR, "batch001_language_terms_review_only.csv"), review, [
    "safety_reason",
    "recommended_clarification",
  ]);

  const bySkuSafe = {};
  const bySkuReview = {};
  for (const r of safe) {
    bySkuSafe[r.sku] ??= {};
    bySkuSafe[r.sku][r.term_type] = (bySkuSafe[r.sku][r.term_type] ?? 0) + 1;
  }
  for (const r of review) {
    bySkuReview[r.sku] ??= {};
    bySkuReview[r.sku][r.term_type] = (bySkuReview[r.sku][r.term_type] ?? 0) + 1;
  }

  const insufficient = [];
  const allSkus = [...new Set(rows.map((r) => r.sku))].sort();
  for (const sku of allSkus) {
    const counts = bySkuSafe[sku] ?? {};
    const gaps = [];
    for (const [type, min] of Object.entries(MIN_SAFE)) {
      if ((counts[type] ?? 0) < min) gaps.push(`${type}: ${counts[type] ?? 0}/${min}`);
    }
    if (gaps.length) {
      insufficient.push({
        sku,
        official_name: rows.find((r) => r.sku === sku)?.official_name ?? "",
        gaps,
        safe_total: Object.values(counts).reduce((a, b) => a + b, 0),
      });
    }
  }

  const clusterCounts = {};
  for (const r of review) {
    const c = matchesCrossSkuCluster(r.term_text);
    const key = c?.cluster ?? r.safety_reason.split(":")[0];
    clusterCounts[key] = (clusterCounts[key] ?? 0) + 1;
  }

  const draftReadySkus = allSkus.filter((sku) => !insufficient.find((i) => i.sku === sku));
  const firstBatch = draftReadySkus.slice(0, 10);
  const firstBatchTermCount = firstBatch.reduce(
    (n, sku) => n + safe.filter((r) => r.sku === sku).length,
    0,
  );

  const md = [];
  md.push("# Batch 001 Language Safety Split — Preview Only\n");
  md.push("**Status:** Review split — not draftable until human sign-off per row.\n");
  md.push(`**Source:** \`batch001_language_terms_preview.csv\` (${rows.length} rows)\n`);
  md.push("## Split summary\n");
  md.push("| Bucket | Count | % |");
  md.push("|--------|-------|---|");
  md.push(`| SAFE_TO_DRAFT | ${safe.length} | ${Math.round((safe.length / rows.length) * 100)}% |`);
  md.push(`| REVIEW_ONLY | ${review.length} | ${Math.round((review.length / rows.length) * 100)}% |`);
  md.push(`| **Total** | **${rows.length}** | 100% |\n`);

  md.push("## By term type (safe vs review)\n");
  md.push("| term_type | safe | review |");
  md.push("|-----------|------|--------|");
  for (const t of [
    "official_alias",
    "customer_term",
    "whatsapp_keyword",
    "regional_term",
    "search_keyword",
  ]) {
    md.push(
      `| ${t} | ${safe.filter((r) => r.term_type === t).length} | ${review.filter((r) => r.term_type === t).length} |`,
    );
  }
  md.push("");

  md.push("## HIGH-risk clusters (review-only)\n");
  const sortedClusters = Object.entries(clusterCounts).sort((a, b) => b[1] - a[1]);
  for (const [cluster, count] of sortedClusters.slice(0, 12)) {
    md.push(`- **${cluster}**: ${count} terms`);
  }
  md.push("");

  md.push("## Cross-SKU disambiguation families\n");
  for (const [cluster, skus] of Object.entries(CROSS_SKU_CLUSTERS)) {
    if (skus.length > 1) md.push(`- **${cluster}**: ${skus.join(", ")}`);
  }
  md.push("");

  md.push("## Products with insufficient safe terms\n");
  md.push(
    `Minimum safe per SKU: ${Object.entries(MIN_SAFE)
      .map(([k, v]) => `${k}≥${v}`)
      .join(", ")}\n`,
  );
  if (insufficient.length === 0) {
    md.push("All 25 SKUs meet minimum safe term counts.\n");
  } else {
    md.push(`**${insufficient.length}** SKUs below minimum:\n`);
    for (const i of insufficient.sort((a, b) => a.safe_total - b.safe_total)) {
      md.push(`- **${i.sku}** (${i.official_name}) — safe total ${i.safe_total}: ${i.gaps.join("; ")}`);
    }
    md.push("");
  }

  md.push("## Recommended first alias draft batch\n");
  md.push(`**Size:** ${firstBatchTermCount} terms across **${firstBatch.length} SKUs**\n`);
  md.push("Anchor SKUs with full safe minimums (first 10 in cohort order):\n");
  for (const sku of firstBatch) {
    const name = rows.find((r) => r.sku === sku)?.official_name;
    const count = safe.filter((r) => r.sku === sku).length;
    md.push(`- ${sku} — ${name} (${count} safe terms)`);
  }
  const aliasWaRank = allSkus
    .map((sku) => ({
      sku,
      name: rows.find((r) => r.sku === sku)?.official_name ?? "",
      oa: safe.filter((r) => r.sku === sku && r.term_type === "official_alias").length,
      wa: safe.filter((r) => r.sku === sku && r.term_type === "whatsapp_keyword").length,
      meetsMin: !insufficient.find((i) => i.sku === sku),
    }))
    .sort((a, b) => b.oa + b.wa - (a.oa + a.wa));

  const anchor4 = aliasWaRank.filter((s) => s.meetsMin).slice(0, 4);
  const anchor4Terms = anchor4.reduce((n, s) => n + s.oa + s.wa, 0);

  md.push("\n**Suggested first alias draft (official_alias + whatsapp_keyword only):**");
  md.push(`- **${anchor4Terms} terms** across ${anchor4.map((s) => s.sku).join(", ")}`);
  for (const s of anchor4) {
    md.push(`  - ${s.sku} ${s.name}: ${s.oa} official_alias + ${s.wa} whatsapp_keyword`);
  }
  md.push("\n**Rollout:**");
  md.push("1. Draft safe official_alias + whatsapp_keyword rows for anchor 4 above");
  md.push("2. Human-review all REVIEW_ONLY pyramid/asiyah/boukaj rows before WhatsApp enablement");
  md.push("3. Add safe customer_term rows after anchor 4 sign-off");
  md.push("4. Expand to full 10-SKU batch (245 terms) then remaining cohort\n");

  md.push("## Safety rules applied\n");
  md.push("**SAFE_TO_DRAFT** when:");
  md.push("- conflict_risk is LOW or MEDIUM **and**");
  md.push("- term_text has enough context for one SKU **and**");
  md.push("- not a bare family/shape/filling token\n");
  md.push("**REVIEW_ONLY** when:");
  md.push("- conflict_risk is HIGH, or");
  md.push("- bare/ambiguous token, or");
  md.push("- term could match multiple Batch 001 SKUs, or");
  md.push("- clarification trigger required\n");
  md.push("---\n*Preview only. No product_aliases writes. No catalogue_alias_drafts. No Central sync.*\n");

  writeFileSync(join(PREVIEW_DIR, "batch001_language_safety_summary.md"), md.join("\n"));

  console.log(
    JSON.stringify(
      {
        safe_to_draft: safe.length,
        review_only: review.length,
        insufficient_skus: insufficient.length,
        first_batch_skus: firstBatch.length,
        first_batch_terms: firstBatchTermCount,
        draft_ready_skus: draftReadySkus.length,
      },
      null,
      2,
    ),
  );
}

main();
