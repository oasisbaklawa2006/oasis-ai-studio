#!/usr/bin/env node
/**
 * Read-only 5-SKU pilot completion verifier.
 * Requires VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY in environment or .env.
 * No master writes. Safe to run in CI with read-only anon key.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const PILOT_SKUS = [
  { sku: "OAS-AS-BKL-0024", label: "Mor Pistachio Durum" },
  { sku: "OAS-AS-BKL-0020", label: "Tart Cashew" },
  { sku: "OAS-AS-BKL-0001", label: "Cashew Kitta" },
  { sku: "OAS-AS-BKL-0025", label: "Coconut Durum" },
  { sku: "OAS-AS-BKL-0007", label: "Cashew Finger" },
];

function loadEnv() {
  const path = join(ROOT, ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const k = m[1].trim();
    const v = m[2].trim().replace(/^["']|["']$/g, "");
    if (!process.env[k]) process.env[k] = v;
  }
}

function status(ok, partial = false) {
  if (ok) return "pass";
  if (partial) return "partial";
  return "fail";
}

function csvEscape(v) {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function main() {
  loadEnv();
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY — set in .env");
    process.exit(2);
  }

  const supabase = createClient(url, key);
  const projectRef = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? "unknown";
  console.log(`Probing project ${projectRef} at ${new Date().toISOString()}\n`);

  const infra = {};

  const bucketRes = await supabase.storage.from("product-media").list("", { limit: 1 });
  infra.mediaBucket = bucketRes.error
    ? /not found|404/i.test(bucketRes.error.message)
      ? "missing"
      : "error"
    : "available";
  console.log(`product-media bucket: ${infra.mediaBucket}`);

  const skuRpc = await supabase.rpc("generate_oasis_sku", {
    _division_code: "AS",
    _category_code: "BKL",
    _subcategory_code: "ASS",
    _packaging_code: "LOOSE",
  });
  infra.generateOasisSku = skuRpc.error ? "fail" : "pass";
  console.log(`generate_oasis_sku: ${infra.generateOasisSku}${skuRpc.error ? ` (${skuRpc.error.message})` : skuRpc.data ? ` → ${skuRpc.data}` : ""}`);

  const searchRpc = await supabase.rpc("search_products_with_aliases", { _q: "cashew" });
  infra.searchProductsWithAliases = searchRpc.error ? "fail" : "pass";
  console.log(`search_products_with_aliases: ${infra.searchProductsWithAliases}${searchRpc.error ? ` (${searchRpc.error.message})` : ` (${(searchRpc.data ?? []).length} hits)`}`);

  const probeId = "00000000-0000-0000-0000-000000000001";
  const approveRpc = await supabase.rpc("approve_catalogue_product_draft", { draft_id: probeId });
  infra.approveProductDraft = /could not find the function|does not exist/i.test(approveRpc.error?.message ?? "")
    ? "fail"
    : "pass";
  console.log(`approve_catalogue_product_draft: ${infra.approveProductDraft}`);

  const rows = [];
  let readyCount = 0;

  for (const { sku, label } of PILOT_SKUS) {
    const { data: product, error } = await supabase.from("products").select("*").eq("sku", sku).maybeSingle();
    if (error) throw error;

    const structuredSku = product?.sku && !/^DRAFT-/i.test(product.sku) ? "pass" : "fail";
    const hsn = product?.hsn_code ? String(product.hsn_code) : "";
    const gst = product?.gst_rate != null ? String(product.gst_rate) : "";
    const hsnGst = status(hsn && gst, hsn || gst);
    const gpp = Number(product?.approximate_piece_weight_g ?? 0);
    const ppk = Number(product?.pieces_per_kg ?? 0);
    const packaging = status(gpp > 0 && ppk > 0, gpp > 0 || ppk > 0);
    const hero = product?.hero_image_url || product?.image_url;
    const heroImage = hero ? "pass" : "fail";

    let squareImage = "fail";
    let aliasCount = 0;
    let waCount = 0;
    let searchCount = 0;
    if (product?.id) {
      const { data: media } = await supabase
        .from("product_media")
        .select("type")
        .eq("product_id", product.id);
      const types = new Set((media ?? []).map((m) => String(m.type ?? "").toLowerCase()));
      squareImage = types.has("square_image") || types.has("white_background") || types.has("hero_image") ? "pass" : "fail";

      const { data: aliases } = await supabase
        .from("product_aliases")
        .select("alias_type")
        .eq("product_id", product.id)
        .eq("is_active", true);
      aliasCount = aliases?.length ?? 0;
      for (const a of aliases ?? []) {
        const t = String(a.alias_type ?? "").toLowerCase();
        if (t.includes("whatsapp")) waCount += 1;
        if (t.includes("search")) searchCount += 1;
      }
    }

    const ready =
      structuredSku === "pass" &&
      hsnGst === "pass" &&
      packaging === "pass" &&
      heroImage === "pass" &&
      aliasCount >= 3 &&
      waCount >= 1;
    if (ready) readyCount += 1;

    const blocked = [];
    if (structuredSku !== "pass") blocked.push("structured_sku");
    if (hsnGst !== "pass") blocked.push("hsn_gst");
    if (packaging !== "pass") blocked.push("packaging");
    if (heroImage !== "pass") blocked.push("hero_image");
    if (squareImage !== "pass") blocked.push("square_image");
    if (aliasCount < 3) blocked.push("alias_count");
    if (waCount < 1) blocked.push("whatsapp_alias");
    if (searchCount < 1) blocked.push("search_alias");

    rows.push({
      sku,
      label,
      product_id: product?.id ?? "",
      structured_sku: structuredSku,
      hsn_gst: hsnGst,
      grams_per_piece: gpp || "",
      pcs_per_kg: ppk || "",
      hero_image: heroImage,
      square_image: squareImage,
      alias_count: aliasCount,
      whatsapp_aliases: waCount,
      search_aliases: searchCount,
      resolver_collisions: "see_collision_hints",
      approval_ready: ready ? "pass" : "fail",
      ready_gate: ready ? "pass" : "fail",
      blocked_reasons: blocked.join(";"),
    });

    console.log(`\n${sku} ${label}: ready=${ready ? "YES" : "NO"}`);
    console.log(`  HSN/GST: ${hsnGst} | packaging: ${packaging} | hero: ${heroImage} | aliases: ${aliasCount} (wa ${waCount})`);
  }

  const pct = Math.round((readyCount / PILOT_SKUS.length) * 100);
  console.log(`\n=== Summary: ${readyCount}/${PILOT_SKUS.length} ready (${pct}%) ===`);

  const outDir = join(ROOT, "data/pilot");
  mkdirSync(outDir, { recursive: true });
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(","))].join("\n");
  const outPath = join(outDir, "ai_studio_5sku_readiness_matrix.csv");
  writeFileSync(outPath, csv + "\n");
  console.log(`\nWrote ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
