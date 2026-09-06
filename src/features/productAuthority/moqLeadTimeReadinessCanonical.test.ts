import { describe, expect, it } from "vitest";
import {
  channelMoqPublicationBlockers,
  evaluateLeadTimeAuthority,
  evaluateProductMoqAuthority,
  evaluatePublicationReadiness,
  POINT_36_LIVE_PRODUCT_LEAD_TIME_COLUMN,
} from "./moqLeadTimeReadinessCanonical";

describe("evaluateProductMoqAuthority", () => {
  it("defers MOQ for internal BOM products", () => {
    const result = evaluateProductMoqAuthority({}, "internal_bom");
    expect(result.state).toBe("deferred");
    expect(result.publicationBlockers).toEqual([]);
  });

  it("accepts not_applicable without numeric MOQ", () => {
    const result = evaluateProductMoqAuthority(
      { moq_rule_type: "not_applicable", moq_value: null },
      "retail_ready_pack",
    );
    expect(result.state).toBe("complete");
    expect(result.publicationBlockers).toEqual([]);
  });

  it("flags stale scalar when not_applicable but moq_value is set", () => {
    const result = evaluateProductMoqAuthority(
      { moq_rule_type: "not_applicable", moq_value: 1, moq_uom: "kg" },
      "retail_ready_pack",
    );
    expect(result.state).toBe("complete");
    expect(result.warnings.some((w) => w.includes("stale"))).toBe(true);
  });

  it("requires structured MOQ for B2B sale types", () => {
    const result = evaluateProductMoqAuthority(
      { moq_rule_type: "fixed_min", moq_value: null, moq_uom: null },
      "b2b_horeca",
    );
    expect(result.state).toBe("missing");
    expect(result.publicationBlockers).toContain("MOQ value and UOM required");
  });

  it("blocks publication when MOQ value exists without UOM (fail-closed)", () => {
    const result = evaluateProductMoqAuthority(
      { moq_rule_type: "fixed_min", moq_value: 6, moq_uom: null },
      "b2b_horeca",
    );
    expect(result.state).toBe("invalid");
    expect(result.publicationBlockers).toContain("MOQ UOM required when MOQ value is set");
  });

  it("rejects legacy moq_text-only for B2B publication", () => {
    const result = evaluateProductMoqAuthority(
      { moq_rule_type: "fixed_min", moq_text: "6 kg minimum", moq_value: null },
      "b2b_horeca",
    );
    expect(result.state).toBe("invalid");
    expect(result.publicationBlockers.join(" ")).toContain("legacy note insufficient");
  });

  it("accepts carton_based MOQ when carton qty is set", () => {
    const result = evaluateProductMoqAuthority(
      {
        moq_rule_type: "carton_based",
        fixed_carton_required: true,
        carton_qty: 12,
        carton_uom: "carton",
      },
      "b2b_horeca",
    );
    expect(result.state).toBe("complete");
    expect(result.summary).toContain("12");
    expect(result.publicationBlockers).toEqual([]);
  });

  it("requires private label MOQ when private label is allowed", () => {
    const result = evaluateProductMoqAuthority(
      {
        moq_rule_type: "fixed_min",
        moq_value: 5,
        moq_uom: "kg",
        private_label_allowed: true,
        private_label_moq: null,
      },
      "retail_ready_pack",
    );
    expect(result.publicationBlockers).toContain("Private label MOQ and UOM required");
  });

  it("allows retail pack with optional MOQ deferred when no rule type", () => {
    const result = evaluateProductMoqAuthority({}, "retail_ready_pack");
    expect(result.state).toBe("deferred");
    expect(result.publicationBlockers).toEqual([]);
  });
});

describe("channelMoqPublicationBlockers", () => {
  it("blocks when b2b pricing exists without channel MOQ rule", () => {
    const blockers = channelMoqPublicationBlockers([], ["b2b"]);
    expect(blockers).toContain("Channel MOQ missing for b2b");
  });

  it("passes when channel MOQ rule exists", () => {
    const blockers = channelMoqPublicationBlockers(
      [{ channel: "b2b", moqApplicable: true, moqValue: 5, moqUom: "kg" }],
      ["b2b"],
    );
    expect(blockers).toEqual([]);
  });
});

describe("evaluateLeadTimeAuthority", () => {
  it("binds to live products.lead_time_days when set", () => {
    const result = evaluateLeadTimeAuthority("b2b_horeca", { productLeadTimeDays: 7 });
    expect(result.persistence).toBe("products_row");
    expect(result.state).toBe("product_stored");
    expect(result.productDays).toBe(7);
    expect(POINT_36_LIVE_PRODUCT_LEAD_TIME_COLUMN).toBe("products.lead_time_days");
    expect(result.publicationBlockers).toEqual([]);
  });

  it("keeps BOM lead time separate — does not substitute for missing product lead time", () => {
    const result = evaluateLeadTimeAuthority("b2b_horeca", { bomMaxLeadTimeDays: 14 });
    expect(result.state).toBe("bom_component_only");
    expect(result.productDays).toBeNull();
    expect(result.bomMaxDays).toBe(14);
    expect(result.publicationBlockers).toEqual([]);
  });

  it("blocks invalid non-positive product lead time", () => {
    const result = evaluateLeadTimeAuthority("retail_ready_pack", { productLeadTimeDays: 0 });
    expect(result.state).toBe("invalid");
    expect(result.publicationBlockers).toContain("Lead time (days) must be a positive integer");
  });

  it("requires product lead time for export publication", () => {
    const result = evaluateLeadTimeAuthority("export");
    expect(result.state).toBe("deferred");
    expect(result.publicationBlockers).toContain("Lead time (days) required for export products");
  });
});

describe("evaluatePublicationReadiness", () => {
  it("aggregates MOQ and channel blockers for snapshot", () => {
    const result = evaluatePublicationReadiness({
      saleType: "b2b_horeca",
      moq: { moq_rule_type: "fixed_min", moq_value: 1, moq_uom: null },
      channelMoqRules: [],
      pricedChannels: ["b2b"],
    });
    expect(result.snapshot.schema).toBe("point36_v1");
    expect(result.snapshot.lead_time.product_days).toBeNull();
    expect(result.publicationBlockers.length).toBeGreaterThanOrEqual(2);
    expect(result.publicationBlockers).toContain("Channel MOQ missing for b2b");
  });

  it("export publication clears lead-time blocker when product lead_time_days is set", () => {
    const without = evaluatePublicationReadiness({
      saleType: "export",
      moq: { moq_rule_type: "quotation" },
      productLeadTimeDays: null,
    });
    expect(without.publicationBlockers).toContain("Lead time (days) required for export products");

    const withLead = evaluatePublicationReadiness({
      saleType: "export",
      moq: { moq_rule_type: "quotation" },
      productLeadTimeDays: 10,
    });
    expect(withLead.leadTime.state).toBe("product_stored");
    expect(withLead.snapshot.lead_time.product_days).toBe(10);
    expect(withLead.publicationBlockers).not.toContain(
      "Lead time (days) required for export products",
    );
  });
});
