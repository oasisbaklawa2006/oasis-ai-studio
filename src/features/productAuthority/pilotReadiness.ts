import {
  dbRowToProductForm,
  formToDbProductPayload,
  stripUnknownProductFields,
  validateProductSavePayload,
} from "./productSchemaAdapter";
import {
  assertStructuredSkuForSave,
  isDraftSku,
  isPilotSku,
  isStructuredOasisSku,
  PILOT_SKUS,
  PILOT_SKU_LABELS,
  type PilotSkuCode,
} from "./skuGuard";
import { resolveProductHeroUrl } from "@/lib/productImage";
import { supabase } from "@/integrations/supabase/client";
import { probeProductMediaBucket, evaluatePilotMediaForProduct } from "./mediaReadiness";
import { probePilotInfra, type PilotInfraReport } from "./infraProbe";
import { PILOT_COLLISION_HINTS } from "./pilotCollisionHints";

export type PilotCheckStatus = "pass" | "fail" | "partial" | "unknown";

export type PilotSkuReadiness = {
  sku: PilotSkuCode;
  label: string;
  productId: string | null;
  structuredSku: PilotCheckStatus;
  schemaSave: PilotCheckStatus;
  schemaSaveNotes: string[];
  hsnGst: PilotCheckStatus;
  hsnCode: string | null;
  gstRate: string | null;
  packaging: PilotCheckStatus;
  gramsPerPiece: number | null;
  piecesPerKg: number | null;
  heroImage: PilotCheckStatus;
  squareImage: PilotCheckStatus;
  aliasTermTypes: PilotCheckStatus;
  aliasCount: number;
  whatsappAliasCount: number;
  searchAliasCount: number;
  resolverCollisions: PilotCheckStatus;
  resolverNotes: string[];
  approvalRpc: PilotCheckStatus;
  approvalReady: PilotCheckStatus;
  ready: boolean;
  blockedReasons: string[];
};

export type PilotReadinessReport = {
  infra: PilotInfraReport;
  bucket: Awaited<ReturnType<typeof probeProductMediaBucket>>;
  skus: PilotSkuReadiness[];
  summary: {
    ready: number;
    total: number;
    percent: number;
    dimensionsPassing: number;
    dimensionsTotal: number;
    dimensionPercent: number;
  };
};

const WHATSAPP_ALIAS_TYPES = new Set([
  "whatsapp_keyword",
  "whatsapp",
  "wa_keyword",
]);

const SEARCH_ALIAS_TYPES = new Set([
  "search_keyword",
  "search_term",
  "search",
  "discovery",
]);

async function fetchPilotProduct(sku: PilotSkuCode) {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("sku", sku)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Record<string, unknown> | null;
}

function evaluateSchemaSave(row: Record<string, unknown> | null): {
  status: PilotCheckStatus;
  notes: string[];
} {
  if (!row) return { status: "fail", notes: ["Product row not found"] };
  const form = dbRowToProductForm(row, {});
  const payload = formToDbProductPayload(form);
  const { stripped } = stripUnknownProductFields(payload);
  const validation = validateProductSavePayload(payload, "update");
  const notes: string[] = [];
  if (stripped.length) notes.push(`Would strip legacy keys: ${stripped.join(", ")}`);
  if (!validation.ok) notes.push(`Missing: ${validation.missing.join(", ")}`);
  if (notes.length === 0) notes.push("Payload maps to Studio columns");
  return {
    status: validation.ok && stripped.length === 0 ? "pass" : validation.ok ? "partial" : "fail",
    notes,
  };
}

function countAliasTypes(aliases: Array<{ alias_type?: string | null }>) {
  let whatsapp = 0;
  let search = 0;
  for (const a of aliases) {
    const t = String(a.alias_type ?? "").toLowerCase();
    if (WHATSAPP_ALIAS_TYPES.has(t)) whatsapp += 1;
    if (SEARCH_ALIAS_TYPES.has(t)) search += 1;
  }
  return { whatsapp, search };
}

function evaluateAliasTermTypes(
  aliasCount: number,
  whatsapp: number,
  search: number,
): PilotCheckStatus {
  if (aliasCount === 0) return "fail";
  if (whatsapp >= 1 && search >= 1 && aliasCount >= 3) return "pass";
  if (whatsapp >= 1 || search >= 1 || aliasCount >= 3) return "partial";
  return "fail";
}

function evaluateApprovalReady(
  row: Record<string, unknown> | null,
  infra: PilotInfraReport,
  skuGuardOk: boolean,
  hsnGst: PilotCheckStatus,
  packaging: PilotCheckStatus,
  heroImage: PilotCheckStatus,
  aliasCount: number,
): { status: PilotCheckStatus; reasons: string[] } {
  const reasons: string[] = [];
  if (!row) reasons.push("Product row missing");
  if (!skuGuardOk) reasons.push("Structured SKU required");
  if (hsnGst !== "pass") reasons.push("HSN and GST must both be set");
  if (packaging !== "pass") reasons.push("grams_per_piece and pieces_per_kg required");
  if (heroImage !== "pass") reasons.push("Hero image required");
  if (aliasCount < 3) reasons.push("At least 3 active aliases required for pilot approval");
  if (infra.approveProductDraftRpc.status === "fail") {
    reasons.push("approve_catalogue_product_draft RPC not deployed");
  }
  if (infra.mediaBucket.status === "missing") {
    reasons.push("product-media bucket missing — uploads will fail");
  }
  return { status: reasons.length === 0 ? "pass" : reasons.length <= 2 ? "partial" : "fail", reasons };
}

export async function evaluatePilotSku(
  sku: PilotSkuCode,
  infra: PilotInfraReport,
): Promise<PilotSkuReadiness> {
  const label = PILOT_SKU_LABELS[sku];
  const blockedReasons: string[] = [];

  let row: Record<string, unknown> | null = null;
  try {
    row = await fetchPilotProduct(sku);
  } catch (e) {
    blockedReasons.push(e instanceof Error ? e.message : "Load failed");
  }

  const skuGuard = assertStructuredSkuForSave(row?.sku as string, { pilotOnly: false });
  const structuredSku: PilotCheckStatus = skuGuard.ok
    ? "pass"
    : isDraftSku(row?.sku as string)
      ? "fail"
      : "partial";
  if (!skuGuard.ok) blockedReasons.push(skuGuard.reason);

  const schema = evaluateSchemaSave(row);
  if (schema.status === "fail") blockedReasons.push(...schema.notes);

  const hsnCode = row?.hsn_code ? String(row.hsn_code) : null;
  const gstRate = row?.gst_rate != null ? String(row.gst_rate) : null;
  const hsnGst: PilotCheckStatus = hsnCode && gstRate ? "pass" : hsnCode || gstRate ? "partial" : "fail";
  if (hsnGst !== "pass") blockedReasons.push("HSN and/or GST missing on product row");

  const gramsPerPiece =
    row?.grams_per_piece != null
      ? Number(row.grams_per_piece)
      : row?.weight_per_pc_grams != null
        ? Number(row.weight_per_pc_grams)
        : row?.approximate_piece_weight_g != null
          ? Number(row.approximate_piece_weight_g)
          : null;
  const piecesPerKg =
    row?.pcs_per_kg != null
      ? Number(row.pcs_per_kg)
      : row?.pieces_per_kg != null
        ? Number(row.pieces_per_kg)
        : null;
  const gpp = gramsPerPiece ?? 0;
  const ppk = piecesPerKg ?? 0;
  const packaging: PilotCheckStatus = gpp > 0 && ppk > 0 ? "pass" : gpp > 0 || ppk > 0 ? "partial" : "fail";
  if (packaging !== "pass") {
    blockedReasons.push(
      `Packaging: grams_per_piece=${gpp || "null"}, pcs_per_kg=${ppk || "null"}`,
    );
  }

  let heroImage: PilotCheckStatus = "fail";
  let squareImage: PilotCheckStatus = "fail";
  if (row?.id) {
    const heroUrl = resolveProductHeroUrl(row as { hero_image_url?: string; image_url?: string });
    heroImage = heroUrl ? "pass" : "fail";
    if (!heroUrl) blockedReasons.push("Hero image missing (hero_image_url and image_url both empty)");

    const media = await evaluatePilotMediaForProduct({
      id: String(row.id),
      sku: String(row.sku),
      hero_image_url: row.hero_image_url as string,
      image_url: row.image_url as string,
    });
    squareImage = media.squarePresent ? "pass" : "fail";
    if (!media.squarePresent) blockedReasons.push("Square/white-background product_media row missing");
  } else {
    blockedReasons.push("No product row — cannot check media");
  }

  let aliasCount = 0;
  let whatsappAliasCount = 0;
  let searchAliasCount = 0;
  if (row?.id) {
    const { data: aliases } = await supabase
      .from("product_aliases")
      .select("id, alias, alias_type, is_active")
      .eq("product_id", row.id)
      .eq("is_active", true);
    aliasCount = aliases?.length ?? 0;
    const typed = countAliasTypes(aliases ?? []);
    whatsappAliasCount = typed.whatsapp;
    searchAliasCount = typed.search;
    if (aliasCount < 3) blockedReasons.push(`Only ${aliasCount} active aliases (need ≥3)`);
    if (whatsappAliasCount < 1) blockedReasons.push("No WhatsApp keyword alias in DB (alias_type)");
    if (searchAliasCount < 1) blockedReasons.push("No search keyword alias in DB (alias_type)");
  }

  const aliasTermTypes = evaluateAliasTermTypes(aliasCount, whatsappAliasCount, searchAliasCount);

  const collision = PILOT_COLLISION_HINTS[sku];
  const resolverCollisions: PilotCheckStatus = collision.status;
  const resolverNotes = collision.notes;
  if (resolverCollisions === "partial") {
    blockedReasons.push(...resolverNotes);
  }

  const approvalRpc: PilotCheckStatus =
    infra.approveProductDraftRpc.status === "pass"
      ? "pass"
      : infra.approveProductDraftRpc.status === "fail"
        ? "fail"
        : "partial";

  const approval = evaluateApprovalReady(
    row,
    infra,
    skuGuard.ok,
    hsnGst,
    packaging,
    heroImage,
    aliasCount,
  );
  if (approval.status !== "pass") blockedReasons.push(...approval.reasons);

  const ready =
    structuredSku === "pass" &&
    schema.status !== "fail" &&
    hsnGst === "pass" &&
    packaging === "pass" &&
    heroImage === "pass" &&
    aliasCount >= 3 &&
    whatsappAliasCount >= 1 &&
    !!row?.id;

  return {
    sku,
    label,
    productId: row?.id ? String(row.id) : null,
    structuredSku,
    schemaSave: schema.status,
    schemaSaveNotes: schema.notes,
    hsnGst,
    hsnCode,
    gstRate,
    packaging,
    gramsPerPiece: gramsPerPiece && gramsPerPiece > 0 ? gramsPerPiece : null,
    piecesPerKg: piecesPerKg && piecesPerKg > 0 ? piecesPerKg : null,
    heroImage,
    squareImage,
    aliasTermTypes,
    aliasCount,
    whatsappAliasCount,
    searchAliasCount,
    resolverCollisions,
    resolverNotes,
    approvalRpc,
    approvalReady: approval.status,
    ready,
    blockedReasons: [...new Set(blockedReasons)],
  };
}

function dimensionScore(skus: PilotSkuReadiness[]): { passing: number; total: number } {
  const dims = (s: PilotSkuReadiness) => [
    s.structuredSku === "pass",
    s.schemaSave !== "fail",
    s.hsnGst === "pass",
    s.packaging === "pass",
    s.heroImage === "pass",
    s.squareImage === "pass",
    s.aliasCount >= 3,
    s.whatsappAliasCount >= 1,
    s.searchAliasCount >= 1,
    s.approvalReady === "pass",
  ];
  let passing = 0;
  let total = 0;
  for (const s of skus) {
    for (const ok of dims(s)) {
      total += 1;
      if (ok) passing += 1;
    }
  }
  return { passing, total };
}

export async function evaluateAllPilotSkus(): Promise<PilotReadinessReport> {
  const infra = await probePilotInfra();
  const bucket = infra.mediaBucket;
  const skus = await Promise.all(PILOT_SKUS.map((s) => evaluatePilotSku(s, infra)));
  const ready = skus.filter((s) => s.ready).length;
  const dim = dimensionScore(skus);
  return {
    infra,
    bucket,
    skus,
    summary: {
      ready,
      total: PILOT_SKUS.length,
      percent: Math.round((ready / PILOT_SKUS.length) * 100),
      dimensionsPassing: dim.passing,
      dimensionsTotal: dim.total,
      dimensionPercent: dim.total ? Math.round((dim.passing / dim.total) * 100) : 0,
    },
  };
}

export function pilotSkuCodes(): readonly PilotSkuCode[] {
  return PILOT_SKUS;
}

export { isPilotSku, isStructuredOasisSku, PILOT_SKU_LABELS };
