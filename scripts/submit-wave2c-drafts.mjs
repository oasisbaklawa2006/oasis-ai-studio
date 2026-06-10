#!/usr/bin/env node
/**
 * Generates ephemeral insert SQL for Wave 2C draft submission (stdout only).
 * Not committed as .sql — used for governed draft insert operations.
 */

import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const chunkIdx = Number(process.argv[2] ?? 0);
const chunkSize = 15;
const all = JSON.parse(
  readFileSync(join(ROOT, "data/product-language-preview/batch001_wave2c_drafts_payload.json"), "utf8"),
);
const start = chunkIdx * chunkSize;
const rows = all.slice(start, start + chunkSize);
if (!rows.length) process.exit(0);

const json = JSON.stringify(rows).replace(/'/g, "''");
const sql = `
INSERT INTO catalogue_alias_drafts (
  source_app, target_table, target_record_id, operation, payload, status, submitted_by
)
SELECT
  elem->>'source_app',
  elem->>'target_table',
  NULLIF(elem->>'target_record_id', '')::uuid,
  elem->>'operation',
  elem->'payload',
  elem->>'status',
  (elem->>'submitted_by')::uuid
FROM jsonb_array_elements('${json}'::jsonb) AS elem
RETURNING id;
`;
process.stdout.write(sql);
