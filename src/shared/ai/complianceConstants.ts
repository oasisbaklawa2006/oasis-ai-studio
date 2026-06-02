/** Fields that must not become catalogue truth without explicit human approval. */
export const COMPLIANCE_SENSITIVE_FIELDS = [
  "hsn_code",
  "gst_rate",
  "shelf_life_days",
  "ingredients",
  "allergen_warnings",
  "nutritional_info",
  "nutrition_facts",
  "storage_instructions",
] as const;

export type ComplianceSensitiveField = (typeof COMPLIANCE_SENSITIVE_FIELDS)[number];

export const AI_COMPLIANCE_UI_DISCLAIMER =
  "AI suggestion only. Manual approval required.";

export const AI_COMPLIANCE_LEGAL_DISCLAIMER =
  "AI suggestion only. Final GST/HSN must be approved manually by authorized user.";

export const COMPLIANCE_APPROVER_ROLES = ["owner", "admin", "product_manager"] as const;
