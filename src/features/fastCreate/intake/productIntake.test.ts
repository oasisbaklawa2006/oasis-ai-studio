import { describe, expect, it, vi, beforeEach } from "vitest";
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
} from "./index";
import { emptyFastCreateDraft } from "@/features/fastCreate/fastCreateDraft";

vi.mock("./barcodeLookup", () => ({
  lookupBarcodeInCatalog: vi.fn(),
  toDuplicateHit: vi.fn((hit: { productId: string; productName: string; sku: string | null; barcode: string }) => ({
    productId: hit.productId,
    label: hit.sku ? `${hit.productName} (${hit.sku})` : hit.productName,
    barcode: hit.barcode,
  })),
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

  it("rejects invalid checksum", () => {
    expect(normalizeBarcodeInput("5901234123450").ok).toBe(false);
  });
});

describe("parseProductText", () => {
  it("parses name, mrp, and pack size from free text", () => {
    const parsed = parseProductText("Misr 15 Gift Box\nMRP ₹450\n6 pcs per pack");
    expect(parsed.productName).toBe("Misr 15 Gift Box");
    expect(parsed.mrp).toBe("450");
    expect(parsed.qtyPerPack).toBe("6");
  });

  it("detects Oasis SKU tokens", () => {
    const parsed = parseProductText("SKU OAS-AS-BKL-ASS-PAPERBOX-0002");
    expect(parsed.sku).toBe("OAS-AS-BKL-ASS-PAPERBOX-0002");
  });

  it("returns empty fields for blank input", () => {
    const parsed = parseProductText("   ");
    expect(parsed.productName).toBeNull();
  });
});

describe("intakeFromText", () => {
  it("normalizes into canonical draft patch", () => {
    const result = intakeFromText("Cashew Pyramid Baklawa\nMRP 500");
    expect(result.mode).toBe("text");
    expect(result.reviewRequired).toBe(true);
    expect(result.draftPatch.productName).toBe("Cashew Pyramid Baklawa");
    expect(result.draftPatch.mrp).toBe("500");
  });

  it("returns empty status for unsupported input", () => {
    const result = intakeFromText("");
    expect(result.status).toBe("empty");
  });

  it("flags ambiguous when name missing", () => {
    const result = intakeFromText("MRP 450 only");
    expect(result.status).toBe("ambiguous");
  });
});

describe("intakeFromVoiceTranscript", () => {
  it("uses the same canonical shape as text intake", () => {
    const result = intakeFromVoiceTranscript("Dates chocolate box MRP 300");
    expect(result.mode).toBe("voice");
    expect(result.reviewRequired).toBe(true);
    expect(result.draftPatch.productName).toBeTruthy();
  });
});

describe("intakeFromOcrText", () => {
  it("never auto-publishes — always review required", () => {
    const result = intakeFromOcrText("Baklawa Assortment 12 pcs MRP 650");
    expect(result.mode).toBe("ocr");
    expect(result.reviewRequired).toBe(true);
    expect(result.draftPatch.productName).toContain("Baklawa");
  });

  it("handles empty OCR text", () => {
    expect(intakeFromOcrText("").status).toBe("empty");
  });
});

describe("prepareOcrIntakeFromImage", () => {
  it("uses filename hints with low confidence", () => {
    const file = new File(["x"], "cashew-pyramid-box.jpg", { type: "image/jpeg" });
    const result = prepareOcrIntakeFromImage(file);
    expect(result.mode).toBe("ocr");
    expect(result.reviewRequired).toBe(true);
    expect(result.status).toBe("ambiguous");
  });
});

describe("intakeFromBarcode", () => {
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
    expect(result.duplicateHit?.productId).toBe("prod-1");
    expect(intakeBlocksDraftApply(result)).toBe(true);
  });

  it("accepts new barcode as reviewable suggestion", async () => {
    mockedLookup.mockResolvedValue(null);
    const result = await intakeFromBarcode("5901234123457");
    expect(result.status).toBe("ok");
    expect(result.barcode).toBe("5901234123457");
    expect(result.reviewRequired).toBe(true);
  });

  it("rejects unsupported barcode input", async () => {
    const result = await intakeFromBarcode("!!!");
    expect(result.status).toBe("unsupported");
  });
});

describe("applyIntakeToDraft — cross-mode normalization", () => {
  it("merges text, voice, and OCR patches into the same draft shape", () => {
    const base = emptyFastCreateDraft();
    const text = applyIntakeToDraft(base, intakeFromText("Misr 15\nMRP 450"));
    const voice = applyIntakeToDraft(base, intakeFromVoiceTranscript("Dates Box MRP 300"));
    const ocr = applyIntakeToDraft(base, intakeFromOcrText("Cashew Pyramid MRP 500"));

    expect(text.productName).toBe("Misr 15");
    expect(text.mrp).toBe("450");
    expect(voice.productName).toBeTruthy();
    expect(ocr.productName).toContain("Cashew");
  });

  it("does not apply duplicate barcode intake", async () => {
    mockedLookup.mockResolvedValue({
      productId: "prod-1",
      productName: "Existing",
      sku: "OAS-1",
      barcode: "5901234123457",
    });
    const blocked = await intakeFromBarcode("5901234123457");
    const next = applyIntakeToDraft(emptyFastCreateDraft(), blocked);
    expect(next.productName).toBe("");
  });
});
