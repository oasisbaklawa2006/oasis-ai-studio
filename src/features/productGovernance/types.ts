export type ProductGovernanceRow = {
  id: string;
  sku?: string | null;
  product_name?: string | null;
  name?: string | null;
  label_status?: string | null;
  archived_at?: string | null;
  archived_by?: string | null;
};

export type ProductLabelBarcodeRow = {
  product_id: string;
  barcode?: string | null;
  status?: string | null;
};

export type DuplicateKind = "same_sku" | "same_name" | "same_barcode";

export type ProductDuplicateSignal = {
  kind: DuplicateKind;
  matchedValue: string;
  otherProductId: string;
  otherLabel: string;
};

export type ProductDeleteAssessment = {
  eligible: boolean;
  blockers: string[];
  sku?: string | null;
  product_name?: string | null;
};

export type GovernanceActionResult = {
  ok: boolean;
  message: string;
  blockers?: string[];
  sku?: string;
};
