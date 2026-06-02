import { describe, expect, it } from "vitest";
import {
  buildSuggestionPayload,
  canApproveComplianceFieldsFromRoles,
  stripUnapprovedComplianceFields,
} from "./aiComplianceSafety";
import { createAiSuggestionFieldMeta } from "@/shared/ai/complianceApproval";

describe("aiComplianceSafety", () => {
  it("buildSuggestionPayload marks output suggestion_only and not approved", () => {
    const res = buildSuggestionPayload({ hsn_code: "18069090", gst_rate: "5" });
    expect(res.suggestion_only).toBe(true);
    expect(res.approved).toBe(false);
    expect(res.disclaimer.toLowerCase()).toContain("gst/hsn");
  });

  it("stripUnapprovedComplianceFields restores baseline for unapproved AI GST/HSN", () => {
    const baseline = { hsn_code: "1111", gst_rate: "5" };
    const form = {
      product_name: "Cashew Pyramid",
      hsn_code: "99999999",
      gst_rate: "18",
    };
    const meta = {
      hsn_code: createAiSuggestionFieldMeta(),
      gst_rate: createAiSuggestionFieldMeta(),
    };
    const safe = stripUnapprovedComplianceFields(form, ["catalogue_contributor"], baseline, meta);
    expect(safe.hsn_code).toBe("1111");
    expect(safe.gst_rate).toBe("5");
    expect(safe.product_name).toBe("Cashew Pyramid");
  });

  it("contributor cannot approve compliance fields", () => {
    expect(canApproveComplianceFieldsFromRoles(["catalogue_contributor"])).toBe(false);
  });

  it("owner/admin/product_manager can approve compliance fields", () => {
    expect(canApproveComplianceFieldsFromRoles(["owner"])).toBe(true);
    expect(canApproveComplianceFieldsFromRoles(["admin"])).toBe(true);
    expect(canApproveComplianceFieldsFromRoles(["product_manager"])).toBe(true);
  });
});
