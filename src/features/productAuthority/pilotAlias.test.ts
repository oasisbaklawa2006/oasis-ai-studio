import { describe, expect, it } from "vitest";
import { buildAllPilotAliasBundles, buildPilotAliasBundle } from "./pilotAliasEngine";
import {
  checkPilotAliasCollision,
  isBareGenericAlias,
  normalizeAliasText,
  buildCollisionIndex,
} from "./pilotAliasCollision";
import { PILOT_SKUS } from "./skuGuard";

describe("pilotAliasCollision", () => {
  it("rejects bare generic aliases", () => {
    expect(isBareGenericAlias("kitta")).toBe(true);
    expect(isBareGenericAlias("lebanese baklawa")).toBe(true);
    expect(isBareGenericAlias("cashew kitta")).toBe(false);
  });

  it("detects cross-SKU collision", () => {
    const index = buildCollisionIndex([
      { sku: "OAS-AS-BKL-0001", label: "A", alias_text: "cashew kitta" },
      { sku: "OAS-AS-BKL-0007", label: "B", alias_text: "cashew kitta" },
    ]);
    const hit = checkPilotAliasCollision(
      {
        sku: "OAS-AS-BKL-0007",
        product_name: "Cashew Finger",
        alias_text: "cashew kitta",
      },
      index,
    );
    expect(hit.level).toBe("block");
  });
});

describe("pilotAliasEngine", () => {
  it("generates 16 terms per pilot SKU", () => {
    for (const sku of PILOT_SKUS) {
      const bundle = buildPilotAliasBundle(sku);
      expect(bundle.terms).toHaveLength(16);
      expect(bundle.terms.filter((t) => t.alias_type === "whatsapp_keyword")).toHaveLength(5);
      expect(bundle.terms.filter((t) => t.alias_type === "phonetic")).toHaveLength(3);
      expect(bundle.terms.filter((t) => t.alias_type === "sales_term")).toHaveLength(3);
    }
  });

  it("has no duplicate normalized text across pilot SKUs after curation", () => {
    const all = buildAllPilotAliasBundles().flatMap((b) =>
      b.terms.map((t) => ({ sku: t.sku, text: normalizeAliasText(t.alias_text) })),
    );
    const seen = new Map<string, string>();
    for (const row of all) {
      const prev = seen.get(row.text);
      if (prev) {
        expect(prev).toBe(row.sku);
      } else {
        seen.set(row.text, row.sku);
      }
    }
  });

  it("auto-rejects blocked collisions in bundle", () => {
    const bundles = buildAllPilotAliasBundles();
    const rejected = bundles.flatMap((b) => b.terms.filter((t) => t.review_status === "rejected"));
    expect(rejected.length).toBe(0);
  });
});
