import { describe, expect, it } from "vitest";
import { b2bPriceMissing, computePricingLadder } from "./pricingLadder";

describe("pricingLadder", () => {
  const baseRows = [
    { price_channel: "mrp", calculated_price: 3600, currency: "INR", uom: "kg", approval_status: "approved" },
    { price_channel: "bulk", calculated_price: 2800, currency: "INR", uom: "kg", approval_status: "approved" },
    { price_channel: "wholesale", calculated_price: 2450, currency: "INR", uom: "kg", approval_status: "approved" },
    { price_channel: "b2b", calculated_price: 2800, currency: "INR", uom: "kg", approval_status: "approved" },
  ];

  it("manual override wins over derived ladder", () => {
    const ladder = computePricingLadder({ pricingRows: baseRows });
    const bulk = ladder.find((r) => r.channel === "bulk");
    expect(bulk?.manualPrice).toBe(2800);
    expect(bulk?.source).toBe("manual");
    expect(bulk?.effectivePrice).toBe(2800);
  });

  it("retail inherits MRP when blank", () => {
    const ladder = computePricingLadder({
      pricingRows: [{ price_channel: "mrp", calculated_price: 3600, approval_status: "approved" }],
    });
    const retail = ladder.find((r) => r.channel === "retail");
    expect(retail?.manualPrice).toBeNull();
    expect(retail?.effectivePrice).toBe(3600);
    expect(retail?.source).toBe("inherited");
  });

  it("bulk derives MRP minus 20% when blank", () => {
    const ladder = computePricingLadder({
      pricingRows: [{ price_channel: "mrp", calculated_price: 3600, approval_status: "approved" }],
    });
    const bulk = ladder.find((r) => r.channel === "bulk");
    expect(bulk?.effectivePrice).toBe(2880);
    expect(bulk?.source).toBe("derived");
  });

  it("wholesale derives MRP minus 30% when blank", () => {
    const ladder = computePricingLadder({
      pricingRows: [{ price_channel: "mrp", calculated_price: 3600, approval_status: "approved" }],
    });
    const wholesale = ladder.find((r) => r.channel === "wholesale");
    expect(wholesale?.effectivePrice).toBe(2520);
  });

  it("horeca inherits wholesale not b2b when blank", () => {
    const ladder = computePricingLadder({
      pricingRows: [
        { price_channel: "mrp", calculated_price: 3600, approval_status: "approved" },
        { price_channel: "b2b", calculated_price: 2000, approval_status: "approved" },
      ],
    });
    const horeca = ladder.find((r) => r.channel === "horeca");
    expect(horeca?.effectivePrice).toBe(2520);
    expect(horeca?.source).toBe("inherited");
  });

  it("b2b missing remains blocked", () => {
    const ladder = computePricingLadder({
      pricingRows: [{ price_channel: "mrp", calculated_price: 3600, approval_status: "approved" }],
    });
    expect(b2bPriceMissing(ladder)).toBe(true);
    const b2b = ladder.find((r) => r.channel === "b2b");
    expect(b2b?.source).toBe("missing");
  });

  it("export franchisee own outlet special inherit b2b when blank", () => {
    const ladder = computePricingLadder({
      pricingRows: [
        { price_channel: "mrp", calculated_price: 3600, approval_status: "approved" },
        { price_channel: "b2b", calculated_price: 2800, approval_status: "approved" },
      ],
    });
    for (const ch of ["export", "franchisee", "own_outlet", "special"]) {
      const row = ladder.find((r) => r.channel === ch);
      expect(row?.effectivePrice).toBe(2800);
      expect(row?.source).toBe("inherited");
    }
  });
});
