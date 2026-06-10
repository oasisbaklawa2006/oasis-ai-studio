#!/usr/bin/env node
/**
 * Submit Batch 001 Phase 1 language terms as catalogue_alias_drafts only.
 * Does NOT write product_aliases. Does NOT approve drafts.
 *
 * Usage:
 *   node scripts/submit-batch001-language-phase1.mjs --dry-run
 *   node scripts/submit-batch001-language-phase1.mjs --json > /tmp/phase1-drafts.json
 */

import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const PHASE1_SKUS = new Set([
  "OAS-AS-BKL-0014",
  "OAS-AS-BKL-0024",
  "OAS-AS-BKL-0013",
  "OAS-AS-BKL-0020",
]);

const PHASE1_TERM_TYPES = new Set(["official_alias", "whatsapp_keyword"]);

const PRODUCT_IDS = {
  "OAS-AS-BKL-0013": "c5e84d04-0d8b-4466-8690-a7e6267b44a8",
  "OAS-AS-BKL-0014": "4af95ba1-ff0f-4740-8869-6a19a41e8c83",
  "OAS-AS-BKL-0020": "b0aee1c4-4502-4a15-9880-e2c01378c0b5",
  "OAS-AS-BKL-0024": "cea65af8-129c-4838-988f-30955fa5bc22",
};

const CHANNEL_SCOPE = {
  official_alias: ["central", "catalogue"],
  whatsapp_keyword: ["whatsapp"],
};

const SUBMITTED_BY = "a3904c02-3305-4fa7-b0c0-f1a30d7e1fd6";

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

function buildDraftRow(csvRow) {
  const productId = PRODUCT_IDS[csvRow.sku];
  const aliasText = csvRow.term_text.trim();
  const termType = csvRow.term_type;
  const canonical = csvRow.official_name.trim();

  const payload = {
    scope: "product_alias",
    alias: aliasText,
    alias_text: aliasText,
    term_type: termType,
    channel_scope: CHANNEL_SCOPE[termType] ?? ["catalogue"],
    product_id: productId,
    canonical_name: canonical,
    language: csvRow.language || null,
    script: csvRow.script || null,
    source: "batch001_language_phase1",
  };

  return {
    source_app: "catalogue_app",
    target_table: "product_aliases",
    target_record_id: null,
    operation: "create",
    payload,
    status: "pending_approval",
    submitted_by: SUBMITTED_BY,
  };
}

export function loadPhase1DraftRows() {
  const path = join(ROOT, "data/product-language-preview/batch001_language_terms_safe_to_draft.csv");
  const rows = parseCsv(readFileSync(path, "utf8"));

  return rows
    .filter(
      (r) =>
        PHASE1_SKUS.has(r.sku) &&
        PHASE1_TERM_TYPES.has(r.term_type) &&
        r.safety_bucket === "SAFE_TO_DRAFT" &&
        r.term_text?.trim(),
    )
    .map(buildDraftRow);
}

function main() {
  const drafts = loadPhase1DraftRows();
  const bySku = {};
  const byType = {};
  for (const d of drafts) {
    const sku = Object.entries(PRODUCT_IDS).find(([, id]) => id === d.payload.product_id)?.[0] ?? "?";
    bySku[sku] = (bySku[sku] ?? 0) + 1;
    byType[d.payload.term_type] = (byType[d.payload.term_type] ?? 0) + 1;
  }

  const summary = {
    total: drafts.length,
    bySku,
    byType,
    skus: Object.keys(bySku).sort(),
  };

  if (process.argv.includes("--json")) {
    process.stdout.write(JSON.stringify(drafts, null, 2));
    return;
  }

  if (process.argv.includes("--write-json")) {
    const out = join(ROOT, "data/product-language-preview/batch001_phase1_drafts_payload.json");
    writeFileSync(out, JSON.stringify(drafts, null, 2) + "\n");
    console.log(`Wrote ${drafts.length} drafts to ${out}`);
    return;
  }

  console.log(JSON.stringify(summary, null, 2));

  if (drafts.length !== 82) {
    console.error(`Expected 82 drafts, got ${drafts.length}`);
    process.exit(1);
  }
}

main();
