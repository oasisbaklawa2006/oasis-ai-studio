import { describe, expect, it } from "vitest";
import {
  appendLiveLegalFieldsToContributorCompliance,
  extractLiveLegalLabelFieldsFromDraftPayload,
  mapApprovedProductDraftLegalLabelFields,
  normalizeDraftLegalLabelFieldValue,
  validateApprovedDraftLegalLabelFields,
} from "./catalogueProductDraftApproval";

const LEGAL_PRODUCT_PAYLOAD = {
  fssai_licence_number: "10012345678901",
  country_of_origin: "India",
  label_manufacturer_details: "Oasis Foods Pvt Ltd, Mumbai",
  ingredients: "Cashew, sugar, ghee",
  shelf_life_days: 30,
};

function buildContributorGroupedPayload(productPayload: Record<string, unknown>) {
  return {
    identity: { product_name: "Export Baklawa", sku: "OAS-AS-BKL-0024" },
    compliance: appendLiveLegalFieldsToContributorCompliance(
      { ingredients: productPayload.ingredients ?? "Cashew, sugar" },
      productPayload,
    ),
  };
}

describe("normalizeDraftLegalLabelFieldValue", () => {
  it("accepts trimmed string values", () => {
    expect(normalizeDraftLegalLabelFieldValue("  India  ")).toBe("India");
  });

  it("fail-closed on object, number, and array values", () => {
    expect(normalizeDraftLegalLabelFieldValue({ nested: true })).toBeNull();
    expect(normalizeDraftLegalLabelFieldValue(10012345678901)).toBeNull();
    expect(normalizeDraftLegalLabelFieldValue(["India"])).toBeNull();
  });

  it("maps blank strings to null", () => {
    expect(normalizeDraftLegalLabelFieldValue("   ")).toBeNull();
  });
});

describe("catalogueProductDraftApproval — Point37 live legal fields", () => {
  it("preserves live legal fields in groupedPayload.compliance", () => {
    const compliance = appendLiveLegalFieldsToContributorCompliance(
      {
        ingredients: LEGAL_PRODUCT_PAYLOAD.ingredients,
        shelf_life_days: LEGAL_PRODUCT_PAYLOAD.shelf_life_days,
      },
      LEGAL_PRODUCT_PAYLOAD,
    );
    expect(compliance.fssai_licence_number).toBe("10012345678901");
    expect(compliance.country_of_origin).toBe("India");
    expect(compliance.label_manufacturer_details).toBe("Oasis Foods Pvt Ltd, Mumbai");
  });

  it("end-to-end: contributor create draft preserves valid legal fields through approval mapping", () => {
    const groupedPayload = buildContributorGroupedPayload(LEGAL_PRODUCT_PAYLOAD);
    const mapped = mapApprovedProductDraftLegalLabelFields(groupedPayload, "create");
    const validation = validateApprovedDraftLegalLabelFields(groupedPayload, "create");

    expect(mapped).toEqual({
      fssai_licence_number: "10012345678901",
      country_of_origin: "India",
      label_manufacturer_details: "Oasis Foods Pvt Ltd, Mumbai",
    });
    expect(validation.ready).toBe(true);
    expect(validation.publicationBlockers).toEqual([]);
  });

  it("end-to-end: contributor update draft preserves valid legal fields through approval mapping", () => {
    const groupedPayload = buildContributorGroupedPayload(LEGAL_PRODUCT_PAYLOAD);
    const mapped = mapApprovedProductDraftLegalLabelFields(groupedPayload, "update");
    const validation = validateApprovedDraftLegalLabelFields(groupedPayload, "update");

    expect(mapped).toEqual({
      fssai_licence_number: "10012345678901",
      country_of_origin: "India",
      label_manufacturer_details: "Oasis Foods Pvt Ltd, Mumbai",
    });
    expect(validation.ready).toBe(true);
    expect(validation.publicationBlockers).toEqual([]);
  });

  it("fail-closed: object-valued FSSAI in draft compliance maps to null and blocks approval", () => {
    const groupedPayload = {
      compliance: {
        fssai_licence_number: { forged: true },
        country_of_origin: "India",
        label_manufacturer_details: "Oasis Foods Pvt Ltd, Mumbai",
      },
    };

    expect(mapApprovedProductDraftLegalLabelFields(groupedPayload, "create")).toEqual({
      fssai_licence_number: null,
      country_of_origin: "India",
      label_manufacturer_details: "Oasis Foods Pvt Ltd, Mumbai",
    });

    const validation = validateApprovedDraftLegalLabelFields(groupedPayload, "create");
    expect(validation.ready).toBe(false);
    expect(
      validation.publicationBlockers.some((b) => b.includes("FSSAI Licence Number missing")),
    ).toBe(true);
  });

  it("fail-closed: malformed country-of-origin and manufacturer values block approval", () => {
    const groupedPayload = {
      compliance: {
        fssai_licence_number: "10012345678901",
        country_of_origin: 91,
        label_manufacturer_details: { name: "Oasis Foods" },
      },
    };

    const validation = validateApprovedDraftLegalLabelFields(groupedPayload, "update");
    expect(validation.fields.country_of_origin).toBeNull();
    expect(validation.fields.label_manufacturer_details).toBeNull();
    expect(validation.ready).toBe(false);
    expect(
      validation.publicationBlockers.some((b) => b.includes("Country of Origin missing")),
    ).toBe(true);
    expect(
      validation.publicationBlockers.some((b) => b.includes("Label Manufacturer Details missing")),
    ).toBe(true);
  });

  it("extracts null legal fields from draft compliance for fail-closed approval review", () => {
    const groupedPayload = {
      compliance: {
        fssai_licence_number: null,
        country_of_origin: "India",
        label_manufacturer_details: "",
      },
    };
    expect(extractLiveLegalLabelFieldsFromDraftPayload(groupedPayload)).toEqual({
      fssai_licence_number: null,
      country_of_origin: "India",
      label_manufacturer_details: null,
    });
  });
});
