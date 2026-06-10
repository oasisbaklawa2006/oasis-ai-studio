#!/usr/bin/env node
/**
 * Wave 2B language execution: Asiyah/Tart ambiguity cluster with strict collision control.
 * Does NOT write product_aliases directly.
 */

import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

export const WAVE2B_SKUS = [
  "OAS-AS-BKL-0012",
  "OAS-AS-BKL-0015",
  "OAS-AS-BKL-0016",
  "OAS-AS-BKL-0022",
  "OAS-AS-BKL-0023",
];

export const COVERED_SKUS = [
  "OAS-AS-BKL-0001",
  "OAS-AS-BKL-0003",
  "OAS-AS-BKL-0007",
  "OAS-AS-BKL-0010",
  "OAS-AS-BKL-0012",
  "OAS-AS-BKL-0013",
  "OAS-AS-BKL-0014",
  "OAS-AS-BKL-0015",
  "OAS-AS-BKL-0016",
  "OAS-AS-BKL-0017",
  "OAS-AS-BKL-0019",
  "OAS-AS-BKL-0020",
  "OAS-AS-BKL-0021",
  "OAS-AS-BKL-0022",
  "OAS-AS-BKL-0023",
  "OAS-AS-BKL-0024",
  "OAS-AS-BKL-0025",
];

export const PRODUCT_IDS = {
  "OAS-AS-BKL-0001": "c7c0c5aa-1d2f-4088-88f1-1e5aacd321a0",
  "OAS-AS-BKL-0003": "90e0f9df-d4dc-4ec5-8238-d7a2624e759a",
  "OAS-AS-BKL-0007": "2390ea3d-19ba-43bb-8624-d6b033153c2f",
  "OAS-AS-BKL-0010": "7d66f253-a179-4a33-b8ba-7b94ec783a3e",
  "OAS-AS-BKL-0012": "4baff7d1-bf58-4d0f-b842-c53f99caac61",
  "OAS-AS-BKL-0013": "c5e84d04-0d8b-4466-8690-a7e6267b44a8",
  "OAS-AS-BKL-0014": "4af95ba1-ff0f-4740-8869-6a19a41e8c83",
  "OAS-AS-BKL-0015": "73f91572-8844-4fa6-b267-56210d180468",
  "OAS-AS-BKL-0016": "f3f7a8fd-cea8-4ecb-a258-ef1ea86940b7",
  "OAS-AS-BKL-0017": "0cb6c64c-0529-4dfc-83cd-9b45ab7f9de6",
  "OAS-AS-BKL-0019": "636b47cb-ea6f-4711-ae29-d6153e565ae3",
  "OAS-AS-BKL-0020": "b0aee1c4-4502-4a15-9880-e2c01378c0b5",
  "OAS-AS-BKL-0021": "6b258e44-69dc-465a-b82a-cbb72f68d723",
  "OAS-AS-BKL-0022": "8554f5d5-5e46-4ffe-b98a-0ed10ec522ae",
  "OAS-AS-BKL-0023": "43a25d30-f7d9-426b-b5af-cae7d477468e",
  "OAS-AS-BKL-0024": "cea65af8-129c-4838-988f-30955fa5bc22",
  "OAS-AS-BKL-0025": "f58e0a78-53a9-400b-8768-7af09b68ba38",
};

const TERM_TYPES = new Set(["official_alias", "whatsapp_keyword"]);
const SUBMITTED_BY = "a3904c02-3305-4fa7-b0c0-f1a30d7e1fd6";

/** Exact bare terms excluded per Wave 2B rules */
const BARE_EXACT = new Set([
  "asiyah",
  "assiyah",
  "high jump",
  "pistachio asiyah",
  "tart",
  "pistachio tart",
  "almond",
  "pistachio",
  "baklava",
  "baklawa",
]);

const CONTEXT_MARKERS = [
  "chocolate",
  "mor",
  "beetroot",
  "natural",
  "almond",
  "badam",
  "purple",
  "mix nut",
  "tart cashew",
  "cashew tart",
];

const CHANNEL_SCOPE = {
  official_alias: ["central", "catalogue"],
  whatsapp_keyword: ["whatsapp"],
};

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

function parseCsv(text) {
  const lines = text.trim().split("\n");
  const header = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    return Object.fromEntries(header.map((h, i) => [h, cols[i] ?? ""]));
  });
}

function norm(text) {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function normAliasKey(text) {
  return norm(text).replace(/assiyah/g, "asiyah");
}

function isBareExcluded(termText) {
  const n = normAliasKey(termText);
  if (BARE_EXACT.has(n)) return true;
  if (n === "pista asiyah") return true;
  if (n === "high jump sweet" || n === "high jump baklawa") return true;
  return false;
}

function hasSufficientContext(termText, officialName) {
  const n = norm(termText);
  const officialNorm = norm(officialName);

  if (isBareExcluded(termText)) return false;
  if (n === officialNorm) return true;
  if (n.startsWith(`${officialNorm} `)) return true;

  for (const marker of CONTEXT_MARKERS) {
    if (n.includes(marker)) return true;
  }

  if (n.includes("pistachio nut asiyah") || n.includes("pista nut asiyah")) return true;
  if (n.includes("pistachio nut tart") || n.includes("pista nut tart")) return true;
  if (n.includes("asiyah") && (n.includes("chocolate") || n.includes("mor") || n.includes("beetroot") || n.includes("purple"))) return true;
  if (n.includes("tart") && (n.includes("almond") || n.includes("badam") || n.includes("mix nut") || n.includes("pistachio nut") || n.includes("cashew"))) return true;

  if (n.includes("asiyah") && (n.includes("baklawa") || n.includes("baklava") || n.includes("lebanese"))) {
    if (n.includes("chocolate") || n.includes("mor") || n.includes("beetroot") || n.includes("purple")) return true;
    if (n.includes("pistachio nut") || n.includes("pista nut")) return true;
    if (n.startsWith("pistachio asiyah ") || n.startsWith("pista asiyah ")) return true;
  }

  const prefixed = n.match(/^(need|send)\s+(.+)$/);
  if (prefixed) {
    const rest = prefixed[2];
    if (rest === "pistachio asiyah" || rest === "pista asiyah") return true;
    if (rest.includes("chocolate") || rest.includes("mor") || rest.includes("almond") || rest.includes("badam")) return true;
    if (rest.includes("beetroot") || rest.includes("purple") || rest.includes("pistachio nut") || rest.includes("pista nut")) return true;
    return hasSufficientContext(rest, officialName);
  }

  if (n.endsWith(" kg") && hasSufficientContext(n.replace(/ kg$/, ""), officialName)) return true;

  if (officialNorm.includes(n) && n.length >= 10) return true;

  return false;
}

function buildDraftRow(row) {
  const aliasText = row.term_text.trim();
  const termType = row.term_type;
  return {
    source_app: "catalogue_app",
    target_table: "product_aliases",
    target_record_id: null,
    operation: "create",
    payload: {
      scope: "product_alias",
      alias: aliasText,
      alias_text: aliasText,
      term_type: termType,
      channel_scope: CHANNEL_SCOPE[termType] ?? ["catalogue"],
      product_id: PRODUCT_IDS[row.sku],
      canonical_name: row.official_name.trim(),
      language: row.language || null,
      script: row.script || null,
      source: "batch001_language_wave2b",
    },
    status: "pending_approval",
    submitted_by: SUBMITTED_BY,
  };
}

function loadPayloadAliases() {
  const existing = [];
  for (const file of [
    "batch001_phase1_drafts_payload.json",
    "batch001_wave2a_drafts_payload.json",
  ]) {
    const path = join(ROOT, "data/product-language-preview", file);
    const rows = JSON.parse(readFileSync(path, "utf8"));
    for (const d of rows) {
      existing.push({
        norm_text: norm(d.payload.alias_text),
        product_id: d.payload.product_id,
      });
    }
  }
  return existing;
}

/**
 * @param {Array<{norm_text:string, product_id:string|null}>} existingAliases
 */
export function prepareWave2bDrafts(existingAliases) {
  const path = join(ROOT, "data/product-language-preview/batch001_language_terms_safe_to_draft.csv");
  const rows = parseCsv(readFileSync(path, "utf8"));

  const wave2bSet = new Set(WAVE2B_SKUS);
  const raw = rows.filter(
    (r) =>
      wave2bSet.has(r.sku) &&
      TERM_TYPES.has(r.term_type) &&
      r.safety_bucket === "SAFE_TO_DRAFT" &&
      r.term_text?.trim(),
  );

  const existingByNorm = new Map();
  for (const a of existingAliases) {
    if (!a.norm_text) continue;
    const key = normAliasKey(a.norm_text);
    const list = existingByNorm.get(key) ?? [];
    list.push(a.product_id);
    existingByNorm.set(key, list);
  }

  const scan = {
    raw_count: raw.length,
    excluded_bare_generic: [],
    excluded_insufficient_context: [],
    excluded_existing_same_product: [],
    excluded_prior_wave_cross_sku: [],
    excluded_cross_wave2b: [],
    excluded_within_batch_dupe: [],
  };

  const kept = [];
  const seen = new Map();

  for (const row of raw) {
    const n = normAliasKey(row.term_text);
    const productId = PRODUCT_IDS[row.sku];

    if (isBareExcluded(row.term_text)) {
      scan.excluded_bare_generic.push({ sku: row.sku, term: row.term_text, reason: "bare_term" });
      continue;
    }

    if (!hasSufficientContext(row.term_text, row.official_name)) {
      scan.excluded_insufficient_context.push({ sku: row.sku, term: row.term_text, reason: "insufficient_context" });
      continue;
    }

    const dedupeKey = `${n}|${productId}`;
    if (seen.has(dedupeKey)) {
      scan.excluded_within_batch_dupe.push({ sku: row.sku, term: row.term_text, reason: "case_variant_dupe" });
      continue;
    }
    seen.set(dedupeKey, row);

    const existingOwners = existingByNorm.get(n) ?? [];
    if (existingOwners.includes(productId)) {
      scan.excluded_existing_same_product.push({ sku: row.sku, term: row.term_text, reason: "already_approved" });
      continue;
    }

    const otherOwners = [...new Set(existingOwners.filter((id) => id && id !== productId))];
    if (otherOwners.length > 0) {
      scan.excluded_prior_wave_cross_sku.push({
        sku: row.sku,
        term: row.term_text,
        reason: "phase1_wave2a_cross_sku_collision",
        existing_on: otherOwners,
      });
      continue;
    }

    kept.push(row);
  }

  const byNorm = new Map();
  for (const row of kept) {
    const n = normAliasKey(row.term_text);
    const list = byNorm.get(n) ?? [];
    list.push(row);
    byNorm.set(n, list);
  }

  const finalRows = [];
  for (const [, group] of byNorm) {
    const skus = new Set(group.map((r) => r.sku));
    if (skus.size > 1) {
      for (const row of group) {
        scan.excluded_cross_wave2b.push({ sku: row.sku, term: row.term_text, reason: "cross_wave2b_ambiguity" });
      }
      continue;
    }
    finalRows.push(...group);
  }

  const drafts = finalRows.map(buildDraftRow);
  return { drafts, scan, final_count: drafts.length };
}

function main() {
  const existing = loadPayloadAliases();
  const { drafts, scan, final_count } = prepareWave2bDrafts(existing);

  if (process.argv.includes("--write-json")) {
    writeFileSync(
      join(ROOT, "data/product-language-preview/batch001_wave2b_drafts_payload.json"),
      JSON.stringify(drafts, null, 2) + "\n",
    );
    writeFileSync(
      join(ROOT, "data/product-language-preview/batch001_wave2b_collision_report.json"),
      JSON.stringify(scan, null, 2) + "\n",
    );
  }

  const bySku = {};
  for (const d of drafts) {
    const pid = d.payload.product_id;
    bySku[pid] = (bySku[pid] ?? 0) + 1;
  }

  console.log(JSON.stringify({
    final_count,
    by_sku_count: bySku,
    scan_summary: {
      raw: scan.raw_count,
      bare: scan.excluded_bare_generic.length,
      context: scan.excluded_insufficient_context.length,
      existing: scan.excluded_existing_same_product.length,
      prior_cross: scan.excluded_prior_wave_cross_sku.length,
      cross_wave2b: scan.excluded_cross_wave2b.length,
      dupes: scan.excluded_within_batch_dupe.length,
    },
  }, null, 2));
}

if (process.argv[1]?.endsWith("execute-wave2b-language.mjs")) main();
