import { describe, expect, it } from "vitest";
import { isFieldEdited } from "./catalogueFieldEditedState";

describe("isFieldEdited", () => {
  it("is false when the current value still matches the generated value", () => {
    expect(isFieldEdited("Generated text", "Generated text")).toBe(false);
  });

  it("is true once the operator has changed the text", () => {
    expect(isFieldEdited("Operator's version", "Generated text")).toBe(true);
  });

  it("treats an empty generated baseline correctly", () => {
    expect(isFieldEdited("", "")).toBe(false);
    expect(isFieldEdited("New text", "")).toBe(true);
  });
});
