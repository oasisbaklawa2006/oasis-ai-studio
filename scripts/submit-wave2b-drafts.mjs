#!/usr/bin/env node
/**
 * Generates ephemeral insert SQL for Wave 2B draft submission (stdout only).
 * Default: dry-run summary. Live SQL requires --live and CONFIRM_LIVE_SUBMIT=true.
 */

import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { guardSubmit } from "./lib/submitGuardrails.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const BATCH = "batch001_language_wave2b";

const chunkArg =
  process.argv.find((a) => a.startsWith("--chunk="))?.split("=")[1] ??
  process.argv.find((a) => /^\d+$/.test(a)) ??
  "0";
const chunkIdx = Number(chunkArg);
const chunkSize = 15;

const all = JSON.parse(
  readFileSync(join(ROOT, "data/product-language-preview/batch001_wave2b_drafts_payload.json"), "utf8"),
);
const rows = all.slice(chunkIdx * chunkSize, (chunkIdx + 1) * chunkSize);
const chunkCount = Math.ceil(all.length / chunkSize);

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
