/** Same-origin Tesseract runtime paths — never load worker/core/lang from public CDNs. */
export const TESSERACT_PUBLIC_ROOT = "/tesseract";

export const TESSERACT_RUNTIME_PATHS = {
  workerPath: `${TESSERACT_PUBLIC_ROOT}/worker.min.js`,
  corePath: `${TESSERACT_PUBLIC_ROOT}/core`,
  langPath: `${TESSERACT_PUBLIC_ROOT}/lang`,
} as const;

const REMOTE_RUNTIME_URL_PATTERNS = [
  /cdn\.jsdelivr\.net/i,
  /projectnaptha\.com/i,
  /tessdata\.projectnaptha/i,
];

export function assertNoRemoteTesseractRuntimeUrls(urls: readonly string[]): void {
  for (const url of urls) {
    for (const pattern of REMOTE_RUNTIME_URL_PATTERNS) {
      if (pattern.test(url)) {
        throw new Error(`Remote Tesseract runtime URL blocked: ${url}`);
      }
    }
  }
}

export function pinnedTesseractWorkerOptions() {
  const options = {
    workerPath: TESSERACT_RUNTIME_PATHS.workerPath,
    corePath: TESSERACT_RUNTIME_PATHS.corePath,
    langPath: TESSERACT_RUNTIME_PATHS.langPath,
    gzip: true,
  };
  assertNoRemoteTesseractRuntimeUrls([options.workerPath, options.corePath, options.langPath]);
  return options;
}

/** Fail closed when pinned same-origin runtime assets are unavailable. */
export async function assertTesseractRuntimeAvailable(): Promise<void> {
  const requiredAssets = [
    TESSERACT_RUNTIME_PATHS.workerPath,
    `${TESSERACT_RUNTIME_PATHS.corePath}/tesseract-core-simd-lstm.wasm.js`,
    `${TESSERACT_RUNTIME_PATHS.corePath}/tesseract-core-lstm.wasm.js`,
    `${TESSERACT_RUNTIME_PATHS.langPath}/eng.traineddata.gz`,
  ];
  assertNoRemoteTesseractRuntimeUrls(requiredAssets);

  for (const assetUrl of requiredAssets) {
    const response = await fetch(assetUrl, { method: "HEAD" });
    if (!response.ok) {
      throw new Error(`Tesseract runtime asset unavailable (${response.status}): ${assetUrl}`);
    }
  }
}
