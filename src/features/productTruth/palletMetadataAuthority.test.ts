import { describe, expect, it } from "vitest";
import { palletMetadataProductsPayload, validatePalletMetadata } from "./palletMetadataAuthority";

describe("Point33 Core-backed pallet metadata", () => {
  it("keeps optional pallet data null without fabricating any count or type", () => {
    expect(palletMetadataProductsPayload({})).toEqual({
      cartons_per_pallet: null,
      master_cartons_per_pallet: null,
      pallet_uom: null,
    });
  });
  it("preserves both independently confirmed carton quantities", () => {
    expect(
      palletMetadataProductsPayload({
        cartons_per_pallet: "12",
        master_cartons_per_pallet: "3",
        pallet_uom: "Verified type",
      }),
    ).toEqual({
      cartons_per_pallet: 12,
      master_cartons_per_pallet: 3,
      pallet_uom: "Verified type",
    });
  });
  it("rejects zero, negative, fractional, excessive and non-numeric quantities", () => {
    for (const bad of ["0", "-1", "2.5", "10001", "not known"]) {
      const result = validatePalletMetadata({ cartons_per_pallet: bad, pallet_uom: "Verified" });
      expect(result.valid).toBe(false);
      expect(() =>
        palletMetadataProductsPayload({
          cartons_per_pallet: bad,
          pallet_uom: "Verified",
        }),
      ).toThrow("Cartons per pallet");
    }
  });
  it("blocks ambiguous numeric coercions and preserves legitimate integer values", () => {
    for (const bad of ["0x10", "1e3", " 12 ", "  ", "+12", "12.0", true, false, {}, [], Infinity]) {
      const checked = validatePalletMetadata({
        cartons_per_pallet: bad,
        pallet_uom: "Verified pallet",
      });
      expect(checked.valid).toBe(false);
      expect(() =>
        palletMetadataProductsPayload({
          cartons_per_pallet: bad,
          pallet_uom: "Verified pallet",
        }),
      ).toThrow("Cartons per pallet");
    }
    expect(
      palletMetadataProductsPayload({
        cartons_per_pallet: 12,
        master_cartons_per_pallet: "24",
        pallet_uom: "Verified pallet",
      }),
    ).toMatchObject({ cartons_per_pallet: 12, master_cartons_per_pallet: 24 });
  });
  it("rejects non-string pallet types and whitespace-only provided units", () => {
    for (const pallet_uom of [1, true, { label: "Standard" }, ["Standard"], "  "]) {
      const checked = validatePalletMetadata({ cartons_per_pallet: 12, pallet_uom });
      expect(checked.valid).toBe(false);
      expect(() =>
        palletMetadataProductsPayload({ cartons_per_pallet: 12, pallet_uom }),
      ).toThrow();
    }
    expect(validatePalletMetadata({ pallet_uom: "" }).valid).toBe(true);
  });

  it("requires an explicitly asserted pallet UOM whenever count exists", () => {
    expect(validatePalletMetadata({ cartons_per_pallet: 12 }).valid).toBe(false);
    expect(validatePalletMetadata({ master_cartons_per_pallet: 4 }).valid).toBe(false);
  });
  it("rejects whitespace-padded or oversized pallet type", () => {
    expect(validatePalletMetadata({ pallet_uom: " type " }).valid).toBe(false);
    expect(validatePalletMetadata({ pallet_uom: "x".repeat(65) }).valid).toBe(false);
  });
  it("requires a pallet quantity when a pallet type is supplied alone", () => {
    const result = validatePalletMetadata({ pallet_uom: "Verified type" });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("At least one pallet quantity");
  });
});
