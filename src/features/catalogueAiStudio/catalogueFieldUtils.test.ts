import { describe, expect, it } from "vitest";
import { hasNumericInput, hasText, parsePositiveNumericInput } from "./catalogueFieldUtils";

describe("parsePositiveNumericInput (Defect 4 regression — string-form numerics)", () => {
  it("accepts a real positive number", () => {
    expect(parsePositiveNumericInput(500)).toBe(500);
  });

  it("accepts a positive numeric string, exactly as a form input yields", () => {
    expect(parsePositiveNumericInput("500")).toBe(500);
  });

  it("trims surrounding whitespace before parsing", () => {
    expect(parsePositiveNumericInput(" 500 ")).toBe(500);
  });

  it("rejects zero as a number", () => {
    expect(parsePositiveNumericInput(0)).toBeNull();
  });

  it("rejects zero as a string", () => {
    expect(parsePositiveNumericInput("0")).toBeNull();
  });

  it("rejects an empty string", () => {
    expect(parsePositiveNumericInput("")).toBeNull();
  });

  it("rejects a whitespace-only string", () => {
    expect(parsePositiveNumericInput("   ")).toBeNull();
  });

  it("rejects non-numeric text", () => {
    expect(parsePositiveNumericInput("abc")).toBeNull();
  });

  it("rejects null", () => {
    expect(parsePositiveNumericInput(null)).toBeNull();
  });

  it("rejects undefined", () => {
    expect(parsePositiveNumericInput(undefined)).toBeNull();
  });

  it("rejects NaN", () => {
    expect(parsePositiveNumericInput(NaN)).toBeNull();
  });

  it("rejects Infinity", () => {
    expect(parsePositiveNumericInput(Infinity)).toBeNull();
    expect(parsePositiveNumericInput("Infinity")).toBeNull();
  });

  it("rejects negative numbers", () => {
    expect(parsePositiveNumericInput(-5)).toBeNull();
    expect(parsePositiveNumericInput("-5")).toBeNull();
  });
});

describe("hasNumericInput", () => {
  it("mirrors parsePositiveNumericInput as a boolean", () => {
    expect(hasNumericInput("500")).toBe(true);
    expect(hasNumericInput("0")).toBe(false);
    expect(hasNumericInput("")).toBe(false);
    expect(hasNumericInput("abc")).toBe(false);
    expect(hasNumericInput(null)).toBe(false);
    expect(hasNumericInput(undefined)).toBe(false);
  });
});

describe("hasText (unchanged)", () => {
  it("still treats blank/whitespace as absent", () => {
    expect(hasText("")).toBe(false);
    expect(hasText("   ")).toBe(false);
    expect(hasText("Baklawa")).toBe(true);
  });
});
