export type ProductValidationTab =
  | "identity"
  | "uom"
  | "private_label"
  | "dimensions"
  | "frozen"
  | "bom"
  | "channels"
  | "compliance"
  | "ops";

export type ProductValidationIssue = {
  code: string;
  field: string;
  tab: ProductValidationTab;
  severity: "error" | "warning";
  message: string;
};

type ProductForm = Record<string, unknown>;

const NUMERIC_FIELD_RULES: Array<{
  field: string;
  label: string;
  tab: ProductValidationTab;
  integer?: boolean;
}> = [
  { field: "net_weight_g", label: "Net weight", tab: "compliance" },
  { field: "gross_weight_g", label: "Gross weight", tab: "compliance" },
  { field: "shelf_life_days", label: "Shelf life", tab: "compliance", integer: true },
  { field: "gst_rate", label: "GST rate", tab: "compliance" },
  { field: "mrp", label: "MRP", tab: "channels" },
  { field: "b2b_price", label: "B2B price", tab: "channels" },
  { field: "export_price", label: "Export price", tab: "channels" },
  { field: "pieces_per_kg", label: "Pieces per kg", tab: "uom" },
  { field: "approximate_piece_weight_g", label: "Approximate piece weight", tab: "uom" },
  { field: "qty_per_pack", label: "Quantity per pack", tab: "uom" },
  { field: "moq_value", label: "MOQ", tab: "uom" },
  { field: "increment_value", label: "Order increment", tab: "uom" },
  { field: "carton_qty", label: "Carton quantity", tab: "uom", integer: true },
  { field: "master_carton_qty", label: "Master carton quantity", tab: "uom", integer: true },
  { field: "dimension_l_cm", label: "Length", tab: "dimensions" },
  { field: "dimension_w_cm", label: "Width", tab: "dimensions" },
  { field: "dimension_h_cm", label: "Height", tab: "dimensions" },
  { field: "private_label_moq", label: "Private-label MOQ", tab: "private_label" },
  { field: "private_label_cost_per_unit", label: "Private-label unit cost", tab: "private_label" },
  { field: "private_label_upfront_cost", label: "Private-label setup cost", tab: "private_label" },
  { field: "frozen_shelf_life_days", label: "Frozen shelf life", tab: "frozen", integer: true },
  { field: "post_processing_shelf_life_days", label: "Post-processing shelf life", tab: "frozen", integer: true },
];

function present(value: unknown): boolean {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function numberValue(value: unknown): number | null {
  if (!present(value)) return null;
  const parsed = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function pushRequired(
  issues: ProductValidationIssue[],
  form: ProductForm,
  field: string,
  label: string,
  tab: ProductValidationTab,
) {
  if (!present(form[field])) {
    issues.push({ code: `required.${field}`, field, tab, severity: "error", message: `${label} is required.` });
  }
}

export function validateProductAggregate(
  form: ProductForm,
  options: { contributorMode?: boolean } = {},
): ProductValidationIssue[] {
  const issues: ProductValidationIssue[] = [];

  pushRequired(issues, form, "product_name", "Product name", "identity");
  pushRequired(issues, form, "product_class", "Product class", "identity");
  if (!present(form.product_type) && !present(form.category)) {
    issues.push({
      code: "required.product_type_or_category",
      field: "product_type",
      tab: "identity",
      severity: "error",
      message: "Product type or display category is required.",
    });
  }

  if (!options.contributorMode) {
    pushRequired(issues, form, "sku", "Structured SKU", "identity");
    pushRequired(issues, form, "main_department", "Main department", "identity");
    if (form.main_department === "ready_goods_store") {
      pushRequired(issues, form, "production_department", "Production department", "identity");
    }
  }

  for (const rule of NUMERIC_FIELD_RULES) {
    const value = numberValue(form[rule.field]);
    if (value === null) continue;
    if (Number.isNaN(value)) {
      issues.push({
        code: `number.${rule.field}`,
        field: rule.field,
        tab: rule.tab,
        severity: "error",
        message: `${rule.label} must be a valid number.`,
      });
    } else if (value < 0) {
      issues.push({
        code: `non_negative.${rule.field}`,
        field: rule.field,
        tab: rule.tab,
        severity: "error",
        message: `${rule.label} cannot be negative.`,
      });
    } else if (rule.integer && !Number.isInteger(value)) {
      issues.push({
        code: `integer.${rule.field}`,
        field: rule.field,
        tab: rule.tab,
        severity: "error",
        message: `${rule.label} must be a whole number.`,
      });
    }
  }

  const net = numberValue(form.net_weight_g);
  const gross = numberValue(form.gross_weight_g);
  if (net !== null && gross !== null && Number.isFinite(net) && Number.isFinite(gross) && gross < net) {
    issues.push({
      code: "weight.gross_below_net",
      field: "gross_weight_g",
      tab: "compliance",
      severity: "error",
      message: "Gross weight cannot be lower than net weight.",
    });
  }

  const gst = numberValue(form.gst_rate);
  if (gst !== null && Number.isFinite(gst) && gst > 100) {
    issues.push({
      code: "gst.out_of_range",
      field: "gst_rate",
      tab: "compliance",
      severity: "error",
      message: "GST rate must be between 0 and 100 percent.",
    });
  }

  const pieceWeight = numberValue(form.approximate_piece_weight_g);
  const piecesPerKg = numberValue(form.pieces_per_kg);
  if (
    pieceWeight !== null && piecesPerKg !== null && pieceWeight > 0 && piecesPerKg > 0 &&
    Number.isFinite(pieceWeight) && Number.isFinite(piecesPerKg)
  ) {
    const expected = 1000 / pieceWeight;
    const relativeDifference = Math.abs(piecesPerKg - expected) / expected;
    if (relativeDifference > 0.05) {
      issues.push({
        code: "uom.piece_math_mismatch",
        field: "pieces_per_kg",
        tab: "uom",
        severity: "error",
        message: "Pieces per kg conflicts with approximate piece weight by more than 5%.",
      });
    }
  }

  if (present(form.primary_pack_type) && !present(form.primary_pack_uom)) {
    issues.push({
      code: "pack.uom_required",
      field: "primary_pack_uom",
      tab: "uom",
      severity: "error",
      message: "Primary pack UOM is required when a primary pack type is selected.",
    });
  }
  if (present(form.qty_per_pack) && !present(form.qty_content_uom)) {
    issues.push({
      code: "pack.content_uom_required",
      field: "qty_content_uom",
      tab: "uom",
      severity: "error",
      message: "Content UOM is required when quantity per pack is entered.",
    });
  }

  if (form.moq_rule_type && form.moq_rule_type !== "not_applicable") {
    pushRequired(issues, form, "moq_value", "MOQ value", "uom");
    pushRequired(issues, form, "moq_uom", "MOQ UOM", "uom");
  }
  if (present(form.increment_value)) {
    pushRequired(issues, form, "increment_uom", "Increment UOM", "uom");
    if (present(form.moq_uom) && present(form.increment_uom) && form.moq_uom !== form.increment_uom) {
      issues.push({
        code: "moq.increment_uom_mismatch",
        field: "increment_uom",
        tab: "uom",
        severity: "error",
        message: "MOQ and increment must use the same UOM unless an explicit conversion is defined.",
      });
    }
  }

  if (form.fixed_carton_required === true) {
    pushRequired(issues, form, "carton_qty", "Carton quantity", "uom");
    pushRequired(issues, form, "carton_uom", "Carton UOM", "uom");
  }
  if (present(form.master_carton_qty)) {
    pushRequired(issues, form, "master_carton_uom", "Master carton UOM", "uom");
  }

  if (form.private_label_allowed === true) {
    pushRequired(issues, form, "private_label_moq", "Private-label MOQ", "private_label");
    pushRequired(issues, form, "private_label_cost_per_unit", "Private-label unit cost", "private_label");
  }

  return issues;
}

