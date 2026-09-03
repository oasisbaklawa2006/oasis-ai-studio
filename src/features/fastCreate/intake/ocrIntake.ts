import type { FastCreateDraftSnapshot } from "@/features/fastCreate/fastCreateDraft";
import { intakeFromText } from "./textIntake";
import type { ProductIntakeResult } from "./types";

/**
 * Bounded OCR candidate extraction — filename and manual review text only.
 * No silent publication: operators must confirm extracted text before draft merge.
 */
export function extractOcrCandidateText(file: File): { text: string; source: string } {
  const base = file.name.replace(/\.[^.]+$/, "");
  const fromName = base
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (fromName.length >= 3 && !/^(?:img|image|photo|scan|document)\d*$/i.test(fromName)) {
    return { text: fromName, source: "filename_hint" };
  }

  return { text: "", source: "none" };
}

/**
 * OCR intake from reviewable text (operator-confirmed extraction output).
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
 * Prepare OCR intake from an uploaded image — always review-required.
 */
export function prepareOcrIntakeFromImage(file: File): ProductIntakeResult {
  const { text, source } = extractOcrCandidateText(file);
  if (!text) {
    return {
      mode: "ocr",
      status: "ambiguous",
      message: `Image "${file.name}" uploaded — type the label text you see for review.`,
      draftPatch: {},
      suggestions: [],
      reviewRequired: true,
      rawInput: file.name,
    };
  }

  const parsed = intakeFromOcrText(text, file.name);
  return {
    ...parsed,
    message:
      source === "filename_hint"
        ? `Low-confidence filename hint from "${file.name}" — correct the text and review all fields.`
        : parsed.message,
    status: parsed.status === "ok" ? "ambiguous" : parsed.status,
  };
}
