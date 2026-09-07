import { describe, expect, it } from "vitest";
import type { PackagingTaxonomyAuthority } from "./catalogueReadyGate";
import {
  evaluateArtworkLabelAssets,
  evaluateBarcodeLinkage,
  evaluateHierarchyLabelReadiness,
  evaluatePackagingLabelReadiness,
  evaluatePackagingTypeAuthority,
} from "./packagingLabelReadinessCanonical";

const PACKAGING_AUTHORITY: PackagingTaxonomyAuthority = {
  activeCodes: new Set(["PAPERBOX", "TIN"]),
};

const COMPLETE_FORM: Record<string, unknown> = {
  product_name: "Cashew Pyramid Baklawa",
  category: "Baklawa",
  shelf_life_days: 30,
  storage_instructions: "Store in a cool, dry place.",
  pack_size: "500g box",
  net_weight_g: 500,
  pcs_per_pack: 6,
  packaging_code: "PAPERBOX",
  sku: "OAS-AS-BKL-ASS-PAPERBOX-0002",
  primary_pack_type: "Box",
  carton_qty: 4,
  carton_uom: "carton",
  barcode_sku: "5901234123457",
  fssai_licence_number: "10020030040005",
  country_of_origin: "India",
  label_manufacturer_details: "Oasis Baklawa Pvt Ltd",
};

describe("evaluatePackagingTypeAuthority", () => {
  it("accepts active taxonomy packaging_code", () => {
    const result = evaluatePackagingTypeAuthority(
      COMPLETE_FORM,
      "retail_ready_pack",
      PACKAGING_AUTHORITY,
    );
    expect(result.state).toBe("complete");
    expect(result.publicationBlockers).toEqual([]);
  });

  it("fail-closed on shadow-only pack_size without packaging_code", () => {
    const result = evaluatePackagingTypeAuthority(
      { pack_size: "6 pcs box", primary_pack_type: "Box" },
      "retail_ready_pack",
      PACKAGING_AUTHORITY,
    );
    expect(result.state).toBe("shadow_only");
    expect(result.publicationBlockers.join(" ")).toContain("taxonomy packaging_code");
  });

  it("blocks inactive packaging code", () => {
    const result = evaluatePackagingTypeAuthority(
      { ...COMPLETE_FORM, packaging_code: "RETIRED" },
      "retail_ready_pack",
      PACKAGING_AUTHORITY,
    );
    expect(result.state).toBe("invalid");
    expect(result.publicationBlockers.join(" ")).toContain("not an active taxonomy");
  });

  it("defers for internal BOM products", () => {
    const result = evaluatePackagingTypeAuthority({}, "internal_bom", PACKAGING_AUTHORITY);
    expect(result.state).toBe("not_required");
  });
});

describe("evaluateHierarchyLabelReadiness", () => {
  it("passes sellable pack when qty and type are present", () => {
    const levels = evaluateHierarchyLabelReadiness(COMPLETE_FORM, "retail_ready_pack");
    const sellable = levels.find((l) => l.level === "sellable_pack");
    expect(sellable?.state).toBe("pass");
  });

  it("blocks missing sellable pack qty for customer-facing products", () => {
    const levels = evaluateHierarchyLabelReadiness(
      { product_name: "Test", packaging_code: "PAPERBOX", primary_pack_type: "Box" },
      "retail_ready_pack",
    );
    const sellable = levels.find((l) => l.level === "sellable_pack");
    expect(sellable?.state).toBe("missing");
    expect(sellable?.publicationBlockers.length).toBeGreaterThan(0);
  });

  it("requires inner carton when fixed_carton_required", () => {
    const levels = evaluateHierarchyLabelReadiness(
      { ...COMPLETE_FORM, carton_qty: null, pcs_per_carton: null, fixed_carton_required: true },
      "b2b_horeca",
    );
    const inner = levels.find((l) => l.level === "inner_carton");
    expect(inner?.state).toBe("missing");
  });
});

describe("evaluateArtworkLabelAssets", () => {
  it("requires export artwork slots for export sale type", () => {
    const result = evaluateArtworkLabelAssets("export", []);
    expect(result.state).toBe("missing");
    expect(result.publicationBlockers.join(" ")).toContain("artwork");
  });

  it("emits customer-facing artwork blocker when all required slots are missing for retail", () => {
    const result = evaluateArtworkLabelAssets("retail_ready_pack", []);
    expect(result.state).toBe("missing");
    expect(result.publicationBlockers).toContain(
      "Label artwork incomplete — missing: packaging_reference",
    );
  });

  it("passes when required export slots are approved", () => {
    const result = evaluateArtworkLabelAssets("export", [
      {
        type: "label_front_image",
        url: "https://example.com/label.png",
        status: "approved",
        source: "manual",
      },
      {
        type: "packaging_reference",
        url: "https://example.com/pack.png",
        status: "approved",
        source: "manual",
      },
    ]);
    expect(result.state).toBe("complete");
    expect(result.publicationBlockers).toEqual([]);
  });
});

describe("evaluateBarcodeLinkage", () => {
  it("validates EAN-13 checksum on barcode_sku", () => {
    const result = evaluateBarcodeLinkage({ barcode_sku: "5901234123457" }, "export");
    expect(result.state).toBe("complete");
    expect(result.format).toBe("ean13");
  });

  it("blocks invalid barcode format", () => {
    const result = evaluateBarcodeLinkage({ barcode_sku: "1234567890123" }, "export");
    expect(result.state).toBe("invalid");
    expect(result.publicationBlockers.length).toBeGreaterThan(0);
  });

  it("requires barcode for export products", () => {
    const result = evaluateBarcodeLinkage({}, "export");
    expect(result.state).toBe("missing");
    expect(result.publicationBlockers.join(" ")).toContain("Barcode/EAN missing");
  });
});

describe("evaluatePackagingLabelReadiness", () => {
  it("never reaches ready_for_label_design while legal schema gaps exist (fail-closed)", () => {
    const result = evaluatePackagingLabelReadiness({
      form: COMPLETE_FORM,
      saleType: "retail_ready_pack",
      packagingAuthority: PACKAGING_AUTHORITY,
      mediaAssets: [
        {
          type: "packaging_reference",
          url: "https://example.com/pack.png",
          status: "approved",
          source: "manual",
        },
      ],
    });
    expect(result.readyForLabelDesign).toBe(false);
    expect(result.publicationBlockers.some((b) => b.includes("no column"))).toBe(true);
    expect(result.snapshot.schema).toBe("point37_v2");
    expect(result.snapshot.live_legal_fields).toHaveLength(3);
    expect(result.snapshot.core_production_release.release_run).toBe("34034910469");
  });

  it("documents remaining Core dependencies after live trio recert", () => {
    const result = evaluatePackagingLabelReadiness({
      form: COMPLETE_FORM,
      saleType: "retail_ready_pack",
      packagingAuthority: PACKAGING_AUTHORITY,
    });
    expect(result.snapshot.legal_label_gaps.core_dependencies).toEqual(
      expect.arrayContaining([
        "products.batch_lot_number",
        "products.veg_nonveg_indicator",
        "products.label_mrp (label-grade)",
      ]),
    );
    expect(result.snapshot.legal_label_gaps.core_dependencies).not.toContain(
      "products.fssai_licence_number (or equivalent label-compliance column bundle)",
    );
  });

  it("blocks customer-facing products with missing live legal fields", () => {
    const result = evaluatePackagingLabelReadiness({
      form: { ...COMPLETE_FORM, fssai_licence_number: "", country_of_origin: null },
      saleType: "retail_ready_pack",
      packagingAuthority: PACKAGING_AUTHORITY,
    });
    expect(result.publicationBlockers.some((b) => b.includes("FSSAI Licence Number missing"))).toBe(
      true,
    );
  });

  it("does not require live legal fields for internal BOM products", () => {
    const result = evaluatePackagingLabelReadiness({
      form: {},
      saleType: "internal_bom",
      packagingAuthority: PACKAGING_AUTHORITY,
    });
    expect(result.publicationBlockers.some((b) => b.includes("FSSAI Licence Number missing"))).toBe(
      false,
    );
  });

  it("aggregates packaging type blockers into snapshot", () => {
    const result = evaluatePackagingLabelReadiness({
      form: { pack_size: "500g" },
      saleType: "retail_ready_pack",
      packagingAuthority: PACKAGING_AUTHORITY,
    });
    expect(result.snapshot.packaging_type.state).toBe("shadow_only");
    expect(result.publicationBlockers.length).toBeGreaterThan(0);
  });
});
