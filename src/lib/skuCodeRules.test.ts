import { describe, expect, it } from "vitest";
import { fetchActiveSkuCodeRules } from "./skuCodeRules";

describe("fetchActiveSkuCodeRules", () => {
  it("exports a loader function", () => {
    expect(typeof fetchActiveSkuCodeRules).toBe("function");
  });
});
