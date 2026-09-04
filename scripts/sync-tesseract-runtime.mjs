#!/usr/bin/env node
/**
 * Pin Tesseract worker/core/lang assets to public/tesseract for same-origin Fast Create OCR.
 * Sources are version-locked npm packages — never fetched from mutable public CDNs at runtime.
 */
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

process.chdir(join(dirname(fileURLToPath(import.meta.url)), ".."));

if (!existsSync("node_modules/tesseract.js/dist/worker.min.js")) {
  console.error("Missing Tesseract source asset: node_modules/tesseract.js/dist/worker.min.js");
  console.error(
    "Run npm install to restore tesseract.js, tesseract.js-core, and @tesseract.js-data/eng.",
  );
  process.exit(1);
}
if (!existsSync("node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js")) {
  console.error(
    "Missing Tesseract source asset: node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js",
  );
  process.exit(1);
}
if (!existsSync("node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm")) {
  console.error(
    "Missing Tesseract source asset: node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm",
  );
  process.exit(1);
}
if (!existsSync("node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js")) {
  console.error(
    "Missing Tesseract source asset: node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js",
  );
  process.exit(1);
}
if (!existsSync("node_modules/tesseract.js-core/tesseract-core-lstm.wasm")) {
  console.error(
    "Missing Tesseract source asset: node_modules/tesseract.js-core/tesseract-core-lstm.wasm",
  );
  process.exit(1);
}
if (!existsSync("node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz")) {
  console.error(
    "Missing Tesseract source asset: node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz",
  );
  process.exit(1);
}

mkdirSync("public/tesseract/core", { recursive: true });
mkdirSync("public/tesseract/lang", { recursive: true });

cpSync("node_modules/tesseract.js/dist/worker.min.js", "public/tesseract/worker.min.js");
cpSync(
  "node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js",
  "public/tesseract/core/tesseract-core-simd-lstm.wasm.js",
);
cpSync(
  "node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm",
  "public/tesseract/core/tesseract-core-simd-lstm.wasm",
);
cpSync(
  "node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js",
  "public/tesseract/core/tesseract-core-lstm.wasm.js",
);
cpSync(
  "node_modules/tesseract.js-core/tesseract-core-lstm.wasm",
  "public/tesseract/core/tesseract-core-lstm.wasm",
);
cpSync(
  "node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz",
  "public/tesseract/lang/eng.traineddata.gz",
);

console.log("Synced 6 Tesseract runtime assets to public/tesseract/");
