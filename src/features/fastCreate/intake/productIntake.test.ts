import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  emptyFastCreateDraft,
  fastCreateFormPatchFromDraft,
} from "@/features/fastCreate/fastCreateDraft";
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

  it("strips scanner terminators before EAN-13 checksum validation", () => {
    const result = normalizeBarcodeInput("5901234123450\t\n");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("checksum");
  });
});

describe("parseProductText", () => {
  it("parses name, mrp, and pack size from free text", () => {
    const parsed = parseProductText("Misr 15 Gift Box\nMRP ₹450\n6 pcs per pack");
    expect(parsed.productName).toBe("Misr 15 Gift Box");
    expect(parsed.mrp).toBe("450");
    expect(parsed.qtyPerPack).toBe("6");
  });

  it("preserves comma-grouped MRP values", () => {
    const parsed = parseProductText("Premium Box\nMRP ₹1,299");
    expect(parsed.mrp).toBe("1299");
  });

  it("does not treat packaging product names as metadata", () => {
    const parsed = parseProductText("Product: Packaging Ribbon");
    expect(parsed.productName).toBe("Packaging Ribbon");
  });

  it("does not infer MRP from B2B Rs values", () => {
    const parsed = parseProductText("Wholesale item\nB2B Rs 80");
    expect(parsed.b2bPrice).toBe("80");
    expect(parsed.mrp).toBeNull();
  });

  it("extracts complete labeled barcodes with separators", () => {
    const parsed = parseProductText("Barcode: 8901 2345 6789 012");
    expect(parsed.barcode).toBe("890123456789012");
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
      outcome: "found",
      hit: {
        productId: "prod-1",
        productName: "Existing Box",
        sku: "OAS-TEST-001",
        barcode: "5901234123457",
      },
    });

    const result = await intakeFromBarcode("5901234123457");
    expect(result.status).toBe("duplicate_barcode");
    expect(intakeBlocksDraftApply(result)).toBe(true);
  });

  it("accepts new barcode as reviewable suggestion", async () => {
    mockedLookup.mockResolvedValue({ outcome: "not_found" });
    const result = await intakeFromBarcode("5901234123457");
    expect(result.status).toBe("ok");
    expect(result.reviewRequired).toBe(true);
    expect(result.draftPatch.intakeBarcode).toBe("5901234123457");
  });

  it("fails closed on catalog lookup errors", async () => {
    mockedLookup.mockResolvedValue({ outcome: "error", message: "connection refused" });
    const result = await intakeFromBarcode("5901234123457");
    expect(result.status).toBe("lookup_failed");
    expect(intakeBlocksDraftApply(result)).toBe(true);
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

  it("preserves scanned barcode through the canonical draft snapshot", async () => {
    mockedLookup.mockResolvedValue({ outcome: "not_found" });
    const intake = await intakeFromBarcode("5901234123457");
    const draft = applyIntakeToDraft(emptyFastCreateDraft(), intake);
    expect(draft.intakeBarcode).toBe("5901234123457");
    expect(fastCreateFormPatchFromDraft(draft).intake_barcode).toBe("5901234123457");
  });
});
