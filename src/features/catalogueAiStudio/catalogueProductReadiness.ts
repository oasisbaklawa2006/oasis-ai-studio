/**
 * Deterministic, frontend-only readiness scoring for the Catalogue Product AI Studio.
 * Reads only existing `products` fields already available to this app — no new backend
 * status column is invented and no field is mutated here.
 */
import { hasNumber, hasText } from "./catalogueFieldUtils";

export type ReadinessState = "pass" | "warn" | "missing";

export interface ReadinessCategory {
  key: string;
  label: string;
  state: ReadinessState;
  detail: string;
  nextAction: string | null;
  /** Categories shown in the "Packaging + Variant Readiness" section. */
  group: "general" | "packaging";
}

export interface ReadinessResult {
  score: number;
  overallLabel: "Catalogue-ready" | "Needs attention" | "Not ready";
  categories: ReadinessCategory[];
}

export interface ReadinessProductInput {
  product_name?: string | null;
  description?: string | null;
  short_description?: string | null;
  sku?: string | null;
  category?: string | null;
  subcategory?: string | null;
  hero_image_url?: string | null;
  mrp?: number | null;
  b2b_price?: number | null;
  pack_size?: string | null;
  net_weight_g?: number | null;
  carton_qty?: number | null;
  master_carton_qty?: number | null;
  pcs_per_carton?: number | null;
  carton_dimensions_cm?: string | null;
  moq_text?: string | null;
  moq_value?: number | null;
  shelf_life_days?: number | null;
  storage_instructions?: string | null;
  hsn_code?: string | null;
  gst_rate?: number | null;
  is_active?: boolean | null;
  is_catalogue_ready?: boolean | null;
}

const STATE_POINTS: Record<ReadinessState, number> = { pass: 2, warn: 1, missing: 0 };

function buildIdentity(p: ReadinessProductInput): ReadinessCategory {
  if (!hasText(p.product_name)) {
    return { key: "identity", label: "Identity", state: "missing", detail: "Product name is blank.", nextAction: "Add a clear, buyer-recognizable product name.", group: "general" };
  }
  if (!hasText(p.description) && !hasText(p.short_description)) {
    return { key: "identity", label: "Identity", state: "warn", detail: "Name is set, but no description is set.", nextAction: "Add a short description so buyers understand what this product is.", group: "general" };
  }
  return { key: "identity", label: "Identity", state: "pass", detail: "Name and description are set.", nextAction: null, group: "general" };
}

function buildSku(p: ReadinessProductInput): ReadinessCategory {
  if (!hasText(p.sku)) {
    return { key: "sku", label: "SKU", state: "missing", detail: "No SKU code on this product.", nextAction: "Generate or set a SKU in Product Catalogue.", group: "general" };
  }
  return { key: "sku", label: "SKU", state: "pass", detail: `SKU: ${p.sku}`, nextAction: null, group: "general" };
}

function buildCategory(p: ReadinessProductInput): ReadinessCategory {
  if (!hasText(p.category)) {
    return { key: "category", label: "Category", state: "missing", detail: "No catalogue category set.", nextAction: "Set a Category so buyers can browse to this product.", group: "general" };
  }
  if (!hasText(p.subcategory)) {
    return { key: "category", label: "Category", state: "warn", detail: `Category is "${p.category}", but Subcategory is not set.`, nextAction: "Set Subcategory for finer catalogue navigation.", group: "general" };
  }
  return { key: "category", label: "Category", state: "pass", detail: `Category: ${p.category} · ${p.subcategory}`, nextAction: null, group: "general" };
}

function buildHeroImage(p: ReadinessProductInput): ReadinessCategory {
  if (!hasText(p.hero_image_url)) {
    return { key: "hero_image", label: "Hero Image", state: "missing", detail: "No hero image set.", nextAction: "Add a hero image in Media Library.", group: "general" };
  }
  return { key: "hero_image", label: "Hero Image", state: "pass", detail: "Hero image is set.", nextAction: null, group: "general" };
}

function buildPricing(p: ReadinessProductInput): ReadinessCategory {
  const hasMrp = hasNumber(p.mrp);
  const hasB2b = hasNumber(p.b2b_price);
  if (!hasMrp && !hasB2b) {
    return { key: "pricing", label: "Pricing", state: "missing", detail: "No MRP or B2B price set.", nextAction: "Set at least one price so catalogue/B2B copy can reference it.", group: "general" };
  }
  if (!hasMrp || !hasB2b) {
    return { key: "pricing", label: "Pricing", state: "warn", detail: !hasMrp ? "B2B price is set, MRP is blank." : "MRP is set, B2B price is blank.", nextAction: !hasMrp ? "Set MRP for retail listings." : "Set B2B price for wholesale copy.", group: "general" };
  }
  return { key: "pricing", label: "Pricing", state: "pass", detail: `MRP ₹${p.mrp} · B2B ₹${p.b2b_price}`, nextAction: null, group: "general" };
}

function buildCatalogueVisibility(p: ReadinessProductInput): ReadinessCategory {
  const isActive = p.is_active ?? true;
  const isReady = p.is_catalogue_ready ?? false;
  if (!isActive) {
    return { key: "catalogue_visibility", label: "Catalogue Visibility", state: "missing", detail: "Product is inactive.", nextAction: "Activate the product if this SKU should be usable again.", group: "general" };
  }
  if (!isReady) {
    return { key: "catalogue_visibility", label: "Catalogue Visibility", state: "warn", detail: "Active, but not yet marked catalogue-ready.", nextAction: "Confirm catalogue readiness in Product Catalogue once content is approved.", group: "general" };
  }
  return { key: "catalogue_visibility", label: "Catalogue Visibility", state: "pass", detail: "Active and catalogue-ready.", nextAction: null, group: "general" };
}

function buildPackSize(p: ReadinessProductInput): ReadinessCategory {
  const hasPack = hasText(p.pack_size);
  const hasWeight = hasNumber(p.net_weight_g);
  if (!hasPack && !hasWeight) {
    return { key: "pack_size", label: "Pack Size", state: "missing", detail: "No pack size or net weight set.", nextAction: "Set Pack Size and/or Net Weight.", group: "packaging" };
  }
  if (!hasPack || !hasWeight) {
    return { key: "pack_size", label: "Pack Size", state: "warn", detail: !hasPack ? "Net weight is set, Pack Size is blank." : "Pack Size is set, Net weight is blank.", nextAction: !hasPack ? "Set Pack Size." : "Set Net Weight (g).", group: "packaging" };
  }
  return { key: "pack_size", label: "Pack Size", state: "pass", detail: `${p.pack_size} · ${p.net_weight_g}g net`, nextAction: null, group: "packaging" };
}

function buildCartonPackaging(p: ReadinessProductInput): ReadinessCategory {
  const hasCartonQty = hasNumber(p.pcs_per_carton) || hasNumber(p.carton_qty) || hasNumber(p.master_carton_qty);
  const hasDims = hasText(p.carton_dimensions_cm);
  if (!hasCartonQty && !hasDims) {
    return { key: "carton_packaging", label: "Carton / Master Packaging", state: "missing", detail: "No carton quantity or carton dimensions set.", nextAction: "Fill in carton quantity and carton dimensions.", group: "packaging" };
  }
  if (!hasCartonQty || !hasDims) {
    return { key: "carton_packaging", label: "Carton / Master Packaging", state: "warn", detail: !hasCartonQty ? "Carton dimensions are set, carton quantity is blank." : "Carton quantity is set, carton dimensions are blank.", nextAction: !hasCartonQty ? "Set pieces/carton or master carton qty." : "Set carton dimensions (cm).", group: "packaging" };
  }
  return { key: "carton_packaging", label: "Carton / Master Packaging", state: "pass", detail: `Carton dims: ${p.carton_dimensions_cm}`, nextAction: null, group: "packaging" };
}

function buildMoq(p: ReadinessProductInput): ReadinessCategory {
  const hasMoq = hasText(p.moq_text) || hasNumber(p.moq_value);
  if (!hasMoq) {
    return { key: "moq", label: "MOQ", state: "missing", detail: "No minimum order quantity set.", nextAction: "Set an MOQ so B2B sales copy is complete.", group: "packaging" };
  }
  return { key: "moq", label: "MOQ", state: "pass", detail: `MOQ: ${p.moq_text ?? p.moq_value}`, nextAction: null, group: "packaging" };
}

function buildShelfStorage(p: ReadinessProductInput): ReadinessCategory {
  const hasShelf = hasNumber(p.shelf_life_days);
  const hasStorage = hasText(p.storage_instructions);
  if (!hasShelf && !hasStorage) {
    return { key: "shelf_storage", label: "Shelf Life / Storage", state: "missing", detail: "No shelf life or storage instructions set.", nextAction: "Set Shelf Life (days) and Storage Instructions.", group: "packaging" };
  }
  if (!hasShelf || !hasStorage) {
    return { key: "shelf_storage", label: "Shelf Life / Storage", state: "warn", detail: !hasShelf ? "Storage is set, Shelf Life (days) is blank." : "Shelf life is set, Storage Instructions is blank.", nextAction: !hasShelf ? "Set Shelf Life (days)." : "Set Storage Instructions.", group: "packaging" };
  }
  return { key: "shelf_storage", label: "Shelf Life / Storage", state: "pass", detail: `${p.shelf_life_days} days · ${p.storage_instructions}`, nextAction: null, group: "packaging" };
}

function buildExportCompliance(p: ReadinessProductInput): ReadinessCategory {
  const hasHsn = hasText(p.hsn_code);
  const hasGst = typeof p.gst_rate === "number";
  if (!hasHsn && !hasGst) {
    return { key: "export_compliance", label: "HSN / GST", state: "missing", detail: "No HSN code or GST rate set.", nextAction: "Set HSN Code and GST Rate for export/compliance copy.", group: "packaging" };
  }
  if (!hasHsn || !hasGst) {
    return { key: "export_compliance", label: "HSN / GST", state: "warn", detail: !hasHsn ? "GST rate is set, HSN Code is blank." : "HSN Code is set, GST rate is blank.", nextAction: !hasHsn ? "Set HSN Code." : "Set GST Rate.", group: "packaging" };
  }
  return { key: "export_compliance", label: "HSN / GST", state: "pass", detail: `HSN ${p.hsn_code} · GST ${p.gst_rate}%`, nextAction: null, group: "packaging" };
}

export function computeCatalogueProductReadiness(product: ReadinessProductInput): ReadinessResult {
  const categories = [
    buildIdentity(product),
    buildSku(product),
    buildCategory(product),
    buildHeroImage(product),
    buildPricing(product),
    buildCatalogueVisibility(product),
    buildPackSize(product),
    buildCartonPackaging(product),
    buildMoq(product),
    buildShelfStorage(product),
    buildExportCompliance(product),
  ];

  const earned = categories.reduce((sum, c) => sum + STATE_POINTS[c.state], 0);
  const possible = categories.length * STATE_POINTS.pass;
  const score = possible > 0 ? Math.round((earned / possible) * 100) : 0;

  const hasMissing = categories.some((c) => c.state === "missing");
  const allPass = categories.every((c) => c.state === "pass");
  const overallLabel: ReadinessResult["overallLabel"] =
    allPass && score >= 90 ? "Catalogue-ready" : hasMissing ? "Not ready" : "Needs attention";

  return { score, overallLabel, categories };
}
