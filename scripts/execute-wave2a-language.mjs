#!/usr/bin/env node
/**
 * Wave 2A language execution: scan, filter, build draft payloads.
 * Does NOT write product_aliases directly.
 */

import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

export const WAVE2A_SKUS = [
  "OAS-AS-BKL-0001",
  "OAS-AS-BKL-0003",
  "OAS-AS-BKL-0007",
  "OAS-AS-BKL-0010",
  "OAS-AS-BKL-0017",
  "OAS-AS-BKL-0019",
  "OAS-AS-BKL-0021",
  "OAS-AS-BKL-0025",
];

export const COVERED_SKUS = [
  ...WAVE2A_SKUS,
  "OAS-AS-BKL-0013",
  "OAS-AS-BKL-0014",
  "OAS-AS-BKL-0020",
  "OAS-AS-BKL-0024",
];

export const PRODUCT_IDS = {
  "OAS-AS-BKL-0001": "c7c0c5aa-1d2f-4088-88f1-1e5aacd321a0",
  "OAS-AS-BKL-0003": "90e0f9df-d4dc-4ec5-8238-d7a2624e759a",
  "OAS-AS-BKL-0007": "2390ea3d-19ba-43bb-8624-d6b033153c2f",
  "OAS-AS-BKL-0010": "7d66f253-a179-4a33-b8ba-7b94ec783a3e",
  "OAS-AS-BKL-0013": "c5e84d04-0d8b-4466-8690-a7e6267b44a8",
  "OAS-AS-BKL-0014": "4af95ba1-ff0f-4740-8869-6a19a41e8c83",
  "OAS-AS-BKL-0017": "0cb6c64c-0529-4dfc-83cd-9b45ab7f9de6",
  "OAS-AS-BKL-0019": "636b47cb-ea6f-4711-ae29-d6153e565ae3",
  "OAS-AS-BKL-0020": "b0aee1c4-4502-4a15-9880-e2c01378c0b5",
  "OAS-AS-BKL-0021": "6b258e44-69dc-465a-b82a-cbb72f68d723",
  "OAS-AS-BKL-0024": "cea65af8-129c-4838-988f-30955fa5bc22",
  "OAS-AS-BKL-0025": "f58e0a78-53a9-400b-8768-7af09b68ba38",
};

const PHASE1_IDS = new Set([
  PRODUCT_IDS["OAS-AS-BKL-0013"],
  PRODUCT_IDS["OAS-AS-BKL-0014"],
  PRODUCT_IDS["OAS-AS-BKL-0020"],
  PRODUCT_IDS["OAS-AS-BKL-0024"],
]);

const TERM_TYPES = new Set(["official_alias", "whatsapp_keyword"]);
const SUBMITTED_BY = "a3904c02-3305-4fa7-b0c0-f1a30d7e1fd6";

/** Bare generic orphan alias texts already in master with null product_id */
const BARE_GENERIC_NORMS = new Set([
  "pyramid",
  "piramed",
  "pyramid special",
  "bulbul",
  "ashel",
  "osh el bulbul",
  "finger",
  "asabi",
  "asiyah",
  "tart",
  "crosole",
  "almand",
  "kitta",
  "kita",
  "kitta cashew",
  "pyramid kaju",
  "ring",
  "durum",
  "coconut",
  "cashew",
  "kaju",
  "pista",
  "pistachio",
  "baklawa",
  "baklava",
]);

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

/** Collapse known transliteration variants for collision detection */
function normAliasKey(text) {
  return norm(text).replace(/assiyah/g, "asiyah");
}

function isBareGeneric(termText) {
  const n = norm(termText);
  if (BARE_GENERIC_NORMS.has(n)) return true;
  const tokens = n.split(" ");
  if (tokens.length === 1 && BARE_GENERIC_NORMS.has(tokens[0])) return true;
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
      source: "batch001_language_wave2a",
    },
    status: "pending_approval",
    submitted_by: SUBMITTED_BY,
  };
}

/**
 * @param {Array<{norm_text:string, product_id:string|null}>} existingAliases
 */
export function prepareWave2aDrafts(existingAliases) {
  const path = join(ROOT, "data/product-language-preview/batch001_language_terms_safe_to_draft.csv");
  const rows = parseCsv(readFileSync(path, "utf8"));

  const wave2aSet = new Set(WAVE2A_SKUS);
  const raw = rows.filter(
    (r) =>
      wave2aSet.has(r.sku) &&
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
    excluded_existing_same_product: [],
    excluded_phase1_cross_sku: [],
    excluded_cross_wave2a: [],
    excluded_within_batch_dupe: [],
  };

  const kept = [];
  const seen = new Map();

  for (const row of raw) {
    const n = normAliasKey(row.term_text);
    const productId = PRODUCT_IDS[row.sku];

    if (isBareGeneric(row.term_text)) {
      scan.excluded_bare_generic.push({ sku: row.sku, term: row.term_text, reason: "bare_generic" });
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

    const phase1Owners = [...new Set(existingOwners.filter((id) => PHASE1_IDS.has(id)))];
    if (phase1Owners.length > 0 && !phase1Owners.includes(productId)) {
      scan.excluded_phase1_cross_sku.push({
        sku: row.sku,
        term: row.term_text,
        reason: "phase1_cross_sku_collision",
        existing_on: phase1Owners,
      });
      continue;
    }

    const otherWaveOwners = existingOwners.filter((id) => id && id !== productId);
    if (otherWaveOwners.length > 0) {
      scan.excluded_phase1_cross_sku.push({
        sku: row.sku,
        term: row.term_text,
        reason: "master_cross_sku_collision",
        existing_on: otherWaveOwners,
      });
      continue;
    }

    kept.push(row);
  }

  // Cross-SKU within kept batch
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
        scan.excluded_cross_wave2a.push({ sku: row.sku, term: row.term_text, reason: "cross_wave2a_ambiguity" });
      }
      continue;
    }
    finalRows.push(...group);
  }

  const drafts = finalRows.map(buildDraftRow);

  return { drafts, scan, final_count: drafts.length };
}

function loadExistingAliases() {
  const existing = [];

  const phase1Path = join(ROOT, "data/product-language-preview/batch001_phase1_drafts_payload.json");
  try {
    const phase1 = JSON.parse(readFileSync(phase1Path, "utf8"));
    for (const d of phase1) {
      existing.push({
        norm_text: norm(d.payload.alias_text),
        product_id: d.payload.product_id,
      });
    }
  } catch {
    /* phase1 snapshot optional */
  }

  for (const path of [
    "_wave2a_existing_aliases.json",
    "wave2a_existing_aliases_snapshot.json",
  ]) {
    try {
      const extra = JSON.parse(readFileSync(join(ROOT, "data/product-language-preview", path), "utf8"));
      existing.push(...extra);
    } catch {
      /* optional snapshot */
    }
  }

  return existing;
}

function main() {
  const existing = loadExistingAliases();
  if (!existing.length) {
    console.error("No existing alias snapshot available");
    process.exit(1);
  }

  const { drafts, scan, final_count } = prepareWave2aDrafts(existing);

  if (process.argv.includes("--write-json")) {
    writeFileSync(
      join(ROOT, "data/product-language-preview/batch001_wave2a_drafts_payload.json"),
      JSON.stringify(drafts, null, 2) + "\n",
    );
    writeFileSync(
      join(ROOT, "data/product-language-preview/batch001_wave2a_collision_report.json"),
      JSON.stringify(scan, null, 2) + "\n",
    );
  }

  console.log(JSON.stringify({ final_count, scan_summary: {
    raw: scan.raw_count,
    bare: scan.excluded_bare_generic.length,
    existing: scan.excluded_existing_same_product.length,
    phase1_cross: scan.excluded_phase1_cross_sku.length,
    cross_wave2a: scan.excluded_cross_wave2a.length,
    dupes: scan.excluded_within_batch_dupe.length,
  }}, null, 2));
}

if (process.argv[1]?.endsWith("execute-wave2a-language.mjs")) main();
