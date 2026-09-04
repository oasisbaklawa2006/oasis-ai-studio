import { describe, expect, it } from "vitest";
import { withReviewedIntakeBarcode } from "./fastCreateIntakeBarcode";

describe("withReviewedIntakeBarcode", () => {
  it("adds top-level intake_barcode for Core draft extraction", () => {
    const payload = withReviewedIntakeBarcode(
      { identity: { product_name: "Box" } },
      "5901234123457",
    );
    expect(payload.intake_barcode).toBe("5901234123457");
  });

  it("leaves payload unchanged when barcode is absent", () => {
    const payload = withReviewedIntakeBarcode({ identity: { product_name: "Box" } }, null);
    expect(payload).toEqual({ identity: { product_name: "Box" } });
  });
});
