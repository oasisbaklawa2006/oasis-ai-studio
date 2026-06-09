export type Category1AuthorityRow = {
  rowIndex: number;
  product_name: string;
  sku: string | null;
  short_name: string | null;
  category: string | null;
  subcategory: string | null;
  product_class: string | null;
  product_type: string | null;
  description: string | null;
  short_description: string | null;
  main_department: string | null;
  production_department: string | null;
  primary_uom: string | null;
  b2b_uom: string | null;
  retail_uom: string | null;
  approximate_piece_weight_g: number | null;
  pack_size: string | null;
  primary_pack_type: string | null;
  primary_pack_uom: string | null;
  qty_per_pack: number | null;
  qty_content_uom: string | null;
  net_weight_g: number | null;
  gross_weight_g: number | null;
  mrp: number | null;
  b2b_price: number | null;
  export_price: number | null;
  gst_rate: number | null;
  hsn_code: string | null;
  currency: string | null;
  moq_value: number | null;
  moq_uom: string | null;
  increment_value: number | null;
  increment_uom: string | null;
  shelf_life_days: number | null;
  storage_instructions: string | null;
  ingredients: string | null;
  allergen_warnings: string | null;
  source_document: string | null;
  source_page: number | null;
  source_pdf_sku: string | null;
  import_confidence: string | null;
  is_active: boolean;
  is_catalogue_ready: boolean;
};

export type ColumnMappingEntry = {
  authorityColumn: string;
  targetField: keyof Category1AuthorityRow | "ignored";
  sampleValue: string;
};

export type ValidationIssue = {
  level: "error" | "warning";
  code: string;
  message: string;
};

export type DuplicateMatch = {
  kind: "in_file_sku" | "in_file_name_pack" | "existing_sku" | "existing_name";
  matchedValue: string;
  matchedRowIndex?: number;
  existingProductId?: string;
  existingLabel?: string;
};

export type StagedCategory1Row = {
  row: Category1AuthorityRow;
  raw: Record<string, string>;
  columnMappings: ColumnMappingEntry[];
  issues: ValidationIssue[];
  duplicates: DuplicateMatch[];
  canSubmit: boolean;
};

export type ParseFileResult = {
  format: "csv" | "json";
  fileName: string;
  sourceDocument: string;
  rawRows: Record<string, string>[];
  staged: StagedCategory1Row[];
};

export type SubmitBatchResult = {
  batchId: string;
  submitted: number;
  skipped: number;
  failed: { rowIndex: number; message: string }[];
  draftIds: string[];
  importLogIds: string[];
};
