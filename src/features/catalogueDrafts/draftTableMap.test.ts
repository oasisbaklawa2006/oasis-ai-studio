import { describe, expect, it } from "vitest";
import { draftTableMap } from "./draftTableMap";

describe("draftTableMap", () => {
  it("maps pricing and moq drafts to their authoritative Core target tables", () => {
    expect(draftTableMap.pricing.targetTable).toBe("product_pricing_rules");
    expect(draftTableMap.moq.targetTable).toBe("product_moq_rules");
  });
});
