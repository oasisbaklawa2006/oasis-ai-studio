#!/usr/bin/env node
/**
 * Pin Tesseract worker/core/lang assets to public/tesseract for same-origin Fast Create OCR.
 * Sources are version-locked npm packages — never fetched from mutable public CDNs at runtime.
 */
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const destRoot = join(root, "public", "tesseract");

const copies = [
  [join(root, "node_modules/tesseract.js/dist/worker.min.js"), join(destRoot, "worker.min.js")],
  [
    join(root, "node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js"),
    join(destRoot, "core/tesseract-core-simd-lstm.wasm.js"),
  ],
  [
    join(root, "node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm"),
    join(destRoot, "core/tesseract-core-simd-lstm.wasm"),
  ],
  [
    join(root, "node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js"),
    join(destRoot, "core/tesseract-core-lstm.wasm.js"),
  ],
  [
    join(root, "node_modules/tesseract.js-core/tesseract-core-lstm.wasm"),
    join(destRoot, "core/tesseract-core-lstm.wasm"),
  ],
  [
    join(root, "node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz"),
    join(destRoot, "lang/eng.traineddata.gz"),
  ],
];

for (const [src, dst] of copies) {
  if (!existsSync(src)) {
    console.error(`Missing Tesseract source asset: ${src}`);
    console.error(
      "Run npm install to restore tesseract.js, tesseract.js-core, and @tesseract.js-data/eng.",
    );
    process.exit(1);
  }
  mkdirSync(dirname(dst), { recursive: true });
  cpSync(src, dst);
}

console.log(`Synced ${copies.length} Tesseract runtime assets to public/tesseract/`);
