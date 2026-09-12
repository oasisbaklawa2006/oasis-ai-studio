import { afterEach, describe, expect, it } from "vitest";
import {
  buildControlledPhotographyFamilyContract,
  buildPhotographyFamilyCensus,
  CONTROLLED_PHOTOGRAPHY_FAMILY_KEYS,
  getPhotographyFamilyRequirements,
  isControlledPhotographyFamilyKey,
  mapUploaderTypeToReadinessSlot,
  requireControlledPhotographyFamilyKey,
  resolveControlledPhotographyFamily,
} from "./controlledPhotographyFamilies";
import type { ProductMediaContext } from "./types";

function withMode(mode: string, fn: () => void) {
  const prev = import.meta.env.VITE_MEDIA_GOVERNANCE_MODE;
  import.meta.env.VITE_MEDIA_GOVERNANCE_MODE = mode;
  try {
    fn();
  } finally {
    import.meta.env.VITE_MEDIA_GOVERNANCE_MODE = prev;
  }
}

afterEach(() => {
  import.meta.env.VITE_MEDIA_GOVERNANCE_MODE = "testing";
});

const baklawaProduct: ProductMediaContext = {
  category: "Baklawa",
  subcategory: "Pyramid",
};

const giftProduct: ProductMediaContext = {
  productClass: "ready_pack",
  subcategory: "Acrylic Box",
};

const exportProduct: ProductMediaContext = {
  productClass: "export",
  category: "Export",
};

const hamperProduct: ProductMediaContext = {
  productClass: "gift_hamper",
  category: "Hamper",
};

describe("controlledPhotographyFamilies", () => {
  it("registers exactly five canonical families aligned with ProductMediaProfile", () => {
    expect(CONTROLLED_PHOTOGRAPHY_FAMILY_KEYS).toEqual([
      "baklawa_small_sweets",
      "gift_box",
      "export_pack",
      "hamper",
      "general",
    ]);
    for (const key of CONTROLLED_PHOTOGRAPHY_FAMILY_KEYS) {
      expect(isControlledPhotographyFamilyKey(key)).toBe(true);
      expect(buildControlledPhotographyFamilyContract(key).schema).toBe("point42_v1");
    }
  });

  it("fail-closed on unknown explicit family keys", () => {
    expect(isControlledPhotographyFamilyKey("unknown_family")).toBe(false);
    expect(() => requireControlledPhotographyFamilyKey("unknown_family")).toThrow(
      /Unknown controlled photography family/,
    );
  });

  it("fail-closed on unknown uploader types", () => {
    const mapped = mapUploaderTypeToReadinessSlot("hero_image");
    expect(mapped.ok).toBe(true);
    if (mapped.ok) expect(mapped.slot).toBe("primary_image");

    const unknown = mapUploaderTypeToReadinessSlot("not_a_real_slot");
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.error).toBe("unknown_uploader_type");
  });

  it("resolves baklawa family with hero + white background + close-up requirements in production", () => {
    withMode("production", () => {
      const resolved = resolveControlledPhotographyFamily(baklawaProduct);
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;

      expect(resolved.contract.familyKey).toBe("baklawa_small_sweets");
      const requiredTypes = resolved.contract.requiredSlots.map((s) => s.readinessSlot);
      expect(requiredTypes).toEqual(["primary_image", "catalogue_image", "close_up_image"]);

      const req = getPhotographyFamilyRequirements(baklawaProduct);
      expect(req).toMatchObject({
        familyKey: "baklawa_small_sweets",
        governanceMode: "production",
      });
      if ("ok" in req && req.ok === false) throw new Error(req.message);
      if ("familyKey" in req) {
        expect(req.requiredSlots.map((s) => s.readinessSlot)).toEqual(requiredTypes);
      }
    });
  });

  it("resolves gift box family with closed/open pack requirements in production", () => {
    withMode("production", () => {
      const resolved = resolveControlledPhotographyFamily(giftProduct);
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;

      expect(resolved.contract.familyKey).toBe("gift_box");
      const requiredTypes = resolved.contract.requiredSlots.map((s) => s.readinessSlot);
      expect(requiredTypes).toContain("pack_front_image");
      expect(requiredTypes).toContain("open_pack_image");
      expect(requiredTypes).toContain("primary_image");
    });
  });

  it("resolves export pack family with label and carton requirements in production", () => {
    withMode("production", () => {
      const resolved = resolveControlledPhotographyFamily(exportProduct);
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;

      expect(resolved.contract.familyKey).toBe("export_pack");
      const requiredTypes = resolved.contract.requiredSlots.map((s) => s.readinessSlot);
      expect(requiredTypes).toContain("label_front_image");
      expect(requiredTypes).toContain("packaging_reference");
      expect(requiredTypes).toContain("master_carton_image");
    });
  });

  it("resolves hamper family with arrangement + close-up + hero in production", () => {
    withMode("production", () => {
      const resolved = resolveControlledPhotographyFamily(hamperProduct);
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;

      expect(resolved.contract.familyKey).toBe("hamper");
      const requiredTypes = resolved.contract.requiredSlots.map((s) => s.readinessSlot);
      expect(requiredTypes).toContain("hamper_arrangement_image");
      expect(requiredTypes).toContain("close_up_image");
      expect(requiredTypes).toContain("primary_image");
    });
  });

  it("maps readiness slots to governed SOP prompt keys without inventing new templates", () => {
    const contract = buildControlledPhotographyFamilyContract("baklawa_small_sweets");
    const hero = contract.requiredSlots.find((s) => s.readinessSlot === "primary_image");
    const white = contract.requiredSlots.find((s) => s.readinessSlot === "catalogue_image");
    const close = contract.requiredSlots.find((s) => s.readinessSlot === "close_up_image");

    expect(hero?.sopPromptKey).toBe("hero_image_prompt");
    expect(white?.sopPromptKey).toBe("square_image_prompt");
    expect(close?.sopPromptKey).toBe("closeup_image_prompt");
  });

  it("testing governance mode reduces requirements to hero-only while keeping family identity", () => {
    withMode("testing", () => {
      const req = getPhotographyFamilyRequirements(baklawaProduct);
      if ("ok" in req && req.ok === false) throw new Error(req.message);
      if ("familyKey" in req) {
        expect(req.familyKey).toBe("baklawa_small_sweets");
        expect(req.requiredSlots.flatMap((s) => s.uploaderTypes)).toEqual(["hero_image"]);
      }
    });
  });

  it("marks downstream programme points as separate authorities", () => {
    const contract = buildControlledPhotographyFamilyContract("general");
    expect(contract.downstreamAuthority).toEqual({
      bateelGovernance: "point43",
      mobileCamera: "point44",
      enhancement: "point45",
      qa: "point46",
      outputs: "point47",
    });
  });

  it("builds a census snapshot with baseline SHA and surface paths", () => {
    const census = buildPhotographyFamilyCensus("6f8e16417dcef2323d833072d23a92a32b87a833");
    expect(census.schema).toBe("point42_census_v1");
    expect(census.baselineSha).toBe("6f8e16417dcef2323d833072d23a92a32b87a833");
    expect(census.families).toHaveLength(5);
    expect(census.surfaces.readinessProfiles).toContain("readinessProfiles.ts");
    expect(census.bateelOverlap).toContain("Point 43");
  });
});
