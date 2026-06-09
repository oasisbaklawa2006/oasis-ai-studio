import type { Category1AuthorityRow } from "./types";

function packPreview(row: Category1AuthorityRow): string | null {
  if (!row.primary_pack_uom || !row.qty_per_pack || !row.qty_content_uom) return null;
  return `1 ${row.primary_pack_uom} = ${row.qty_per_pack} ${row.qty_content_uom}`;
}

/**
 * Builds the grouped draft payload matching ProductEdit contributor submit shape.
 * Category 1 only — no channel rules, tags, or catalogue compositions.
 */
export function buildCategory1DraftPayload(args: {
  row: Category1AuthorityRow;
  batchId: string;
  fileName: string;
}) {
  const { row, batchId, fileName } = args;
  const payload = row;

  const optionalReviewFlags = {
    sku: !payload.sku,
    pricing: !payload.mrp && !payload.b2b_price,
    compliance: !payload.hsn_code || payload.gst_rate == null,
    nutrition: true,
    bom_mapping: true,
    main_department: !payload.main_department,
    production_department:
      payload.main_department === "ready_goods_store" && !payload.production_department,
    moq: !payload.moq_value,
    private_label_terms: false,
  };

  return {
    category1_import: true,
    import_meta: {
      batch_id: batchId,
      source_row_index: row.rowIndex,
      source_file: fileName,
      source_document: row.source_document,
      source_page: row.source_page,
      source_pdf_sku: row.source_pdf_sku,
      import_confidence: row.import_confidence,
      submitted_via: "category1_import_staging",
    },
    identity: {
      product_name: payload.product_name,
      original_name: payload.short_name,
      product_class: payload.product_class,
      product_type: payload.product_type,
      category: payload.category,
      subcategory: payload.subcategory,
      description: payload.description,
      short_description: payload.short_description,
      main_department: payload.main_department,
      production_department: payload.production_department,
    },
    aliases: {
      suggested_aliases: [payload.product_name, payload.short_name].filter(Boolean),
    },
    sku_draft: {
      sku: payload.sku,
      note: payload.sku
        ? "Imported SKU — admin must confirm before approval."
        : "SKU will be generated/finalized by admin during approval.",
    },
    uom: {
      primary_uom: payload.primary_uom,
      b2b_uom: payload.b2b_uom ?? payload.primary_uom,
      retail_uom: payload.retail_uom ?? payload.primary_uom,
      approx_piece_weight_g: payload.approximate_piece_weight_g,
      pieces_per_kg: payload.approximate_piece_weight_g
        ? Number((1000 / Number(payload.approximate_piece_weight_g)).toFixed(2))
        : null,
      unit_conversion_note: "Imported from Category 1 authority file",
    },
    packing: {
      primary_pack_type: payload.primary_pack_type || "NA",
      pack_uom: payload.primary_pack_uom,
      qty_per_pack: payload.qty_per_pack,
      qty_content_uom: payload.qty_content_uom,
      pack_preview: packPreview(payload),
      pack_size: payload.pack_size,
      net_weight_g: payload.net_weight_g,
      gross_weight_g: payload.gross_weight_g,
    },
    moq: {
      moq_value: payload.moq_value,
      moq_uom: payload.moq_uom,
      increment_value: payload.increment_value,
      increment_uom: payload.increment_uom,
    },
    pricing: {
      hsn: payload.hsn_code,
      gst_rate: payload.gst_rate,
      currency: payload.currency ?? "INR",
      mrp: payload.mrp,
      b2b_price: payload.b2b_price,
      export_price: payload.export_price,
    },
    compliance: {
      ingredients: payload.ingredients,
      allergen_information: payload.allergen_warnings || "Imported — requires review",
      shelf_life_days: payload.shelf_life_days,
      storage_instructions: payload.storage_instructions,
      label_disclaimer: "Imported Category 1 data — requires admin/compliance approval.",
    },
    ops: {
      import_provenance: {
        source_document: payload.source_document,
        source_page: payload.source_page,
        source_pdf_sku: payload.source_pdf_sku,
        import_confidence: payload.import_confidence,
      },
    },
    flags: {
      is_active: payload.is_active,
      is_catalogue_ready: payload.is_catalogue_ready,
    },
    auto_generated_flags: {
      aliases: true,
      import_staging: true,
    },
    needs_admin_review_flags: optionalReviewFlags,
  };
}
