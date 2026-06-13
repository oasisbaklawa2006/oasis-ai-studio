import { describe, expect, it } from "vitest";
import { formToDbProductPayload } from "@/features/productAuthority/productSchemaAdapter";
import {
  configuredChannels,
  mapMoqRules,
  mapPricingRules,
} from "@/features/productTruth/channelAuthorityMappers";
import { mediaAssetsFromSources } from "@/features/mediaReadiness/mediaAssetsFromForm";
import { evaluateMediaReadiness } from "@/features/mediaReadiness/mediaReadinessEngine";
import { productMediaContextFromForm } from "@/features/mediaReadiness/mediaAssetsFromForm";
import {
  packagingHierarchyFromForm,
  productMoqFromForm,
} from "@/features/productTruth/packagingTruth";
import { productTruthInputFromForm } from "@/features/productTruth/productReadiness";
import { computePricingLadder } from "@/features/productTruth/pricingLadder";
import { convertPricePerKgToPiece } from "@/features/productTruth/priceUnitConversion";

/**
 * Save → reload consistency (unit-level, no mocks).
 * Simulates persisted DB row + related authority tables reloaded into Product Edit / Product Truth.
 */
describe("product truth reconciliation save/display", () => {
  const productId = "11111111-1111-1111-1111-111111111111";

  const editForm = {
    id: productId,
    product_name: "Mor Pistachio Durum",
    sku: "OAS-AS-BKL-0024",
    category: "Baklawa",
    subcategory: "Durum",
    primary_uom: "kg",
    moq_value: 9,
    moq_uom: "tray",
    increment_value: 1,
    increment_uom: "tray",
    approximate_piece_weight_g: 18,
    pieces_per_kg: 55.56,
    master_carton_qty: 12,
    hsn_code: "19059090",
    gst_rate: 18,
    is_active: true,
  };

  const dbProductRow = formToDbProductPayload(editForm);
  const pricingRows = [
    {
      product_id: productId,
      price_channel: "bulk",
      calculated_price: 2800,
      currency: "INR",
      approval_status: "approved",
    },
    {
      product_id: productId,
      price_channel: "mrp",
      base_price: 3600,
      currency: "INR",
      approval_status: "approved",
    },
    {
      product_id: productId,
      price_channel: "wholesale",
      calculated_price: 2450,
      currency: "INR",
      approval_status: "approved",
      uom: "kg",
    },
    {
      product_id: productId,
      price_channel: "b2b",
      calculated_price: 2800,
      currency: "INR",
      approval_status: "approved",
      uom: "kg",
    },
  ];
  const moqRows = [
    {
      product_id: productId,
      channel: "b2b",
      moq_applicable: true,
      moq_value: 9,
      moq_uom: "tray",
      increment_value: 1,
      increment_uom: "tray",
    },
  ];
  const mediaRows = [
    { product_id: productId, type: "hero_image", file_url: "https://cdn/h.jpg", status: "approved" },
    { product_id: productId, type: "white_background", file_url: "https://cdn/w.jpg", status: "approved" },
    { product_id: productId, type: "closeup", file_url: "https://cdn/c.jpg", status: "approved" },
    { product_id: productId, type: "lifestyle", file_url: "https://cdn/l.jpg", status: "approved" },
  ];

  it("reload: Product Edit save payload matches authoritative DB columns", () => {
    expect(dbProductRow.grams_per_piece).toBe(18);
    expect(dbProductRow.pcs_per_kg).toBe(55.56);
    expect(dbProductRow.moq_value).toBe(9);
    expect(dbProductRow.moq_uom).toBe("tray");
    expect(dbProductRow.master_carton_qty).toBe(12);
  });

  it("reload: Product Truth packaging matches form — MOQ 9 trays, master carton 12", () => {
    const packaging = packagingHierarchyFromForm(editForm);
    const moq = productMoqFromForm(editForm);
    expect(moq.moqValue).toBe(9);
    expect(moq.moqUom).toBe("tray");
    expect(packaging.traysPerMasterCarton).toBe(12);
    expect(packaging.traysPerMasterCarton).not.toBe(8);
  });

  it("reload: channel summary matches pricing authority table and ladder", () => {
    const prices = mapPricingRules(pricingRows);
    const channels = configuredChannels(prices, mapMoqRules(moqRows));
    expect(channels).toContain("bulk");
    expect(channels).toContain("mrp");
    expect(channels).toContain("wholesale");
    expect(channels).toContain("b2b");
    expect(prices.find((p) => p.channel === "bulk")?.sellingPrice).toBe(2800);
    expect(prices.find((p) => p.channel === "mrp")?.mrp).toBe(3600);
    expect(prices.find((p) => p.channel === "wholesale")?.sellingPrice).toBe(2450);

    const ladder = computePricingLadder({ pricingRows, priceRecords: prices });
    const horeca = ladder.find((r) => r.channel === "horeca");
    expect(horeca?.effectivePrice).toBe(2450);
    expect(horeca?.source).toBe("inherited");

    const perPiece = convertPricePerKgToPiece(3600, { piecesPerKg: 55.56 });
    expect(perPiece).toBeCloseTo(64.8, 0);
  });

  it("reload: media readiness sees all four product_media assets", () => {
    const assets = mediaAssetsFromSources({ form: editForm, productMediaRows: mediaRows });
    const ctx = productMediaContextFromForm(editForm);
    const readiness = evaluateMediaReadiness(ctx, assets);
    expect(assets).toHaveLength(4);
    expect(assets.some((a) => a.type === "pairing_image")).toBe(true);
    expect(readiness.canPublishMedia).toBe(true);
    expect(readiness.score).toBe(readiness.maxScore);
  });

  it("reload: full truth input aligns edit form + authority tables", () => {
    const truth = productTruthInputFromForm(editForm, {
      prices: mapPricingRules(pricingRows),
      moqRules: mapMoqRules(moqRows),
      productMediaRows: mediaRows,
      complianceApproved: true,
    });
    expect(truth.packaging?.traysPerMasterCarton).toBe(12);
    expect(truth.prices?.length).toBe(4);
    expect(truth.mediaAssets?.length).toBe(4);
  });
});
