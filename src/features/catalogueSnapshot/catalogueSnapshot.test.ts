import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => {
  const reject = { data: null, error: { message: "mock" } };
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.order = () => Promise.resolve(reject);
  chain.in = () => chain;
  chain.insert = () => chain;
  chain.update = () => chain;
  chain.single = () => Promise.resolve(reject);
  return { supabase: { from: () => chain } };
});

import { generateCatalogueSnapshot } from "./snapshotGenerator";
import { validateSnapshotGate } from "./snapshotValidation";
import {
  buildCentralSyncPreviewBundle,
  isStaleCatalogueVersion,
  LIVE_CENTRAL_WRITE_ENABLED,
  validateApprovedCatalogueProductSnapshot,
} from "./centralSyncPayload";
import { evaluateProductReadiness } from "@/features/productTruth/productReadiness";
import { productTruthInputFromForm } from "@/features/productTruth/productReadiness";
import { isImmutableVersion, updateCatalogueVersionSnapshot } from "./catalogueVersionStore";
import type { ChannelMoqRule, ChannelPriceRecord, ProductTruthInput } from "@/features/productTruth/types";

const baseForm: Record<string, unknown> = {
  id: "prod-11111111-1111-1111-1111-111111111111",
  product_name: "Cashew Pyramid",
  sku: "OB-BAK-PYR-001",
  category: "Baklawa",
  subcategory: "Pyramid",
  main_department: "ready_goods_store",
  production_department: "dragees",
  hero_image_url: "https://cdn.example/hero.jpg",
  media_status: "approved",
  hsn_code: "18069090",
  gst_rate: "5",
  primary_uom: "kg",
  retail_uom: "pcs",
  b2b_uom: "kg",
  pieces_per_kg: 40,
  approximate_piece_weight_g: 25,
  master_carton_qty: 8,
  primary_pack_type: "Box",
  primary_pack_uom: "box",
  qty_per_pack: 1,
};

const approvedPrices: ChannelPriceRecord[] = [
  {
    channel: "retail",
    priceStatus: "approved",
    mrp: 1200,
    sellingPrice: 1000,
    currency: "INR",
  },
];

const moqRules: ChannelMoqRule[] = [
  { channel: "b2b", moqValue: 5, moqUom: "kg", moqApplicable: true },
];

const completeInput: ProductTruthInput = {
  productName: "Test",
  heroImageUrl: "https://x.com/a.jpg",
  hsnCode: "18069090",
  gstRate: "5",
  complianceApproved: true,
  primaryUom: "kg",
  mainDepartment: "ready_goods_store",
  productionDepartment: "dragees",
  packaging: { piecesPerKg: 40, kgPerTray: 1, traysPerMasterCarton: 8 },
  prices: approvedPrices,
};

describe("catalogueSnapshot", () => {
  it("blocks snapshot when compliance pending", () => {
    const readiness = evaluateProductReadiness({
      ...completeInput,
      complianceApproved: false,
      complianceMetaPending: true,
    });
    const gate = validateSnapshotGate(readiness, { complianceManuallyApproved: false });
    expect(gate.allowed).toBe(false);
    expect(gate.blockers.some((b) => b.toLowerCase().includes("compliance"))).toBe(true);
  });

  it("blocks snapshot when pricing pending", () => {
    const readiness = evaluateProductReadiness({
      ...completeInput,
      prices: [{ channel: "retail", priceStatus: "pending_approval", sellingPrice: 100 }],
    });
    const gate = validateSnapshotGate(readiness, { complianceManuallyApproved: true });
    expect(gate.allowed).toBe(false);
    expect(gate.blockers.some((b) => b.toLowerCase().includes("pricing"))).toBe(true);
  });

  it("includes UOM, packaging, channel, and pricing in snapshot", () => {
    const snap = generateCatalogueSnapshot({
      form: baseForm,
      productId: String(baseForm.id),
      complianceApproved: true,
      prices: approvedPrices,
      moqRules,
    });
    expect(snap.uom_conversion_rules.primary_uom).toBe("kg");
    expect(snap.packaging_hierarchy.primary_pack).toBeTruthy();
    expect(snap.channel_rules).toHaveLength(1);
    expect(snap.pricing_rules).toHaveLength(1);
    expect(snap.fulfillment_transform.conversion_rules?.length).toBeGreaterThan(0);
  });

  it("sets GST/HSN null unless manually approved", () => {
    const pending = generateCatalogueSnapshot({
      form: baseForm,
      productId: String(baseForm.id),
      complianceApproved: false,
      prices: approvedPrices,
    });
    expect(pending.compliance.gst_classification_status).toBe("manual_review_required");
    expect(pending.compliance.gst_hsn).toBeNull();
    expect(pending.compliance.gst_rate).toBeNull();

    const approved = generateCatalogueSnapshot({
      form: baseForm,
      productId: String(baseForm.id),
      complianceApproved: true,
      prices: approvedPrices,
    });
    expect(approved.compliance.gst_hsn).toBe("18069090");
    expect(approved.compliance.gst_rate).toBe("5");
  });

  it("treats approved snapshot status as immutable", () => {
    expect(isImmutableVersion("approved")).toBe(true);
    expect(isImmutableVersion("draft")).toBe(false);
  });

  it("validates Central connector payload shape", () => {
    const snap = generateCatalogueSnapshot({
      form: baseForm,
      productId: String(baseForm.id),
      complianceApproved: true,
      prices: approvedPrices,
      moqRules,
    });
    const truth = productTruthInputFromForm(baseForm, {
      complianceApproved: true,
      prices: approvedPrices,
      moqRules,
    });
    const readiness = evaluateProductReadiness(truth);
    const gate = validateSnapshotGate(readiness, { complianceManuallyApproved: true });
    const bundle = buildCentralSyncPreviewBundle({
      snapshot: snap,
      catalogueVersionId: "ver-1",
      versionCode: "PT-prod-v1",
      versionNumber: 1,
      validation: gate,
    });
    const check = validateApprovedCatalogueProductSnapshot(
      bundle.approved_catalogue_product_snapshot,
    );
    expect(check.valid).toBe(true);
    expect(bundle.preview_only).toBe(true);
    expect(bundle.no_live_central_write).toBe(true);
    expect(bundle.connector).toBe("25B/25C");
  });

  it("stale version is not treated as newer than head", () => {
    expect(isStaleCatalogueVersion(2, 5)).toBe(true);
    expect(isStaleCatalogueVersion(5, 5)).toBe(false);
    expect(isStaleCatalogueVersion(6, 5)).toBe(false);
  });

  it("preview mode does not live-write to Central", () => {
    expect(LIVE_CENTRAL_WRITE_ENABLED).toBe(false);
  });

  it("rejects mutating immutable version snapshot locally", async () => {
    const productId = "prod-immutable-test";
    const row = {
      id: "v-immutable",
      product_id: productId,
      sku_id: null,
      version_code: "PT-v1",
      version_number: 1,
      snapshot_json: generateCatalogueSnapshot({
        form: baseForm,
        productId,
        complianceApproved: true,
        prices: approvedPrices,
      }),
      status: "approved" as const,
      approved_by: null,
      approved_at: new Date().toISOString(),
      published_at: null,
      synced_to_central_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    localStorage.setItem(
      `oasis_catalogue_versions_${productId}`,
      JSON.stringify([row]),
    );

    const result = await updateCatalogueVersionSnapshot({
      productId,
      versionId: row.id,
      snapshot: row.snapshot_json,
    });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/mutate/i);
  });
});

describe("centralSyncPreviewService", () => {
  it("never enables live Central write flag", async () => {
    const mod = await import("./centralSyncPreviewService");
    expect(mod.LIVE_CENTRAL_WRITE_ENABLED).toBe(false);
  });
});
