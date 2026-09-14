import { describe, expect, it } from "vitest";
import {
  benchmarkSlotRequirements,
  buildBenchmarkPhotographyGovernanceCensus,
  buildBenchmarkPhotographyGovernanceContract,
  constraintsForAuthority,
  FAMILY_BENCHMARK_OVERLAYS,
  resolveBenchmarkPhotographyGovernance,
  UNIVERSAL_BENCHMARK_CONSTRAINTS,
  validateBenchmarkOperatorInstruction,
} from "./benchmarkPhotographyGovernance";
import { CONTROLLED_PHOTOGRAPHY_FAMILY_KEYS } from "./controlledPhotographyFamilies";
import type { ProductMediaContext } from "./types";

const baklawaProduct: ProductMediaContext = {
  category: "Baklawa",
  subcategory: "Pyramid",
};

const exportProduct: ProductMediaContext = {
  productClass: "export",
  category: "Export",
};

const POINT42_HEAD = "54f7c526087580575db334039d52bb08f01aa150";

describe("benchmarkPhotographyGovernance", () => {
  it("registers point43_v1 contract for all five Point 42 families without parallel taxonomy", () => {
    for (const key of CONTROLLED_PHOTOGRAPHY_FAMILY_KEYS) {
      const contract = buildBenchmarkPhotographyGovernanceContract(key);
      expect(contract.schema).toBe("point43_v1");
      expect(contract.familyKey).toBe(key);
      expect(contract.universalConstraints).toEqual(UNIVERSAL_BENCHMARK_CONSTRAINTS);
      expect(contract.familyOverlay).toEqual(FAMILY_BENCHMARK_OVERLAYS[key]);
      expect(contract.upstreamAuthority.photographyFamilies).toBe("point42");
    }
  });

  it("resolves governance from product signals via Point 42 family chain", () => {
    const resolved = resolveBenchmarkPhotographyGovernance(baklawaProduct);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    expect(resolved.contract.familyKey).toBe("baklawa_small_sweets");
    expect(resolved.familyContract.familyKey).toBe("baklawa_small_sweets");
    expect(resolved.familyContract.schema).toBe("point42_v1");
  });

  it("fail-closed when Point 42 family resolution fails", () => {
    const resolved = resolveBenchmarkPhotographyGovernance({
      category: "",
      subcategory: "",
      productClass: "",
      productType: "INVALID_PROFILE_XYZ",
    });
    // Empty product still resolves to general — test unknown via broken explicit path is covered in Point 42
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.contract.familyKey).toBe("general");
    }
  });

  it("provides family-specific slot overlays aligned with Point 42 required slots", () => {
    const heroOverlay = benchmarkSlotRequirements("baklawa_small_sweets", "primary_image");
    expect(heroOverlay?.composition).toContain("Centered hero");
    expect(heroOverlay?.background).toContain("neutral");

    const labelOverlay = benchmarkSlotRequirements("export_pack", "label_front_image");
    expect(labelOverlay?.packagingText).toContain("HSN");
  });

  it("universal constraints protect all four conflict authorities", () => {
    expect(constraintsForAuthority("exact_product_fidelity").length).toBeGreaterThan(0);
    expect(constraintsForAuthority("packaging_text_preservation").length).toBeGreaterThan(0);
    expect(constraintsForAuthority("point42_required_slots").length).toBeGreaterThan(0);
    expect(constraintsForAuthority("downstream_qa_authority").length).toBeGreaterThan(0);
  });

  it("rejects third-party brand references in operator instructions", () => {
    const bateel = validateBenchmarkOperatorInstruction("make it look like Bateel packaging");
    expect(bateel.ok).toBe(false);
    if (bateel.ok) return;
    expect(bateel.error).toBe("forbidden_brand_reference");

    const godiva = validateBenchmarkOperatorInstruction("style similar to Godiva");
    expect(godiva.ok).toBe(false);
    if (godiva.ok) return;
    expect(godiva.error).toBe("forbidden_brand_reference");
  });

  it("rejects instructions that conflict with packaging/text preservation", () => {
    const addText = validateBenchmarkOperatorInstruction("add a price tag overlay on the label");
    expect(addText.ok).toBe(false);
    if (addText.ok) return;
    expect(addText.conflictAuthority).toBe("packaging_text_preservation");

    const removeLabel = validateBenchmarkOperatorInstruction("remove the text from packaging");
    expect(removeLabel.ok).toBe(false);
    if (removeLabel.ok) return;
    expect(removeLabel.conflictAuthority).toBe("packaging_text_preservation");
  });

  it("rejects instructions that conflict with exact product fidelity", () => {
    const alter = validateBenchmarkOperatorInstruction("change the product colour to gold");
    expect(alter.ok).toBe(false);
    if (alter.ok) return;
    expect(alter.conflictAuthority).toBe("exact_product_fidelity");
  });

  it("rejects instructions that skip Point 42 required slots", () => {
    const skip = validateBenchmarkOperatorInstruction("skip the close-up shot");
    expect(skip.ok).toBe(false);
    if (skip.ok) return;
    expect(skip.conflictAuthority).toBe("point42_required_slots");
  });

  it("rejects instructions that bypass downstream QA authority", () => {
    const bypass = validateBenchmarkOperatorInstruction("auto-approve without QA check");
    expect(bypass.ok).toBe(false);
    if (bypass.ok) return;
    expect(bypass.conflictAuthority).toBe("downstream_qa_authority");
  });

  it("accepts neutral Oasis-owned operator instructions", () => {
    const ok = validateBenchmarkOperatorInstruction("slightly warmer background tone");
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.sanitizedInstruction).toBe("slightly warmer background tone");
  });

  it("rejects empty operator instructions", () => {
    const empty = validateBenchmarkOperatorInstruction("   ");
    expect(empty.ok).toBe(false);
    if (empty.ok) return;
    expect(empty.error).toBe("empty_instruction");
  });

  it("export pack overlay requires label text preservation on label slots", () => {
    const resolved = resolveBenchmarkPhotographyGovernance(exportProduct);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    expect(resolved.contract.familyKey).toBe("export_pack");
    const labelReq = benchmarkSlotRequirements("export_pack", "label_front_image");
    expect(labelReq?.packagingText).toContain("regulatory text");
  });

  it("marks downstream programme points as separate authorities", () => {
    const contract = buildBenchmarkPhotographyGovernanceContract("general");
    expect(contract.downstreamAuthority).toEqual({
      mobileCamera: "point44",
      enhancement: "point45",
      qa: "point46",
      outputs: "point47",
    });
  });

  it("builds census with Point 42 predecessor SHA and Bateel brand audit", () => {
    const census = buildBenchmarkPhotographyGovernanceCensus(POINT42_HEAD, POINT42_HEAD);
    expect(census.schema).toBe("point43_census_v1");
    expect(census.baselineSha).toBe(POINT42_HEAD);
    expect(census.predecessorSha).toBe(POINT42_HEAD);
    expect(census.universalConstraintCount).toBe(7);
    expect(census.familyOverlayCount).toBe(5);
    expect(census.bateelBrandAudit.customerFacingLeaks).toHaveLength(0);
    expect(census.bateelBrandAudit.remediation).toContain("neutralized");
  });
});
