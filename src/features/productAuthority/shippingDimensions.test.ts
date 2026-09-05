import { describe, expect, it } from "vitest";
import {
  deriveCbmFromCm,
  formatDimensionsCmText,
  resolveDimensionsCmText,
} from "@/features/productAuthority/shippingDimensions";

describe("shippingDimensions", () => {
  it("formats partial dimension text without fabricating missing sides", () => {
    expect(formatDimensionsCmText(22, "", 6)).toBe("L 22 cm × H 6 cm");
  });

  it("returns null CBM when any dimension is absent", () => {
    expect(deriveCbmFromCm(22, 18, null)).toBeNull();
    expect(deriveCbmFromCm(22, null, 6)).toBeNull();
    expect(deriveCbmFromCm("", 18, 6)).toBeNull();
  });

  it("derives CBM deterministically from cm inputs", () => {
    // 22 × 18 × 6 cm = 2376 cm³ = 0.002376 m³
    expect(deriveCbmFromCm(22, 18, 6)).toBe(0.002376);
  });

  it("does not derive CBM from zero or negative dimensions", () => {
    expect(deriveCbmFromCm(0, 18, 6)).toBeNull();
    expect(deriveCbmFromCm(22, -1, 6)).toBeNull();
  });

  it("prefers explicit product_dimensions_cm text", () => {
    expect(
      resolveDimensionsCmText({
        product_dimensions_cm: "Custom dims",
        dimension_l_cm: 10,
        dimension_w_cm: 10,
        dimension_h_cm: 10,
      }),
    ).toBe("Custom dims");
  });

  it("falls back to structured L/W/H when no text field", () => {
    expect(
      resolveDimensionsCmText({
        dimension_l_cm: 10,
        dimension_w_cm: 20,
        dimension_h_cm: 30,
      }),
    ).toBe("L 10 cm × W 20 cm × H 30 cm");
  });
});
