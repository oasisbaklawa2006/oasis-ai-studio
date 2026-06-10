#!/usr/bin/env node
/**
 * Wave 4A packaging authority preview — no DB writes, no draft submission.
 * Outputs:
 *   data/packaging/batch001_packaging_update_preview.csv
 *   data/packaging/batch001_packaging_collision_report.json
 *   data/packaging/batch001_packaging_drafts_payload.json
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "data/packaging");

const PRODUCT_IDS = {
  "OAS-AS-BKL-0001": "c7c0c5aa-1d2f-4088-88f1-1e5aacd321a0",
  "OAS-AS-BKL-0002": "89de33c7-e4c1-475e-b711-18258683fdec",
  "OAS-AS-BKL-0003": "90e0f9df-d4dc-4ec5-8238-d7a2624e759a",
  "OAS-AS-BKL-0004": "eb9c7a73-d1df-4bea-bdf1-209a5b386262",
  "OAS-AS-BKL-0005": "691f2fe6-2d25-4ce2-a9fd-d4b81ecb694b",
  "OAS-AS-BKL-0006": "da4372b9-e1b3-4b17-bdd0-278bd636ab9a",
  "OAS-AS-BKL-0007": "2390ea3d-19ba-43bb-8624-d6b033153c2f",
  "OAS-AS-BKL-0008": "a6013e20-0fc7-4fe6-b2ab-f7f82d336b0c",
  "OAS-AS-BKL-0009": "c522fa96-9247-4cf5-9699-a20bc316dc55",
  "OAS-AS-BKL-0010": "7d66f253-a179-4a33-b8ba-7b94ec783a3e",
  "OAS-AS-BKL-0011": "2178c1c7-80c2-4ba3-a211-8643dcf57777",
  "OAS-AS-BKL-0012": "4baff7d1-bf58-4d0f-b842-c53f99caac61",
  "OAS-AS-BKL-0013": "c5e84d04-0d8b-4466-8690-a7e6267b44a8",
  "OAS-AS-BKL-0014": "4af95ba1-ff0f-4740-8869-6a19a41e8c83",
  "OAS-AS-BKL-0015": "73f91572-8844-4fa6-b267-56210d180468",
  "OAS-AS-BKL-0016": "f3f7a8fd-cea8-4ecb-a258-ef1ea86940b7",
  "OAS-AS-BKL-0017": "0cb6c64c-0529-4dfc-83cd-9b45ab7f9de6",
  "OAS-AS-BKL-0018": "2cab3d7f-7593-441e-a030-6ac6ad3ed9bc",
  "OAS-AS-BKL-0019": "636b47cb-ea6f-4711-ae29-d6153e565ae3",
  "OAS-AS-BKL-0020": "b0aee1c4-4502-4a15-9880-e2c01378c0b5",
  "OAS-AS-BKL-0021": "6b258e44-69dc-465a-b82a-cbb72f68d723",
  "OAS-AS-BKL-0022": "8554f5d5-5e46-4ffe-b98a-0ed10ec522ae",
  "OAS-AS-BKL-0023": "43a25d30-f7d9-426b-b5af-cae7d477468e",
  "OAS-AS-BKL-0024": "cea65af8-129c-4838-988f-30955fa5bc22",
  "OAS-AS-BKL-0025": "f58e0a78-53a9-400b-8768-7af09b68ba38",
};

const SKU_NAMES = {
  "OAS-AS-BKL-0001": "Cashew Kitta",
  "OAS-AS-BKL-0002": "Square Baklawa",
  "OAS-AS-BKL-0003": "Cashew Ring",
  "OAS-AS-BKL-0004": "Cashew Rosebud",
  "OAS-AS-BKL-0005": "Almond Crosole",
  "OAS-AS-BKL-0006": "Cashew Pyramid",
  "OAS-AS-BKL-0007": "Cashew Finger",
  "OAS-AS-BKL-0008": "Date Baklawa",
  "OAS-AS-BKL-0009": "Special Square Baklawa",
  "OAS-AS-BKL-0010": "Pistachio Ring",
  "OAS-AS-BKL-0011": "Pistachio Pyramid(Topping)",
  "OAS-AS-BKL-0012": "Chocolate Pistachio Asiyah",
  "OAS-AS-BKL-0013": "Chocolate Cashew Asiyah",
  "OAS-AS-BKL-0014": "Mor Cashew Asiyah",
  "OAS-AS-BKL-0015": "Mor Pistachio Asiyah",
  "OAS-AS-BKL-0016": "Pistachio Asiyah",
  "OAS-AS-BKL-0017": "Cashew Asiyah",
  "OAS-AS-BKL-0018": "Diamond Pistachio",
  "OAS-AS-BKL-0019": "Pistachio Pyramid",
  "OAS-AS-BKL-0020": "Tart Cashew",
  "OAS-AS-BKL-0021": "Mix Nut Tart",
  "OAS-AS-BKL-0022": "Almond Tart",
  "OAS-AS-BKL-0023": "Pistachio Tart",
  "OAS-AS-BKL-0024": "Mor Pistachio Durum",
  "OAS-AS-BKL-0025": "Coconut Durum",
};

/** Secondary pack code → proposed tray interpretation */
const SECONDARY_PACK_MAP = {
  "666": { label: "666 Tray (3kg)", primaryKg: 3, packsPerMasterCarton: null, needsHuman: false },
  "888": { label: "888 Tray (6kg)", primaryKg: 6, packsPerMasterCarton: null, needsHuman: false },
  Mappet: { label: "Mappet Tray (1kg)", primaryKg: 1, packsPerMasterCarton: null, needsHuman: true },
};

function parsePrimaryKg(raw) {
  const m = String(raw ?? "").trim().match(/^(\d+(?:\.\d+)?)\s*kg$/i);
  return m ? Number(m[1]) : null;
}

function parseCsvAuthority() {
  const raw = readFileSync(
    join(ROOT, "data/category1-preview/CATEGORY1_IMPORT_BATCH_001_uploaded.csv"),
    "utf8",
  );
  const byName = new Map();
  for (const line of raw.split("\n").slice(2).filter(Boolean)) {
    const cols = line.split(",");
    const sno = parseInt(cols[0], 10);
    if (!sno || sno < 1 || sno > 24) continue;
    const sku = `OAS-AS-BKL-${String(sno).padStart(4, "0")}`;
    byName.set(sku, {
      sku,
      product_name: cols[3]?.trim(),
      weight_g: cols[15]?.trim() ? Number(cols[15].trim()) : null,
      carton_qty: cols[16]?.trim() || null,
      primary_packing: cols[17]?.trim() || null,
      secondary_packing: cols[18]?.trim() || null,
    });
  }
  return byName;
}

function derivePcsPerKg(grams) {
  if (!grams || grams <= 0) return null;
  return Math.round((1000 / grams) * 100) / 100;
}

function derivePcsPerPrimaryPack(grams, primaryKg) {
  if (!grams || !primaryKg) return null;
  return Math.round((primaryKg * 1000) / grams);
}

function validateWeightRange(grams) {
  if (grams == null) return { ok: false, code: "missing_weight" };
  if (grams < 8 || grams > 35) return { ok: false, code: "weight_out_of_range" };
  return { ok: true };
}

function validateConversion(hierarchy) {
  const messages = [];
  if (!hierarchy.piecesPerKg && !hierarchy.gramsPerPiece) {
    messages.push("piecesPerKg or gramsPerPiece required");
  }
  if (hierarchy.kgPerTray != null && hierarchy.kgPerTray <= 0) {
    messages.push("kgPerTray must be positive");
  }
  return { valid: messages.length === 0, messages };
}

function buildRow(sku, csvRow) {
  const productName = SKU_NAMES[sku] ?? csvRow?.product_name ?? sku;
  const weightG = csvRow?.weight_g ?? null;
  const primaryRaw = csvRow?.primary_packing ?? null;
  const secondaryRaw = csvRow?.secondary_packing ?? null;
  const primaryKg = parsePrimaryKg(primaryRaw);
  const secondary = secondaryRaw ? SECONDARY_PACK_MAP[secondaryRaw] : null;
  const pcsPerKg = derivePcsPerKg(weightG);
  const pcsPerPrimary = derivePcsPerPrimaryPack(weightG, primaryKg ?? secondary?.primaryKg);
  const weightCheck = validateWeightRange(weightG);
  const hierarchy = {
    gramsPerPiece: weightG,
    piecesPerKg: pcsPerKg,
    kgPerTray: primaryKg ?? secondary?.primaryKg ?? null,
    packsPerCarton: 1,
    traysPerMasterCarton: csvRow?.carton_qty ? Number(csvRow.carton_qty) : null,
  };
  const conversion = validateConversion(hierarchy);

  const issues = [];
  if (!csvRow) issues.push({ level: "error", code: "missing_csv_row", message: "No authority CSV row" });
  if (!weightCheck.ok) issues.push({ level: "error", code: weightCheck.code, message: `Weight issue: ${weightCheck.code}` });
  if (!primaryKg) issues.push({ level: "warning", code: "primary_pack_unparsed", message: `Cannot parse primary pack: ${primaryRaw}` });
  if (!secondary) issues.push({ level: "warning", code: "secondary_pack_unknown", message: `Unknown secondary code: ${secondaryRaw}` });
  if (secondary?.needsHuman) issues.push({ level: "warning", code: "mappet_confirm", message: "Mappet tray pcs/carton needs product team confirm" });
  if (!csvRow?.carton_qty) issues.push({ level: "info", code: "carton_qty_empty", message: "Carton Qty empty in authority CSV" });
  if (!conversion.valid) issues.push({ level: "error", code: "conversion_invalid", message: conversion.messages.join("; ") });

  const readiness =
    issues.some((i) => i.level === "error") ? "NEEDS_HUMAN" :
    issues.some((i) => i.level === "warning") ? "REVIEW" : "READY";

  return {
    sku,
    product_id: PRODUCT_IDS[sku],
    product_name: productName,
    authority_weight_g: weightG,
    authority_primary_packing: primaryRaw,
    authority_secondary_packing: secondaryRaw,
    authority_carton_qty: csvRow?.carton_qty ?? "",
    proposed_grams_per_piece: weightG,
    proposed_weight_per_pc_grams: weightG,
    proposed_pcs_per_kg: pcsPerKg,
    proposed_primary_pack_weight_kg: primaryKg,
    proposed_kg_per_primary_pack: primaryKg,
    proposed_primary_pack_type: primaryRaw ? `Tray ${primaryRaw}` : "",
    proposed_secondary_pack_type: secondary?.label ?? secondaryRaw ?? "",
    proposed_carton_type: secondaryRaw ?? "",
    proposed_pcs_per_primary_pack: pcsPerPrimary,
    proposed_retail_pack_qty: pcsPerPrimary,
    proposed_packs_per_carton: 1,
    proposed_pcs_per_master_carton: pcsPerPrimary,
    proposed_packs_per_master_carton: csvRow?.carton_qty ? Number(csvRow.carton_qty) : null,
    db_pack_size_current: primaryRaw ?? "",
    db_grams_per_piece_current: "",
    db_pcs_per_kg_current: "0",
    moq_current: "1",
    moq_proposed: "",
    readiness,
    issue_codes: issues.map((i) => i.code).join("|"),
    issue_summary: issues.map((i) => i.message).join("; "),
    hierarchy,
    issues,
  };
}

function buildDraftPayload(row) {
  return {
    source_app: "catalogue_app",
    target_table: "products",
    target_record_id: row.product_id,
    operation: "update",
    payload: {
      packaging_authority_republish: true,
      source: "batch001_packaging_wave4a",
      identity: { product_name: row.product_name },
      sku_draft: { sku: row.sku },
      uom: {
        primary_uom: "KG",
        approx_piece_weight_g: row.proposed_grams_per_piece,
        pieces_per_kg: row.proposed_pcs_per_kg,
        unit_conversion_note: "Wave 4A packaging authority republish",
      },
      packing: {
        primary_pack_type: row.proposed_primary_pack_type,
        pack_size: row.authority_primary_packing,
        secondary_pack_type: row.proposed_secondary_pack_type,
        carton_type: row.proposed_carton_type,
        net_weight_g: row.proposed_grams_per_piece,
        packaging_scalars: {
          grams_per_piece: row.proposed_grams_per_piece,
          weight_per_pc_grams: row.proposed_weight_per_pc_grams,
          pcs_per_kg: row.proposed_pcs_per_kg,
          primary_pack_weight_kg: row.proposed_primary_pack_weight_kg,
          kg_per_primary_pack: row.proposed_kg_per_primary_pack,
          pcs_per_primary_pack: row.proposed_pcs_per_primary_pack,
          retail_pack_qty: row.proposed_retail_pack_qty,
          packs_per_carton: row.proposed_packs_per_carton,
          pcs_per_master_carton: row.proposed_pcs_per_master_carton,
          packs_per_master_carton: row.proposed_packs_per_master_carton,
        },
      },
      packaging_hierarchy: row.hierarchy,
      needs_admin_review_flags: {
        packaging_conversion: true,
        mappet_tray: row.issue_codes.includes("mappet_confirm"),
        missing_weight: row.issue_codes.includes("missing_weight"),
      },
      import_meta: {
        batch_id: "batch001_packaging_wave4a",
        source_file: "data/category1-preview/CATEGORY1_IMPORT_BATCH_001_uploaded.csv",
        submitted_via: "packaging_preview_generator",
      },
    },
    status: "pending_approval",
    submitted_by: "a3904c02-3305-4fa7-b0c0-f1a30d7e1fd6",
  };
}

function toCsv(rows) {
  const headers = [
    "sku",
    "product_name",
    "readiness",
    "authority_weight_g",
    "authority_primary_packing",
    "authority_secondary_packing",
    "authority_carton_qty",
    "proposed_grams_per_piece",
    "proposed_pcs_per_kg",
    "proposed_primary_pack_weight_kg",
    "proposed_primary_pack_type",
    "proposed_secondary_pack_type",
    "proposed_carton_type",
    "proposed_pcs_per_primary_pack",
    "proposed_retail_pack_qty",
    "proposed_pcs_per_master_carton",
    "proposed_packs_per_master_carton",
    "db_pack_size_current",
    "db_grams_per_piece_current",
    "db_pcs_per_kg_current",
    "moq_current",
    "issue_codes",
    "issue_summary",
  ];
  const esc = (v) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n") + "\n";
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const csvAuthority = parseCsvAuthority();
  const skus = Object.keys(PRODUCT_IDS).sort();
  const rows = skus.map((sku) => buildRow(sku, csvAuthority.get(sku)));

  const collision = {
    generated_at: new Date().toISOString(),
    batch: "batch001_packaging_wave4a",
    total_skus: rows.length,
    ready: rows.filter((r) => r.readiness === "READY").length,
    review: rows.filter((r) => r.readiness === "REVIEW").length,
    needs_human: rows.filter((r) => r.readiness === "NEEDS_HUMAN").length,
    errors: rows.flatMap((r) =>
      r.issues.filter((i) => i.level === "error").map((i) => ({ sku: r.sku, ...i })),
    ),
    warnings: rows.flatMap((r) =>
      r.issues.filter((i) => i.level === "warning").map((i) => ({ sku: r.sku, ...i })),
    ),
    weight_consistency: rows.map((r) => ({
      sku: r.sku,
      weight_g: r.authority_weight_g,
      pcs_per_kg: r.proposed_pcs_per_kg,
      pcs_per_primary: r.proposed_pcs_per_primary_pack,
      primary_kg: r.proposed_primary_pack_weight_kg,
      check_pcs_x_weight: r.authority_weight_g && r.proposed_pcs_per_kg
        ? Math.abs(r.authority_weight_g * r.proposed_pcs_per_kg - 1000) <= 10
        : false,
    })),
    missing_weights: rows.filter((r) => !r.authority_weight_g).map((r) => r.sku),
    mappet_skus: rows.filter((r) => r.authority_secondary_packing === "Mappet").map((r) => r.sku),
  };

  const drafts = rows
    .filter((r) => r.readiness !== "NEEDS_HUMAN")
    .map(buildDraftPayload);

  writeFileSync(join(OUT_DIR, "batch001_packaging_update_preview.csv"), toCsv(rows));
  writeFileSync(
    join(OUT_DIR, "batch001_packaging_collision_report.json"),
    JSON.stringify(collision, null, 2) + "\n",
  );
  writeFileSync(
    join(OUT_DIR, "batch001_packaging_drafts_payload.json"),
    JSON.stringify(drafts, null, 2) + "\n",
  );

  console.log(
    JSON.stringify(
      {
        preview_csv: "data/packaging/batch001_packaging_update_preview.csv",
        collision_report: "data/packaging/batch001_packaging_collision_report.json",
        drafts_payload: "data/packaging/batch001_packaging_drafts_payload.json",
        ready: collision.ready,
        review: collision.review,
        needs_human: collision.needs_human,
      },
      null,
      2,
    ),
  );
}

main();
