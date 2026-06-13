import { COMPLIANCE_APPROVER_ROLES } from "@/shared/ai/complianceConstants";

export type Role =
  | "owner"
  | "admin"
  | "product_manager"
  | "catalogue_manager"
  | "designer"
  | "sales"
  | "catalogue_contributor";

export type PageKey =
  | "dashboard" | "products" | "products_write"
  | "media" | "tags" | "catalogues" | "catalogues_write"
  | "hampers" | "ingredients" | "labels" | "labels_write"
  | "ai_studio" | "settings" | "testing" | "audit_log"
  | "aliases_write" | "sku_write" | "data_correction"
  | "category1_import";

const MATRIX: Record<PageKey, Role[]> = {
  dashboard:         ["owner","admin","product_manager","catalogue_manager","designer","sales","catalogue_contributor"],
  products:          ["owner","admin","product_manager","catalogue_manager","designer","sales","catalogue_contributor"],

  // Do NOT add catalogue_contributor here.
  // Contributor product saves must go through catalogue_product_drafts, not master product write.
  products_write:    ["owner","admin","product_manager"],

  sku_write:         ["owner","admin","product_manager"],
  aliases_write:     ["owner","admin","product_manager"],
  media:             ["owner","admin","product_manager","catalogue_manager","designer"],
  tags:              ["owner","admin","product_manager","catalogue_manager"],
  catalogues:        ["owner","admin","product_manager","catalogue_manager","sales"],
  catalogues_write:  ["owner","admin","catalogue_manager"],
  hampers:           ["owner","admin","product_manager"],
  ingredients:       ["owner","admin","product_manager"],
  labels:            ["owner","admin","product_manager"],
  labels_write:      ["owner","admin","product_manager"],
  ai_studio:         ["owner","admin","designer"],
  settings:          ["owner","admin"],
  testing:           ["owner","admin","product_manager","catalogue_manager","designer","sales"],
  audit_log:         ["owner","admin"],
  data_correction:   ["owner","admin","product_manager"],
  category1_import:  ["owner","admin","product_manager","catalogue_contributor"],
  compliance_approve: [...COMPLIANCE_APPROVER_ROLES],
};

export const canApproveComplianceFields = (roles: Role[] | string[]) =>
  COMPLIANCE_APPROVER_ROLES.some((r) => (roles as string[]).includes(r));

export const hasRole = (roles: Role[] | string[], role: Role) => roles.includes(role as any);

export const canAccessPage = (roles: Role[] | string[], page: PageKey) => {
  if (!roles?.length) return false;
  if (roles.includes("owner" as any)) return true;
  return MATRIX[page]?.some((r) => (roles as any).includes(r)) ?? false;
};

export const canPerformAction = canAccessPage;
