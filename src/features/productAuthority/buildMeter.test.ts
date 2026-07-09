import { describe, expect, it } from "vitest";
import { BUILD_METER_THRESHOLD, getBuildMeterStatus, getMissingFieldChips } from "./buildMeter";

describe("getBuildMeterStatus", () => {
  it("flags scores below 70 as not meeting the threshold", () => {
    const status = getBuildMeterStatus(69);
    expect(status.meetsThreshold).toBe(false);
    expect(status.headline).toBe("Needs more fields");
  });

  it("flags scores at or above 70 as meeting the threshold", () => {
    expect(getBuildMeterStatus(70).meetsThreshold).toBe(true);
    expect(getBuildMeterStatus(100).meetsThreshold).toBe(true);
    expect(getBuildMeterStatus(70).headline).toBe("Ready for catalogue draft");
  });

  it("clamps out-of-range scores", () => {
    expect(getBuildMeterStatus(-10).score).toBe(0);
    expect(getBuildMeterStatus(150).score).toBe(100);
  });

  it("exposes the 70% benchmark constant used by the detail label", () => {
    expect(BUILD_METER_THRESHOLD).toBe(70);
    expect(getBuildMeterStatus(70).detail).toContain("70%");
  });
});

describe("getMissingFieldChips", () => {
  const categories = [
    { key: "identity", label: "Identity", state: "pass" as const, nextAction: null },
    { key: "sku", label: "SKU", state: "missing" as const, nextAction: "Generate a SKU." },
    { key: "pricing", label: "Pricing", state: "warn" as const, nextAction: "Set MRP." },
    { key: "hero_image", label: "Hero Image", state: "missing" as const, nextAction: "Add an image." },
  ];

  it("surfaces missing fields before warn fields", () => {
    const chips = getMissingFieldChips(categories);
    expect(chips.map((c) => c.key)).toEqual(["sku", "hero_image", "pricing"]);
  });

  it("excludes passing categories", () => {
    const chips = getMissingFieldChips(categories);
    expect(chips.find((c) => c.key === "identity")).toBeUndefined();
  });

  it("respects the limit", () => {
    expect(getMissingFieldChips(categories, 1)).toHaveLength(1);
  });
});
