import { describe, expect, it } from "vitest";
import {
  appendLiveLegalFieldsToContributorCompliance,
  extractLiveLegalLabelFieldsFromDraftPayload,
  mapApprovedProductDraftLegalLabelFields,
} from "./catalogueProductDraftApproval";

const LEGAL_PRODUCT_PAYLOAD = {
  fssai_licence_number: "10012345678901",
  country_of_origin: "India",
  label_manufacturer_details: "Oasis Foods Pvt Ltd, Mumbai",
  ingredients: "Cashew, sugar, ghee",
  shelf_life_days: 30,
};

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

  it("round-trips contributor draft → approval create mapping without loss", () => {
    const groupedPayload = {
      identity: { product_name: "Export Baklawa", sku: "OAS-AS-BKL-0024" },
      compliance: appendLiveLegalFieldsToContributorCompliance(
        { ingredients: "Cashew, sugar" },
        LEGAL_PRODUCT_PAYLOAD,
      ),
    };

    const mapped = mapApprovedProductDraftLegalLabelFields(groupedPayload, "create");
    expect(mapped).toEqual({
      fssai_licence_number: "10012345678901",
      country_of_origin: "India",
      label_manufacturer_details: "Oasis Foods Pvt Ltd, Mumbai",
    });
  });

  it("round-trips contributor draft → approval update mapping without loss", () => {
    const groupedPayload = {
      identity: { product_name: "Export Baklawa" },
      compliance: appendLiveLegalFieldsToContributorCompliance({}, LEGAL_PRODUCT_PAYLOAD),
    };

    const mapped = mapApprovedProductDraftLegalLabelFields(groupedPayload, "update");
    expect(mapped).toEqual({
      fssai_licence_number: "10012345678901",
      country_of_origin: "India",
      label_manufacturer_details: "Oasis Foods Pvt Ltd, Mumbai",
    });
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
      label_manufacturer_details: "",
    });
  });
});
