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

export type PilotCheckStatus = "pass" | "fail" | "partial" | "unknown";

export type PilotSkuReadiness = {
  sku: PilotSkuCode;
  label: string;
  productId: string | null;
  structuredSku: PilotCheckStatus;
  schemaSave: PilotCheckStatus;
  schemaSaveNotes: string[];
  hsnGst: PilotCheckStatus;
  packaging: PilotCheckStatus;
  heroImage: PilotCheckStatus;
  squareImage: PilotCheckStatus;
  aliasTermTypes: PilotCheckStatus;
  aliasCount: number;
  resolverCollisions: PilotCheckStatus;
  approvalRpc: PilotCheckStatus;
  ready: boolean;
  blockedReasons: string[];
};

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

export async function evaluatePilotSku(sku: PilotSkuCode): Promise<PilotSkuReadiness> {
  const label = PILOT_SKU_LABELS[sku];
  const blockedReasons: string[] = [];

  let row: Record<string, unknown> | null = null;
  try {
    row = await fetchPilotProduct(sku);
  } catch (e) {
    blockedReasons.push(e instanceof Error ? e.message : "Load failed");
  }

  const skuGuard = assertStructuredSkuForSave(row?.sku as string, { pilotOnly: false });
  const structuredSku: PilotCheckStatus = skuGuard.ok ? "pass" : isDraftSku(row?.sku as string) ? "fail" : "partial";

  const schema = evaluateSchemaSave(row);
  if (schema.status === "fail") blockedReasons.push(...schema.notes);

  const hsn = row?.hsn_code ? String(row.hsn_code) : "";
  const gst = row?.gst_rate != null ? String(row.gst_rate) : "";
  const hsnGst: PilotCheckStatus = hsn && gst ? "pass" : hsn || gst ? "partial" : "fail";
  if (hsnGst !== "pass") blockedReasons.push("HSN and/or GST missing");

  const gpp = Number(row?.approximate_piece_weight_g ?? 0);
  const ppk = Number(row?.pieces_per_kg ?? 0);
  const packaging: PilotCheckStatus = gpp > 0 && ppk > 0 ? "pass" : gpp > 0 || ppk > 0 ? "partial" : "fail";
  if (packaging !== "pass") blockedReasons.push("grams_per_piece / pieces_per_kg not set");

  let heroImage: PilotCheckStatus = "fail";
  let squareImage: PilotCheckStatus = "fail";
  if (row?.id) {
    const heroUrl = resolveProductHeroUrl(row as { hero_image_url?: string; image_url?: string });
    heroImage = heroUrl ? "pass" : "fail";
    if (!heroUrl) blockedReasons.push("Hero image missing");

    const media = await evaluatePilotMediaForProduct({
      id: String(row.id),
      sku: String(row.sku),
      hero_image_url: row.hero_image_url as string,
      image_url: row.image_url as string,
    });
    squareImage = media.squarePresent ? "pass" : "fail";
    if (!media.squarePresent) blockedReasons.push("Square/white-background media missing");
  } else {
    blockedReasons.push("No product row — cannot check media");
  }

  let aliasCount = 0;
  let aliasTermTypes: PilotCheckStatus = "unknown";
  if (row?.id) {
    const { data: aliases } = await supabase
      .from("product_aliases")
      .select("id, alias, alias_type, is_active")
      .eq("product_id", row.id)
      .eq("is_active", true);
    aliasCount = aliases?.length ?? 0;
    aliasTermTypes = aliasCount >= 3 ? "partial" : aliasCount > 0 ? "partial" : "fail";
    if (aliasCount < 3) blockedReasons.push("Fewer than 3 active aliases");
    blockedReasons.push("Term types (WhatsApp/search) are UI-localStorage until DB migration — see alias plan");
  }

  const resolverCollisions: PilotCheckStatus = "unknown";

  const approvalRpc: PilotCheckStatus = "unknown";

  const ready =
    structuredSku === "pass" &&
    schema.status !== "fail" &&
    hsnGst === "pass" &&
    packaging === "pass" &&
    heroImage === "pass" &&
    aliasCount >= 1 &&
    !!row?.id;

  return {
    sku,
    label,
    productId: row?.id ? String(row.id) : null,
    structuredSku,
    schemaSave: schema.status,
    schemaSaveNotes: schema.notes,
    hsnGst,
    packaging,
    heroImage,
    squareImage,
    aliasTermTypes,
    aliasCount,
    resolverCollisions,
    approvalRpc,
    ready,
    blockedReasons,
  };
}

export async function evaluateAllPilotSkus(): Promise<{
  bucket: Awaited<ReturnType<typeof probeProductMediaBucket>>;
  skus: PilotSkuReadiness[];
  summary: { ready: number; total: number; percent: number };
}> {
  const bucket = await probeProductMediaBucket();
  const skus = await Promise.all(PILOT_SKUS.map((s) => evaluatePilotSku(s)));
  const ready = skus.filter((s) => s.ready).length;
  return {
    bucket,
    skus,
    summary: {
      ready,
      total: PILOT_SKUS.length,
      percent: Math.round((ready / PILOT_SKUS.length) * 100),
    },
  };
}

export function pilotSkuCodes(): readonly PilotSkuCode[] {
  return PILOT_SKUS;
}

export { isPilotSku, isStructuredOasisSku, PILOT_SKU_LABELS };
