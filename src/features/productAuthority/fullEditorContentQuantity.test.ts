import { describe, expect, it } from "vitest";
import {
  fullEditorContentQuantity,
  fullEditorDraftContentPacking,
  fullEditorQuantityPatch,
  fullEditorWeightPatch,
} from "./fullEditorContentQuantity";

describe("Full Editor contributor content contract", () => {
  it.each([
    ["6", "pcs", 6, "pcs"],
    ["350.5", "grams", 350.5, "g"],
    ["350", "g", 350, "g"],
    ["0.5", "kg", 0.5, "kg"],
    [".5", "kg", 0.5, "kg"],
    [".5", "grams", 0.5, "g"],
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
  it.each([
    "0",
    "-1",
    "1.5",
    ".5",
    ".0",
    ".",
    "1e3",
    "0x10",
    "Infinity",
    "9007199254740992",
    false,
    {},
    Number.NaN,
  ])("blocks invalid piece evidence %s", (value) => {
    expect(fullEditorContentQuantity({ qty_per_pack: value, qty_content_uom: "pcs" }).ok).toBe(
      false,
    );
  });
  it.each([
    ["0006", "pcs", 6],
    ["  .50  ", "kg", 0.5],
    ["1.25", "grams", 1.25],
  ])("parses valid bounded decimal %s %s", (raw, unit, expected) => {
    expect(fullEditorContentQuantity({ qty_per_pack: raw, qty_content_uom: unit })).toEqual({
      ok: true,
      quantity: { value: expected, unit: unit === "grams" ? "g" : unit },
    });
  });
  it.each([
    "1.",
    ".",
    "1..2",
    "1.2.3",
    "++1",
    "-.5",
    "1e3",
    "0x10",
    "1_000",
    "1/2",
    "123abc",
    "3\\u200b.5",
    "9".repeat(129),
    "1".repeat(120) + "x".repeat(20000),
  ])("rejects malformed or oversized decimal %s", (raw) => {
    expect(fullEditorContentQuantity({ qty_per_pack: raw, qty_content_uom: "kg" }).ok).toBe(
      false,
    );
  });
  it("rejects weight overflow", () => {
    expect(
      fullEditorContentQuantity({ qty_per_pack: Number.MAX_VALUE, qty_content_uom: "kg" }).ok,
    ).toBe(false);
  });
});

it("does not turn a cleared weight into a legacy piece assertion", () => {
  expect(
    fullEditorContentQuantity({ qty_per_pack: "", qty_content_uom: "kg", pcs_per_pack: 6 }),
  ).toEqual({ ok: true, quantity: null });
});
it("weight quantity edits never mirror grams into pieces", () => {
  expect(fullEditorQuantityPatch({ qty_content_uom: "grams", pcs_per_pack: 6 }, "500")).toEqual({
    qty_per_pack: "500",
    net_weight_g: 500,
  });
});
it("piece edits synchronize their explicit count", () => {
  expect(fullEditorQuantityPatch({ qty_content_uom: "pcs" }, "8")).toEqual({
    qty_per_pack: "8",
    pcs_per_pack: "8",
  });
});
it("kg quantity and gram controls stay synchronized with SI conversion only", () => {
  expect(fullEditorQuantityPatch({ qty_content_uom: "kg" }, "0.5")).toEqual({
    qty_per_pack: "0.5",
    net_weight_g: 500,
  });
  expect(fullEditorWeightPatch({ qty_content_uom: "kg" }, "750")).toEqual({
    net_weight_g: "750",
    qty_per_pack: 0.75,
  });
});
it("editing grams preserves independent piece controls", () => {
  expect(fullEditorWeightPatch({ qty_content_uom: "pcs", qty_per_pack: 6 }, "750")).toEqual({
    net_weight_g: "750",
  });
});

it.each(["kg", "g", "grams"])("omits absent %s content from both draft contracts", (unit) => {
  const content = fullEditorContentQuantity({
    qty_per_pack: "",
    qty_content_uom: unit,
    pcs_per_pack: 6,
  });
  expect(content.ok).toBe(true);
  if (content.ok) expect(fullEditorDraftContentPacking(content.quantity)).toEqual({});
});
it.each([
  { value: 0.5, unit: "kg" as const },
  { value: 6, unit: "pcs" as const },
])("keeps legacy and typed draft quantities consistent: %j", (quantity) => {
  expect(fullEditorDraftContentPacking(quantity)).toEqual({
    qty_per_pack: quantity.value,
    qty_content_uom: quantity.unit,
    content_quantity: quantity,
  });
});
