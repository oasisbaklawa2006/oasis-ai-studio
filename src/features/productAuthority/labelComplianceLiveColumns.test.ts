import { describe, expect, it } from "vitest";
import {
  evaluateLiveLegalLabelFields,
  POINT_37_LIVE_PRODUCT_COLUMNS,
} from "./labelComplianceLiveColumns";

describe("evaluateLiveLegalLabelFields", () => {
  it("passes when all live Core columns are populated with non-placeholder values", () => {
    const results = evaluateLiveLegalLabelFields({
      fssai_licence_number: "10020030040005",
      country_of_origin: "India",
      label_manufacturer_details: "Oasis Baklawa Pvt Ltd, Mumbai",
    });
    expect(results.every((r) => r.state === "pass")).toBe(true);
    expect(results.flatMap((r) => r.publicationBlockers)).toEqual([]);
  });

  it("fail-closed on null/blank values", () => {
    const results = evaluateLiveLegalLabelFields({
      fssai_licence_number: "",
      country_of_origin: "India",
      label_manufacturer_details: "   ",
    });
    expect(results.find((r) => r.field === "fssai_licence_number")?.state).toBe("missing");
    expect(results.find((r) => r.field === "label_manufacturer_details")?.state).toBe("missing");
    expect(results.some((r) => r.publicationBlockers.length > 0)).toBe(true);
  });

  it("rejects placeholder values as invalid", () => {
    const results = evaluateLiveLegalLabelFields({
      fssai_licence_number: "TBD",
      country_of_origin: "India",
      label_manufacturer_details: "Oasis Baklawa Pvt Ltd",
    });
    expect(results.find((r) => r.field === "fssai_licence_number")?.state).toBe("invalid");
    expect(
      results.find((r) => r.field === "fssai_licence_number")?.publicationBlockers[0],
    ).toContain("placeholder");
  });

  it("covers the three live Point37 product columns", () => {
    expect(POINT_37_LIVE_PRODUCT_COLUMNS).toEqual([
      "fssai_licence_number",
      "country_of_origin",
      "label_manufacturer_details",
    ]);
  });
});
