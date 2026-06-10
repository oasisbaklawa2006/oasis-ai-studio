#!/usr/bin/env node
/**
 * Generates ephemeral insert SQL for Wave 2A draft submission (stdout only).
 * Not committed as .sql — used for governed draft insert operations.
 */

import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const chunkIdx = Number(process.argv[2] ?? 0);
const chunkPath = join(ROOT, `data/product-language-preview/_wave2a_insert_chunk_${chunkIdx}.json`);
const rows = JSON.parse(readFileSync(chunkPath, "utf8"));
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
