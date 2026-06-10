#!/usr/bin/env node
/**
 * Generates ephemeral insert SQL for Wave 2A draft submission (stdout only).
 * Default: dry-run summary. Live SQL requires --live and CONFIRM_LIVE_SUBMIT=true.
 */

import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { guardSubmit } from "./lib/submitGuardrails.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const BATCH = "batch001_language_wave2a";

const chunkArg =
  process.argv.find((a) => a.startsWith("--chunk="))?.split("=")[1] ??
  process.argv.find((a) => /^\d+$/.test(a)) ??
  "0";
const chunkIdx = Number(chunkArg);
const chunkPath = join(ROOT, `data/product-language-preview/_wave2a_insert_chunk_${chunkIdx}.json`);

let rows;
try {
  rows = JSON.parse(readFileSync(chunkPath, "utf8"));
} catch {
  const all = JSON.parse(
    readFileSync(join(ROOT, "data/product-language-preview/batch001_wave2a_drafts_payload.json"), "utf8"),
  );
  const chunkSize = 20;
  rows = all.slice(chunkIdx * chunkSize, (chunkIdx + 1) * chunkSize);
}

const chunkCount = 4;
const result = guardSubmit({
  rows,
  batchLabel: BATCH,
  chunkIdx,
  chunkCount,
  argv: process.argv,
  env: process.env,
});

if (result.emitted) {
  process.stdout.write(result.sql);
}
