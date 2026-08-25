import { describe, expect, it } from "vitest";
import {
  collapseCandidatesByLogicalGroup,
  logicalGroupKey,
} from "./candidateGrouping";
import { resolveProductUtterance } from "./resolveProductUtterance";
import { PRODUCTION_SNAPSHOT_CATALOG } from "./fixtures/productionSnapshotCatalog";
import {
  isCashewTartFamilyProduct,
  isCashewTartFamilySku,
  isCashewTartFamilyUtterance,
  productFamilyKey,
} from "./productFamilies";
import type { RuntimeCatalog } from "./types";

/** Live production aliases only — no synthetic kaju tart alias on bulk. */
const LIVE_CASHEW_TART_CATALOG: RuntimeCatalog = {
  products: PRODUCTION_SNAPSHOT_CATALOG.products.filter((p) =>
    ["OAS-AS-BKL-0020", "OAS-AS-BKL-CSH-BULK-0003", "OAS-AS-BKL-CSH-BULK-0004"].includes(p.sku),
  ),
  aliases: PRODUCTION_SNAPSHOT_CATALOG.aliases.filter((a) =>
    ["tart kaju", "Kaju Tart Bulk"].includes(a.alias_text),
  ),
};

describe("cashew tart product family", () => {
  it("maps Tart Cashew and Cashew Tart Bulk to the same family key", () => {
    const tartCashew = PRODUCTION_SNAPSHOT_CATALOG.products.find((p) => p.sku === "OAS-AS-BKL-0020")!;
    const bulk = PRODUCTION_SNAPSHOT_CATALOG.products.find((p) => p.sku === "OAS-AS-BKL-CSH-BULK-0004")!;
    expect(productFamilyKey(tartCashew)).toBe("cashew_tart");
    expect(productFamilyKey(bulk)).toBe("cashew_tart");
    expect(logicalGroupKey(tartCashew)).toBe(logicalGroupKey(bulk));
  });

  it("collapses competing family SKUs into one logical group", () => {
    const candidates = [
      {
        product_id: "b0aee1c4-4502-4a15-9880-e2c01378c0b5",
        sku: "OAS-AS-BKL-0020",
        product_name: "Tart Cashew",
        matched_term: "tart kaju",
        match_source: "alias",
        confidence: 1,
      },
      {
        product_id: "dd56eaf7-e80b-4397-9d73-13a966299467",
        sku: "OAS-AS-BKL-CSH-BULK-0004",
        product_name: "Cashew Tart Bulk",
        matched_term: "Kaju Tart Bulk",
        match_source: "alias",
        confidence: 0.95,
      },
    ];
    const { collapsed, logicalGroupCount } = collapseCandidatesByLogicalGroup(
      candidates,
      PRODUCTION_SNAPSHOT_CATALOG,
      "kaju tart",
    );
    expect(logicalGroupCount).toBe(1);
    expect(collapsed).toHaveLength(1);
    expect(isCashewTartFamilySku(collapsed[0].sku)).toBe(true);
  });

  it("treats kaju tart utterance as family phrasing", () => {
    expect(isCashewTartFamilyUtterance("kaju tart")).toBe(true);
    expect(isCashewTartFamilyUtterance("tart kaju")).toBe(true);
    expect(isCashewTartFamilyUtterance("cashew tart")).toBe(true);
    expect(isCashewTartFamilyUtterance("tart cashew")).toBe(true);
  });
});

describe("5-query production smoke (family-aware)", () => {
  const catalog = PRODUCTION_SNAPSHOT_CATALOG;

  it("pista bulbul → HIGH Pistachio Bulbul Bulk", () => {
    const r = resolveProductUtterance("pista bulbul", catalog);
    expect(r.confidence_band).toBe("HIGH");
    expect(r.resolved_sku).toBe("OAS-AS-BKL-PST-BULK-0017");
  });

  it("midya → LOW bulk + gift", () => {
    const r = resolveProductUtterance("midya", catalog);
    expect(r.action).toBe("ask_clarification");
    const skus = r.alternatives.map((a) => a.sku);
    expect(skus).toContain("OAS-AS-BKL-PST-BULK-0016");
    expect(skus).toContain("OAS-AS-BKL-PST-MAAPET-0003");
  });

  it("6 pc midya → HIGH gift pack", () => {
    const r = resolveProductUtterance("6 pc midya", catalog);
    expect(r.confidence_band).toBe("HIGH");
    expect(r.resolved_sku).toBe("OAS-AS-BKL-PST-MAAPET-0003");
  });

  it("kaju tart → HIGH Tart Cashew / Cashew Tart family (live aliases)", () => {
    const r = resolveProductUtterance("kaju tart", LIVE_CASHEW_TART_CATALOG);
    expect(r.confidence_band).toBe("HIGH");
    expect(r.action).toBe("auto_suggest");
    expect(isCashewTartFamilySku(r.resolved_sku)).toBe(true);
    const resolved = catalog.products.find((p) => p.sku === r.resolved_sku);
    expect(resolved && isCashewTartFamilyProduct(resolved)).toBe(true);
  });

  it("frozen kunafa → frozen product", () => {
    const r = resolveProductUtterance("frozen kunafa", catalog);
    expect(["HIGH", "MEDIUM"]).toContain(r.confidence_band);
    expect(r.resolved_name).toContain("Frozen");
  });
});
