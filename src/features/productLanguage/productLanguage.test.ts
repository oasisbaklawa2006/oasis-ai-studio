import { describe, expect, it, beforeEach } from "vitest";
import {
  PRODUCT_LANGUAGE_TERM_TYPES,
  TERM_TYPE_LABELS,
  buildAdminAliasInsert,
  buildContributorAliasDraftPayload,
  channelScopeForTermType,
  inferDefaultTermType,
} from "./terms";
import {
  countStoredTermTypes,
  getStoredTermType,
  setStoredTermType,
} from "./termTypeStorage";

describe("product language terms", () => {
  it("exposes six editable term type tabs plus official name elsewhere", () => {
    expect(PRODUCT_LANGUAGE_TERM_TYPES).toHaveLength(6);
    expect(TERM_TYPE_LABELS.official_alias).toBe("Official Alias");
    expect(TERM_TYPE_LABELS.customer_term).toBe("Customer Term");
    expect(TERM_TYPE_LABELS.whatsapp_keyword).toBe("WhatsApp Keyword");
    expect(TERM_TYPE_LABELS.regional_term).toBe("Regional Term");
    expect(TERM_TYPE_LABELS.legacy_name).toBe("Legacy Name");
    expect(TERM_TYPE_LABELS.search_keyword).toBe("Search Keyword");
  });

  it("maps whatsapp_keyword to whatsapp channel scope", () => {
    expect(channelScopeForTermType("whatsapp_keyword")).toEqual(["whatsapp"]);
  });

  it("builds contributor draft payload with required fields", () => {
    const payload = buildContributorAliasDraftPayload({
      productId: "prod-001",
      canonicalName: "Cashew Kitta",
      aliasText: "Kaju Kitta",
      termType: "customer_term",
      language: "hi",
    });

    expect(payload).toMatchObject({
      scope: "product_alias",
      alias: "Kaju Kitta",
      alias_text: "Kaju Kitta",
      term_type: "customer_term",
      channel_scope: ["sales", "customer_app"],
      product_id: "prod-001",
      canonical_name: "Cashew Kitta",
    });
  });

  it("builds OAS-AS-BKL-0001 customer term draft shape", () => {
    const payload = buildContributorAliasDraftPayload({
      productId: "batch-001-id",
      canonicalName: "Cashew Kitta",
      aliasText: "cashew piece",
      termType: "customer_term",
    });

    expect(payload.alias_text).toBe("cashew piece");
    expect(payload.term_type).toBe("customer_term");
    expect(payload.canonical_name).toBe("Cashew Kitta");
    expect(payload.product_id).toBe("batch-001-id");
    expect(payload.channel_scope).toContain("customer_app");
  });

  it("admin insert carries migration alias and legacy canonical_name for Central fallback", () => {
    const insert = buildAdminAliasInsert("pid", "Cashew Kitta", "Kaju Kitta", {
      alias_type: "official_alias",
      source: "manual",
    });
    expect(insert).toEqual({
      product_id: "pid",
      alias: "Kaju Kitta",
      canonical_name: "Cashew Kitta",
      alias_type: "official_alias",
      source: "manual",
    });
  });

  it("infers legacy_name for unlinked canonical rows", () => {
    expect(inferDefaultTermType({ product_id: null })).toBe("legacy_name");
    expect(inferDefaultTermType({ product_id: "x", alias_type: "old_name" })).toBe("legacy_name");
  });
});

describe("term type storage", () => {
  const productId = "test-product-language-ui";

  beforeEach(() => {
    localStorage.clear();
  });

  it("stores term type in localStorage only", () => {
    setStoredTermType(productId, "alias-row-1", "whatsapp_keyword");
    expect(getStoredTermType(productId, "alias-row-1")).toBe("whatsapp_keyword");
    expect(countStoredTermTypes(productId).whatsapp_keyword).toBe(1);
  });
});
