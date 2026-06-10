#!/usr/bin/env node
/**
 * Wave 2C language execution: remaining 8 uncovered Batch 001 SKUs.
 * Prepares governed draft payloads only — does NOT write product_aliases.
 */

import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

export const WAVE2C_SKUS = [
  "OAS-AS-BKL-0002",
  "OAS-AS-BKL-0004",
  "OAS-AS-BKL-0005",
  "OAS-AS-BKL-0006",
  "OAS-AS-BKL-0008",
  "OAS-AS-BKL-0009",
  "OAS-AS-BKL-0011",
  "OAS-AS-BKL-0018",
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
  "OAS-AS-BKL-0002": "89de33c7-e4c1-475e-b711-18258683fdec",
  "OAS-AS-BKL-0004": "eb9c7a73-d1df-4bea-bdf1-209a5b386262",
  "OAS-AS-BKL-0005": "691f2fe6-2d25-4ce2-a9fd-d4b81ecb694b",
  "OAS-AS-BKL-0006": "da4372b9-e1b3-4b17-bdd0-278bd636ab9a",
  "OAS-AS-BKL-0008": "a6013e20-0fc7-4fe6-b2ab-f7f82d336b0c",
  "OAS-AS-BKL-0009": "c522fa96-9247-4cf5-9699-a20bc316dc55",
  "OAS-AS-BKL-0011": "2178c1c7-80c2-4ba3-a211-8643dcf57777",
  "OAS-AS-BKL-0018": "2cab3d7f-7593-441e-a030-6ac6ad3ed9bc",
};

const TERM_TYPES = new Set(["official_alias", "whatsapp_keyword"]);
const SUBMITTED_BY = "a3904c02-3305-4fa7-b0c0-f1a30d7e1fd6";

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
  "square",
  "square baklawa",
  "square baklava",
  "date baklawa",
  "date baklava",
  "rosebud",
  "diamond",
  "almond crosole",
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
      source: "batch001_language_wave2c",
    },
    status: "pending_approval",
    submitted_by: SUBMITTED_BY,
  };
}

export function prepareWave2cDrafts(existingAliases) {
  const path = join(ROOT, "data/product-language-preview/batch001_language_terms_safe_to_draft.csv");
  const rows = parseCsv(readFileSync(path, "utf8"));

  const wave2cSet = new Set(WAVE2C_SKUS);
  const raw = rows.filter(
    (r) =>
      wave2cSet.has(r.sku) &&
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
    excluded_master_cross_sku: [],
    excluded_within_batch_dupe: [],
    excluded_cross_wave2c: [],
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

    const otherOwners = [...new Set(existingOwners.filter((id) => id && id !== productId))];
    if (otherOwners.length > 0) {
      scan.excluded_master_cross_sku.push({
        sku: row.sku,
        term: row.term_text,
        reason: "master_cross_sku_collision",
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
        scan.excluded_cross_wave2c.push({ sku: row.sku, term: row.term_text, reason: "cross_wave2c_ambiguity" });
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
  for (const file of [
    "batch001_phase1_drafts_payload.json",
    "batch001_wave2a_drafts_payload.json",
    "batch001_wave2b_drafts_payload.json",
  ]) {
    try {
      const rows = JSON.parse(readFileSync(join(ROOT, "data/product-language-preview", file), "utf8"));
      for (const d of rows) {
        existing.push({
          norm_text: norm(d.payload.alias_text),
          product_id: d.payload.product_id,
        });
      }
    } catch {
      /* optional */
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

  const { drafts, scan, final_count } = prepareWave2cDrafts(existing);

  if (process.argv.includes("--write-json")) {
    writeFileSync(
      join(ROOT, "data/product-language-preview/batch001_wave2c_drafts_payload.json"),
      JSON.stringify(drafts, null, 2) + "\n",
    );
    writeFileSync(
      join(ROOT, "data/product-language-preview/batch001_wave2c_collision_report.json"),
      JSON.stringify(scan, null, 2) + "\n",
    );
  }

  console.log(
    JSON.stringify(
      {
        final_count,
        scan_summary: {
          raw: scan.raw_count,
          bare: scan.excluded_bare_generic.length,
          existing: scan.excluded_existing_same_product.length,
          master_cross: scan.excluded_master_cross_sku.length,
          cross_wave2c: scan.excluded_cross_wave2c.length,
          dupes: scan.excluded_within_batch_dupe.length,
        },
      },
      null,
      2,
    ),
  );
}

if (process.argv[1]?.endsWith("execute-wave2c-language.mjs")) main();
