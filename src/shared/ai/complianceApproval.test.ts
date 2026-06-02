import { describe, expect, it } from "vitest";
import {
  approveComplianceFieldMeta,
  canApproveComplianceFields,
  createAiSuggestionFieldMeta,
  isComplianceFieldApproved,
  prepareFormForComplianceSave,
  stripComplianceFromDraftPayload,
} from "./complianceApproval";

describe("complianceApproval", () => {
  const baseline = { hsn_code: "1234", gst_rate: "5" };

  it("blocks unapproved AI GST/HSN on save for contributors", () => {
    const form = { hsn_code: "99999999", gst_rate: "18", product_name: "Test" };
    const meta = {
      hsn_code: createAiSuggestionFieldMeta(),
      gst_rate: createAiSuggestionFieldMeta(),
    };
    const safe = prepareFormForComplianceSave(form, ["catalogue_contributor"], baseline, meta);
    expect(safe.hsn_code).toBe("1234");
    expect(safe.gst_rate).toBe("5");
  });

  it("allows approved compliance fields for product_manager", () => {
    const form = { hsn_code: "99999999", gst_rate: "18" };
    const meta = {
      hsn_code: approveComplianceFieldMeta(createAiSuggestionFieldMeta(), "product_manager"),
      gst_rate: approveComplianceFieldMeta(createAiSuggestionFieldMeta(), "product_manager"),
    };
    const safe = prepareFormForComplianceSave(form, ["product_manager"], baseline, meta);
    expect(safe.hsn_code).toBe("99999999");
    expect(safe.gst_rate).toBe("18");
  });

  it("denies unauthorized roles from approving compliance", () => {
    expect(canApproveComplianceFields(["catalogue_contributor"])).toBe(false);
    expect(canApproveComplianceFields(["designer"])).toBe(false);
    expect(canApproveComplianceFields(["owner"])).toBe(true);
  });

  it("tracks AI suggestion as not approved until explicit approval", () => {
    const meta = { hsn_code: createAiSuggestionFieldMeta() };
    expect(isComplianceFieldApproved("hsn_code", meta, ["admin"])).toBe(false);
    expect(
      isComplianceFieldApproved(
        "hsn_code",
        { hsn_code: approveComplianceFieldMeta(createAiSuggestionFieldMeta(), "admin") },
        ["admin"],
      ),
    ).toBe(true);
  });

  it("strips compliance from contributor draft payload when needed", () => {
    const payload = {
      pricing: { hsn: "123", gst_rate: "5", mrp: 100 },
      compliance: { ingredients: "sugar", allergen_information: "nuts" },
    };
    const stripped = stripComplianceFromDraftPayload(payload);
    expect((stripped.pricing as Record<string, unknown>).hsn).toBeUndefined();
    expect((stripped.compliance as Record<string, unknown>).ingredients).toBeUndefined();
    expect((stripped.compliance as Record<string, unknown>).requires_manual_approval).toBe(true);
  });
});
