import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyFastCreateDraft } from "@/features/fastCreate/fastCreateDraft";
import {
  applyIntakeToDraft,
  intakeBlocksDraftApply,
  intakeFromBarcode,
  intakeFromOcrText,
  intakeFromText,
  intakeFromVoiceTranscript,
  normalizeBarcodeInput,
  parseProductText,
  prepareOcrIntakeFromImage,
  setOcrPixelExtractorForTests,
} from "./index";

vi.mock("./barcodeLookup", () => ({
  lookupBarcodeInCatalog: vi.fn(),
  toDuplicateHit: vi.fn(
    (hit: { productId: string; productName: string; sku: string | null; barcode: string }) => ({
      productId: hit.productId,
      label: hit.sku ? `${hit.productName} (${hit.sku})` : hit.productName,
      barcode: hit.barcode,
    }),
  ),
}));

import { lookupBarcodeInCatalog } from "./barcodeLookup";

const mockedLookup = vi.mocked(lookupBarcodeInCatalog);

describe("normalizeBarcodeInput", () => {
  it("accepts valid EAN-13", () => {
    const result = normalizeBarcodeInput("5901234123457");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.format).toBe("ean13");
  });

  it("rejects empty input", () => {
    expect(normalizeBarcodeInput("  ").ok).toBe(false);
  });
});

describe("parseProductText", () => {
  it("parses name, mrp, and pack size from free text", () => {
    const parsed = parseProductText("Misr 15 Gift Box\nMRP ₹450\n6 pcs per pack");
    expect(parsed.productName).toBe("Misr 15 Gift Box");
    expect(parsed.mrp).toBe("450");
    expect(parsed.qtyPerPack).toBe("6");
  });
});

describe("intakeFromText", () => {
  it("normalizes into canonical draft patch", () => {
    const result = intakeFromText("Cashew Pyramid Baklawa\nMRP 500");
    expect(result.reviewRequired).toBe(true);
    expect(result.draftPatch.productName).toBe("Cashew Pyramid Baklawa");
  });
});

describe("pixel OCR intake", () => {
  beforeEach(() => {
    setOcrPixelExtractorForTests(async () => ({
      text: "Pixel Only Product Name\nMRP 500",
      confidence: 82,
      source: "pixel_ocr",
    }));
  });

  afterEach(() => {
    setOcrPixelExtractorForTests(null);
  });

  it("uses pixel OCR text rather than filename metadata", async () => {
    const file = new File(["pixels"], "generic-scan.jpg", { type: "image/jpeg" });
    const result = await prepareOcrIntakeFromImage(file);
    expect(result.rawInput).toContain("Pixel Only Product Name");
    expect(result.draftPatch.productName).toBe("Pixel Only Product Name");
    expect(result.reviewRequired).toBe(true);
  });

  it("fails safely when pixel OCR returns no text", async () => {
    setOcrPixelExtractorForTests(async () => ({ text: "", confidence: 0, source: "pixel_ocr" }));
    const file = new File(["pixels"], "label.jpg", { type: "image/jpeg" });
    const result = await prepareOcrIntakeFromImage(file);
    expect(result.status).toBe("empty");
    expect(result.draftPatch).toEqual({});
  });

  it("rejects PDF uploads without fabricating OCR success", async () => {
    const file = new File(["pdf"], "label.pdf", { type: "application/pdf" });
    const result = await prepareOcrIntakeFromImage(file);
    expect(result.status).toBe("unsupported");
    expect(intakeBlocksDraftApply(result)).toBe(true);
  });
});

describe("intakeFromOcrText", () => {
  it("keeps OCR suggestions review-required", () => {
    const result = intakeFromOcrText("Baklawa Assortment 12 pcs MRP 650");
    expect(result.mode).toBe("ocr");
    expect(result.reviewRequired).toBe(true);
  });
});

describe("intakeFromVoiceTranscript", () => {
  it("keeps voice suggestions review-required", () => {
    const result = intakeFromVoiceTranscript("Dates chocolate box MRP 300");
    expect(result.mode).toBe("voice");
    expect(result.reviewRequired).toBe(true);
  });
});

describe("intakeFromBarcode regression", () => {
  beforeEach(() => {
    mockedLookup.mockReset();
  });

  it("blocks duplicate barcode with fail-safe", async () => {
    mockedLookup.mockResolvedValue({
      productId: "prod-1",
      productName: "Existing Box",
      sku: "OAS-TEST-001",
      barcode: "5901234123457",
    });

    const result = await intakeFromBarcode("5901234123457");
    expect(result.status).toBe("duplicate_barcode");
    expect(intakeBlocksDraftApply(result)).toBe(true);
  });

  it("accepts new barcode as reviewable suggestion", async () => {
    mockedLookup.mockResolvedValue(null);
    const result = await intakeFromBarcode("5901234123457");
    expect(result.status).toBe("ok");
    expect(result.reviewRequired).toBe(true);
  });
});

describe("applyIntakeToDraft", () => {
  it("merges voice and text into the same draft shape", () => {
    const base = emptyFastCreateDraft();
    const text = applyIntakeToDraft(base, intakeFromText("Misr 15\nMRP 450"));
    const voice = applyIntakeToDraft(base, intakeFromVoiceTranscript("Dates Box MRP 300"));
    expect(text.productName).toBe("Misr 15");
    expect(voice.productName).toBeTruthy();
  });
});
