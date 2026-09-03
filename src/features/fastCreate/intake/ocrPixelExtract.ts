import { createWorker } from "tesseract.js";

export type OcrPixelExtraction = {
  text: string;
  confidence: number;
  source: "pixel_ocr";
};

export type OcrPixelExtractor = (file: File) => Promise<OcrPixelExtraction>;

async function defaultPixelExtract(file: File): Promise<OcrPixelExtraction> {
  const worker = await createWorker("eng");
  try {
    const { data } = await worker.recognize(file);
    return {
      text: data.text.trim(),
      confidence: data.confidence,
      source: "pixel_ocr",
    };
  } finally {
    await worker.terminate();
  }
}

let pixelExtractor: OcrPixelExtractor = defaultPixelExtract;

/** Test hook — pixel OCR must never fall back to filename metadata. */
export function setOcrPixelExtractorForTests(next: OcrPixelExtractor | null): void {
  pixelExtractor = next ?? defaultPixelExtract;
}

/** Extract label text from image pixels via Tesseract.js (browser-side, review-required). */
export async function extractOcrTextFromImagePixels(file: File): Promise<OcrPixelExtraction> {
  return pixelExtractor(file);
}
