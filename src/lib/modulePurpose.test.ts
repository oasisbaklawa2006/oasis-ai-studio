import { describe, expect, it } from "vitest";
import { MODULE_PURPOSES, modulePurpose } from "./modulePurpose";

describe("module purpose balloons", () => {
  it("provides meaningful guidance for every registered module", () => {
    expect(Object.keys(MODULE_PURPOSES).length).toBe(18);
    expect(Object.values(MODULE_PURPOSES).every((purpose) => purpose.length >= 40)).toBe(true);
  });

  it("returns a safe fallback for future modules", () => {
    expect(modulePurpose("/future-module")).toContain("governed");
  });
});
