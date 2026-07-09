import { describe, expect, it } from "vitest";
import { deriveShortSku } from "./shortSku";

describe("deriveShortSku", () => {
  it("derives category + sequence from a full structured SKU", () => {
    expect(deriveShortSku("OAS-FS-FUS-ASS-BULK-0002")).toBe("FUS-0002");
  });

  it("is deterministic for the same input", () => {
    const sku = "OAS-AS-BKL-ASS-LOOSE-0001";
    expect(deriveShortSku(sku)).toBe(deriveShortSku(sku));
  });

  it("handles a short/unusual SKU without throwing", () => {
    expect(deriveShortSku("AB-12")).toBe("12-12");
    expect(deriveShortSku("SINGLESEGMENT")).toBe("SINGLESEGMENT");
    expect(deriveShortSku("")).toBe("");
  });

  it("uppercases and trims input", () => {
    expect(deriveShortSku(" oas-as-bkl-ass-loose-0001 ")).toBe("BKL-0001");
  });
});
