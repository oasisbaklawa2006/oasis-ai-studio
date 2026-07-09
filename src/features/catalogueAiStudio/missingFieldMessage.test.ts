import { describe, expect, it } from "vitest";
import { isMissingFieldOnlyMessage } from "./missingFieldMessage";

describe("isMissingFieldOnlyMessage", () => {
  it("detects a pure missing-field warning", () => {
    expect(isMissingFieldOnlyMessage("Add missing field first: Product Name.")).toBe(true);
    expect(isMissingFieldOnlyMessage("  Add missing field first: HSN Code.  ")).toBe(true);
  });

  it("does not flag real copy that happens to mention a field", () => {
    expect(
      isMissingFieldOnlyMessage("Cashew Baklawa is available for wholesale. Add missing field first: B2B price."),
    ).toBe(false);
    expect(isMissingFieldOnlyMessage("Premium Oasis sweets — crafted with quality ingredients.")).toBe(false);
  });

  it("does not flag empty or unrelated text", () => {
    expect(isMissingFieldOnlyMessage("")).toBe(false);
    expect(isMissingFieldOnlyMessage("Missing field.")).toBe(false);
  });
});
