import { describe, expect, it } from "vitest";
import { normalizeUtterance } from "./normalizeUtterance";
import { resolveProductFromCatalog } from "./resolveProduct";
import type { ResolverCatalog } from "./types";

const PHASE1_CATALOG: ResolverCatalog = {
  products: [
    { id: "c5e84d04-0d8b-4466-8690-a7e6267b44a8", sku: "OAS-AS-BKL-0013", name: "Chocolate Cashew Asiyah" },
    { id: "4af95ba1-ff0f-4740-8869-6a19a41e8c83", sku: "OAS-AS-BKL-0014", name: "Mor Cashew Asiyah" },
    { id: "b0aee1c4-4502-4a15-9880-e2c01378c0b5", sku: "OAS-AS-BKL-0020", name: "Tart Cashew" },
    { id: "cea65af8-129c-4838-988f-30955fa5bc22", sku: "OAS-AS-BKL-0024", name: "Mor Pistachio Durum" },
  ],
  aliases: [
    { alias_text: "mor cashew asiyah", canonical_name: "Mor Cashew Asiyah", product_id: "4af95ba1-ff0f-4740-8869-6a19a41e8c83" },
    { alias_text: "mor kaju asiyah", canonical_name: "Mor Cashew Asiyah", product_id: "4af95ba1-ff0f-4740-8869-6a19a41e8c83" },
    { alias_text: "chocolate cashew asiyah", canonical_name: "Chocolate Cashew Asiyah", product_id: "c5e84d04-0d8b-4466-8690-a7e6267b44a8" },
    { alias_text: "chocolate kaju asiyah", canonical_name: "Chocolate Cashew Asiyah", product_id: "c5e84d04-0d8b-4466-8690-a7e6267b44a8" },
    { alias_text: "tart cashew", canonical_name: "Tart Cashew", product_id: "b0aee1c4-4502-4a15-9880-e2c01378c0b5" },
    { alias_text: "tart kaju", canonical_name: "Tart Cashew", product_id: "b0aee1c4-4502-4a15-9880-e2c01378c0b5" },
    { alias_text: "mor pistachio durum", canonical_name: "Mor Pistachio Durum", product_id: "cea65af8-129c-4838-988f-30955fa5bc22" },
    { alias_text: "cashew assiyah", canonical_name: "Mor Cashew Asiyah", product_id: "4af95ba1-ff0f-4740-8869-6a19a41e8c83" },
    { alias_text: "cashew assiyah", canonical_name: "Chocolate Cashew Asiyah", product_id: "c5e84d04-0d8b-4466-8690-a7e6267b44a8" },
    { alias_text: "cashew high gap baklawa", canonical_name: "Mor Cashew Asiyah", product_id: "4af95ba1-ff0f-4740-8869-6a19a41e8c83" },
    { alias_text: "cashew high gap baklawa", canonical_name: "Chocolate Cashew Asiyah", product_id: "c5e84d04-0d8b-4466-8690-a7e6267b44a8" },
  ],
};

describe("normalizeUtterance", () => {
  it("strips quantities and filler words", () => {
    expect(normalizeUtterance("2 mor kaju asiyah chahiye")).toBe("mor kaju asiyah");
    expect(normalizeUtterance("need tart cashew kg please")).toBe("tart cashew");
  });
});

describe("resolveProductFromCatalog", () => {
  it("resolves unambiguous whatsapp-style keyword", () => {
    const result = resolveProductFromCatalog("mor kaju asiyah", PHASE1_CATALOG);
    expect(result.clarification_required).toBe(false);
    expect(result.matched_sku).toBe("OAS-AS-BKL-0014");
    expect(result.matched_product).toBe("Mor Cashew Asiyah");
    expect(result.confidence).toBeGreaterThanOrEqual(0.72);
  });

  it("resolves SKU directly", () => {
    const result = resolveProductFromCatalog("OAS-AS-BKL-0020", PHASE1_CATALOG);
    expect(result.matched_sku).toBe("OAS-AS-BKL-0020");
    expect(result.clarification_required).toBe(false);
  });

  it("flags cross-SKU ambiguous shared keyword", () => {
    const result = resolveProductFromCatalog("cashew assiyah", PHASE1_CATALOG);
    expect(result.clarification_required).toBe(true);
    expect(result.matched_sku).toBeNull();
    expect(result.candidates.length).toBeGreaterThanOrEqual(2);
  });

  it("flags vague utterance as clarification required", () => {
    const result = resolveProductFromCatalog("cashew box", PHASE1_CATALOG);
    expect(result.clarification_required).toBe(true);
  });

  it("handles empty input", () => {
    const result = resolveProductFromCatalog("   ", PHASE1_CATALOG);
    expect(result.clarification_required).toBe(true);
    expect(result.candidates).toHaveLength(0);
  });
});
