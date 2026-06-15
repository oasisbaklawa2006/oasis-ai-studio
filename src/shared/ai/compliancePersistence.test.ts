import { describe, expect, it } from "vitest";
import {
  buildComplianceMetaFromSavedProduct,
  deriveComplianceApprovedForReadiness,
} from "./compliancePersistence";

describe("compliancePersistence", () => {
  it("marks persisted DB columns as approved manual meta", () => {
    const meta = buildComplianceMetaFromSavedProduct({
      hsn_code: "18069090",
      gst_rate: "5",
      shelf_life_days: "180",
    });
    expect(meta.hsn_code?.approved).toBe(true);
    expect(meta.gst_rate?.approved).toBe(true);
  });

  it("does not auto-approve UI-only ingredients text", () => {
    const meta = buildComplianceMetaFromSavedProduct({
      ingredients: "Cashew, sugar",
    });
    expect(meta.ingredients?.approved).toBe(false);
  });

  it("derives list readiness compliance from saved HSN+GST", () => {
    expect(deriveComplianceApprovedForReadiness({ hsn_code: "1", gst_rate: "5" })).toBe(true);
    expect(deriveComplianceApprovedForReadiness({ hsn_code: "1" })).toBe(false);
  });
});
