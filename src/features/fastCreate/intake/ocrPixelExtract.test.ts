import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  assertNoRemoteTesseractRuntimeUrls,
  pinnedTesseractWorkerOptions,
  TESSERACT_RUNTIME_PATHS,
} from "./ocrTesseractRuntime";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("ocrPixelExtract runtime contract", () => {
  const pixelSource = readFileSync(join(__dirname, "./ocrPixelExtract.ts"), "utf8");
  const runtimeSource = readFileSync(join(__dirname, "./ocrTesseractRuntime.ts"), "utf8");

  it("never loads Tesseract worker/core/lang from mutable public CDNs", () => {
    const combined = `${pixelSource}\n${runtimeSource}`;
    expect(combined).not.toMatch(/cdn\.jsdelivr\.net/i);
    expect(combined).not.toMatch(/projectnaptha\.com/i);
    expect(combined).not.toMatch(/tessdata\.projectnaptha/i);
    expect(pixelSource).toContain("pinnedTesseractWorkerOptions");
    expect(pixelSource).toContain("assertTesseractRuntimeAvailable");
    expect(pixelSource).not.toMatch(/createWorker\(\s*["']eng["']\s*\)/);
  });

  it("pins same-origin worker/core/lang paths and blocks remote URLs", () => {
    const options = pinnedTesseractWorkerOptions();
    expect(options.workerPath).toBe(TESSERACT_RUNTIME_PATHS.workerPath);
    expect(options.corePath).toBe(TESSERACT_RUNTIME_PATHS.corePath);
    expect(options.langPath).toBe(TESSERACT_RUNTIME_PATHS.langPath);
    expect(() =>
      assertNoRemoteTesseractRuntimeUrls([
        "https://cdn.jsdelivr.net/npm/tesseract.js/dist/worker.min.js",
      ]),
    ).toThrow(/Remote Tesseract runtime URL blocked/);
  });
});
