import type { FastCreateDraftSnapshot } from "@/features/fastCreate/fastCreateDraft";
import { intakeFieldSuggestion } from "./intakeFieldSuggestion";
import { extractOcrTextFromImagePixels } from "./ocrPixelExtract";
import { intakeFromText } from "./textIntake";
import type { ProductIntakeResult } from "./types";

const UNSUPPORTED_IMAGE_TYPES = new Set(["application/pdf"]);

/**
 * OCR intake from operator-reviewed text that originated from pixel extraction.
 */
export function intakeFromOcrText(rawText: string, imageName?: string): ProductIntakeResult {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return {
      mode: "ocr",
      status: "empty",
      message: imageName
        ? `No readable text extracted from ${imageName}. Type what you see on the label.`
        : "No OCR text to parse — type or correct the extracted label text.",
      draftPatch: {} as Partial<FastCreateDraftSnapshot>,
      suggestions: [],
      reviewRequired: true,
      rawInput: rawText,
    };
  }

  const base = intakeFromText(trimmed);
  return {
    ...base,
    mode: "ocr",
    message:
      base.status === "empty"
        ? "OCR text did not yield product fields — edit the extracted text and try again."
        : "OCR suggestions ready — confirm every field before applying to the draft.",
    reviewRequired: true,
  };
}

/**
 * Pixel OCR from an uploaded image — always review-required; never uses filename metadata.
 */
export async function prepareOcrIntakeFromImage(file: File): Promise<ProductIntakeResult> {
  if (UNSUPPORTED_IMAGE_TYPES.has(file.type)) {
    return {
      mode: "ocr",
      status: "unsupported",
      message: "PDF OCR is not supported in this lane — upload a label image (PNG/JPG/WebP).",
      draftPatch: {},
      suggestions: [],
      reviewRequired: true,
      rawInput: file.name,
    };
  }

  let extraction: Awaited<ReturnType<typeof extractOcrTextFromImagePixels>>;
  try {
    extraction = await extractOcrTextFromImagePixels(file);
  } catch {
    return {
      mode: "ocr",
      status: "unsupported",
      message: `Could not read text from "${file.name}". Correct or type the label text manually.`,
      draftPatch: {},
      suggestions: [],
      reviewRequired: true,
      rawInput: file.name,
    };
  }

  if (!extraction.text) {
    return {
      mode: "ocr",
      status: "empty",
      message: `No readable text found in image pixels for "${file.name}". Type what you see on the label.`,
      draftPatch: {},
      suggestions: [
        intakeFieldSuggestion("notes", "Pixel OCR returned no text", "unresolved", "pixel_ocr"),
      ],
      reviewRequired: true,
      rawInput: file.name,
    };
  }

  const parsed = intakeFromOcrText(extraction.text, file.name);
  return {
    ...parsed,
    message: `Pixel OCR extracted label text (confidence ${Math.round(extraction.confidence)}%) — review before applying.`,
    status: parsed.status === "ok" ? "ambiguous" : parsed.status,
    rawInput: extraction.text,
    suggestions: [
      intakeFieldSuggestion(
        "notes",
        `Pixel OCR confidence ${Math.round(extraction.confidence)}%`,
        "medium",
        "pixel_ocr",
      ),
      ...parsed.suggestions,
    ],
  };
}
