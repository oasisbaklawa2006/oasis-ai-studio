import { describe, expect, it } from "vitest";
import { saleTypeLabelFromForm } from "./catalogueSaleTypeLabel";
import { SALE_TYPES } from "@/features/productAuthority/saleType";

describe("saleTypeLabelFromForm", () => {
  it("never returns a raw internal slug — always a human label from SALE_TYPES (Bugbot regression)", () => {
    const label = saleTypeLabelFromForm({ product_class: "bulk_loose_product" });
    // b2b_horeca is the internal slug saleTypeFromForm() derives for this product_class.
    expect(label).not.toBe("b2b_horeca");
    expect(SALE_TYPES.map((t) => t.label)).toContain(label);
  });

  it("resolves ready_pack to its human label", () => {
    const label = saleTypeLabelFromForm({ product_class: "ready_pack" });
    expect(label).toBe(SALE_TYPES.find((t) => t.key === "retail_ready_pack")?.label);
  });

  it("resolves gift_hamper to its human label", () => {
    const label = saleTypeLabelFromForm({ product_class: "gift_hamper" });
    expect(label).toBe(SALE_TYPES.find((t) => t.key === "gift_hamper")?.label);
  });

  it("resolves packaging_material via main_department", () => {
    const label = saleTypeLabelFromForm({ main_department: "packing_material" });
    expect(label).toBe(SALE_TYPES.find((t) => t.key === "packaging_material")?.label);
  });
});
