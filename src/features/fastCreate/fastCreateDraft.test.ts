import { describe, expect, it } from "vitest";
import {
  emptyFastCreateDraft,
  fastCreateFormPatchFromDraft,
  fastCreateReadinessCategories,
  fastCreateReadinessScore,
  heroPreviewFromDraft,
  type FastCreateDraftSnapshot,
} from "./fastCreateDraft";

function misr15Draft(): FastCreateDraftSnapshot {
  return {
    ...emptyFastCreateDraft(),
    productName: "Misr 15",
    categoryKey: "ready_packs",
    saleType: "retail_ready_pack",
    packagingCode: "PAPERBOX",
    packagingLabel: "Printed Paper Box",
    qtyPerPack: "6",
    mrp: "450",
    b2bPrice: "",
    heroUrl: "https://x/hero.jpg",
    resolvedSku: "OAS-AS-BKL-ASS-PAPERBOX-0002",
  };
}

describe("fastCreateReadinessCategories — adaptive required fields", () => {
  it("retail ready pack requires packaging, qty per pack, MRP, hero", () => {
    const keys = fastCreateReadinessCategories(misr15Draft()).map((c) => c.key);
    expect(keys).toEqual(expect.arrayContaining(["packaging", "qty_per_pack", "mrp", "hero"]));
    expect(keys).not.toContain("b2b_price");
  });

  it("adds B2B price requirement when B2B is enabled", () => {
    const keys = fastCreateReadinessCategories({ ...misr15Draft(), b2bEnabled: true }).map((c) => c.key);
    expect(keys).toContain("b2b_price");
  });

  it("internal/BOM products require neither price, packaging, nor image", () => {
    const keys = fastCreateReadinessCategories({ ...emptyFastCreateDraft(), saleType: "internal_bom" }).map(
      (c) => c.key,
    );
    expect(keys).not.toContain("mrp");
    expect(keys).not.toContain("packaging");
    expect(keys).not.toContain("hero");
  });

  it("export drafts flag export details as complete-in-Full-Editor, not blocking", () => {
    const categories = fastCreateReadinessCategories({ ...emptyFastCreateDraft(), saleType: "export" });
    const exportCat = categories.find((c) => c.key === "export_fields");
    expect(exportCat?.state).toBe("warn");
  });

  it("complete Misr 15 draft scores at/above the catalogue threshold", () => {
    const categories = fastCreateReadinessCategories(misr15Draft());
    expect(fastCreateReadinessScore(categories)).toBeGreaterThanOrEqual(70);
  });

  it("empty draft scores as draft-only", () => {
    const categories = fastCreateReadinessCategories(emptyFastCreateDraft());
    expect(fastCreateReadinessScore(categories)).toBeLessThan(70);
  });
});

describe("fastCreateFormPatchFromDraft — Full Editor handoff", () => {
  it("carries name, class, sku, packaging, qty, prices, and image", () => {
    const patch = fastCreateFormPatchFromDraft(misr15Draft());
    expect(patch.product_name).toBe("Misr 15");
    expect(patch.product_class).toBe("ready_pack");
    expect(patch.sku).toBe("OAS-AS-BKL-ASS-PAPERBOX-0002");
    expect(patch.packaging_code).toBe("PAPERBOX");
    expect(patch.pcs_per_pack).toBe("6");
    expect(patch.mrp).toBe("450");
    expect(patch.hero_image_url).toBe("https://x/hero.jpg");
  });

  it("derives the label starter from pack data", () => {
    const patch = fastCreateFormPatchFromDraft(misr15Draft());
    expect(String(patch.pack_size)).toContain("6 pcs");
    expect(String(patch.pack_size)).toContain("Printed Paper Box");
  });

  it("operator-edited description overrides the generated one", () => {
    const patch = fastCreateFormPatchFromDraft({ ...misr15Draft(), editedDescription: "My own words." });
    expect(patch.description).toBe("My own words.");
  });

  it("omits blank prices instead of writing zeros", () => {
    const patch = fastCreateFormPatchFromDraft({ ...misr15Draft(), mrp: "", b2bPrice: "0" });
    expect(patch).not.toHaveProperty("mrp");
    expect(patch).not.toHaveProperty("b2b_price");
  });
});

describe("heroPreviewFromDraft (Defect 6 regression — restored draft hides hero preview)", () => {
  it("restores the preview from a stored hero URL", () => {
    expect(heroPreviewFromDraft(misr15Draft())).toBe("https://x/hero.jpg");
  });

  it("clears the preview when the restored draft has no image", () => {
    expect(heroPreviewFromDraft({ ...misr15Draft(), heroUrl: null })).toBeNull();
  });

  it("reflects a replaced hero URL rather than an earlier one", () => {
    const replaced = { ...misr15Draft(), heroUrl: "https://x/new-hero.jpg" };
    expect(heroPreviewFromDraft(replaced)).toBe("https://x/new-hero.jpg");
  });
});
