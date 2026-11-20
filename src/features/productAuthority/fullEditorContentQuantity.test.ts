import { describe, expect, it } from "vitest";
import { fullEditorContentQuantity } from "./fullEditorContentQuantity";

describe("Full Editor contributor content contract", () => {
  it.each([
    ["6", "pcs", 6, "pcs"],
    ["350.5", "grams", 350.5, "g"],
    ["350", "g", 350, "g"],
    ["0.5", "kg", 0.5, "kg"],
  ])("preserves explicit %s %s", (raw, unit, value, expectedUnit) => {
    expect(fullEditorContentQuantity({ qty_per_pack: raw, qty_content_uom: unit })).toEqual({
      ok: true,
      quantity: { value, unit: expectedUnit },
    });
  });
  it("preserves named legacy piece evidence without inferring a weight conversion", () => {
    expect(fullEditorContentQuantity({ pcs_per_pack: "12", primary_uom: "kg" })).toEqual({
      ok: true,
      quantity: { value: 12, unit: "pcs" },
    });
  });
  it("lets explicit typed quantity own the evidence over an older piece field", () => {
    expect(
      fullEditorContentQuantity({ qty_per_pack: "0.5", qty_content_uom: "kg", pcs_per_pack: "6" }),
    ).toEqual({
      ok: true,
      quantity: { value: 0.5, unit: "kg" },
    });
  });
  it("omits missing optional quantity without inventing a count", () => {
    expect(fullEditorContentQuantity({ qty_per_pack: "", qty_content_uom: "pcs" })).toEqual({
      ok: true,
      quantity: null,
    });
  });
  it.each(["", "tray", "carton", "ml", "litre"])("blocks unpersistable unit %s", (unit) => {
    expect(fullEditorContentQuantity({ qty_per_pack: "6", qty_content_uom: unit }).ok).toBe(false);
  });
  it.each(["0", "-1", "1.5", "1e3", "0x10", "Infinity", "9007199254740992", false, {}, Number.NaN])(
    "blocks invalid piece evidence %s",
    (value) => {
      expect(fullEditorContentQuantity({ qty_per_pack: value, qty_content_uom: "pcs" }).ok).toBe(
        false,
      );
    },
  );
  it("rejects weight overflow", () => {
    expect(
      fullEditorContentQuantity({ qty_per_pack: Number.MAX_VALUE, qty_content_uom: "kg" }).ok,
    ).toBe(false);
  });
});
