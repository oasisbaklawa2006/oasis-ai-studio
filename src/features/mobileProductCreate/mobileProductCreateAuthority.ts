/**
 * Point 51 — canonical mobile AI-assisted product-draft creation authority.
 *
 * Single governed path: `/products/new/fast` (FastCreateProduct).
 * Creates catalogue drafts only — never publishes and never writes master
 * `products` directly, including for privileged/admin roles. Preserves Point 30
 * extraction provenance, Point 34 factual safeguards, Point 38 workflow state,
 * and Point 39 human approval routing.
 */

import type { FastCreateDraftSnapshot } from "@/features/fastCreate/fastCreateDraft";
import type { FastCreateSuggestions } from "@/features/fastCreate/fastCreateSuggestions";
import type { GovernedAiProvenance } from "@/features/governedAiExtraction/types";
import { productClassForSaleType, type SaleType } from "@/features/productAuthority/saleType";
import type { ComplianceFieldMetaMap } from "@/shared/ai/complianceApproval";
import { COMPLIANCE_SENSITIVE_FIELDS } from "@/shared/ai/complianceConstants";

export const MOBILE_PRODUCT_CREATE_ROUTE = "/products/new/fast";
export const HUMAN_APPROVAL_ROUTE = "/approvals";
export const SUPPORTED_MOBILE_INTAKE_MODES = ["barcode", "ocr", "voice", "text"] as const;
export type SupportedMobileIntakeMode = (typeof SUPPORTED_MOBILE_INTAKE_MODES)[number];

export type MobileCreateBlockReason =
  | "MISSING_PRODUCT_IDENTITY"
  | "UNAUTHORIZED_ROLE"
  | "MALFORMED_EXTRACTION"
  | "UNSUPPORTED_SALE_TYPE";

export type MobileDraftWorkflowState =
  | "INTAKE"
  | "DRAFT_IN_PROGRESS"
  | "READY_FOR_GOVERNED_SUBMIT"
  | "SUBMITTED_AWAITING_HUMAN_APPROVAL";

export type DeferredFieldStatus = "deferred" | "unknown" | "suggestion_only";

export type DeferredFieldEntry = {
  field: string;
  status: DeferredFieldStatus;
  point53Note: string;
};

export type MobileCreateAuthorityInput = {
  productName: string;
  roles: string[];
  canWriteDirectly: boolean;
  isContributor: boolean;
  suggestions: FastCreateSuggestions | null;
  saleType?: SaleType;
};

export type MobileCreateAuthorityResult = {
  allowed: boolean;
  blockReason: MobileCreateBlockReason | null;
  blockMessage: string | null;
  workflowState: MobileDraftWorkflowState;
  /** Point27 canonical invariant: every save uses the governed draft boundary. */
  requiresGovernedDraft: true;
  humanApprovalRoute: typeof HUMAN_APPROVAL_ROUTE;
};

const ADMIN_WRITE_ROLES = new Set(["owner", "admin", "product_manager", "super_admin"]);

function hasAdminWriteRole(roles: string[]): boolean {
  return roles.some((role) => ADMIN_WRITE_ROLES.has(role));
}

function hasProductsWritePermission(roles: string[]): boolean {
  return roles.includes("products_write");
}

export function assertProductIdentity(productName: string): MobileCreateAuthorityResult | null {
  if (!productName.trim()) {
    return {
      allowed: false,
      blockReason: "MISSING_PRODUCT_IDENTITY",
      blockMessage: "Product name is required before a governed draft can be created.",
      workflowState: "INTAKE",
      requiresGovernedDraft: true,
      humanApprovalRoute: HUMAN_APPROVAL_ROUTE,
    };
  }
  return null;
}

export function hasMalformedExtraction(suggestions: FastCreateSuggestions | null): boolean {
  if (!suggestions?.extractionProvenance?.length) return false;
  return suggestions.extractionProvenance.some(
    (entry) => entry.fail_closed && entry.provider_status === "failed",
  );
}

/**
 * Point27 invariant: direct-write capability is permission evidence only; it never
 * authorizes Fast Create to bypass the governed draft/approval boundary.
 */
export function evaluateMobileProductCreateAuthority(
  input: MobileCreateAuthorityInput,
): MobileCreateAuthorityResult {
  const identityBlock = assertProductIdentity(input.productName);
  if (identityBlock) return identityBlock;

  if (hasMalformedExtraction(input.suggestions)) {
    return {
      allowed: false,
      blockReason: "MALFORMED_EXTRACTION",
      blockMessage:
        "AI extraction failed closed — correct intake manually or regenerate suggestions before submit.",
      workflowState: "DRAFT_IN_PROGRESS",
      requiresGovernedDraft: true,
      humanApprovalRoute: HUMAN_APPROVAL_ROUTE,
    };
  }

  const authorized =
    input.canWriteDirectly ||
    input.isContributor ||
    hasAdminWriteRole(input.roles) ||
    hasProductsWritePermission(input.roles) ||
    input.roles.includes("catalogue_contributor");

  if (!authorized) {
    return {
      allowed: false,
      blockReason: "UNAUTHORIZED_ROLE",
      blockMessage: "You do not have permission to create products. Contact an administrator.",
      workflowState: "DRAFT_IN_PROGRESS",
      requiresGovernedDraft: true,
      humanApprovalRoute: HUMAN_APPROVAL_ROUTE,
    };
  }

  if (input.saleType && !productClassForSaleType(input.saleType)) {
    return {
      allowed: false,
      blockReason: "UNSUPPORTED_SALE_TYPE",
      blockMessage: `Sale type "${input.saleType}" has no supported catalogue classification yet. Choose a supported sale type or use the Full Editor correction workflow.`,
      workflowState: "DRAFT_IN_PROGRESS",
      requiresGovernedDraft: true,
      humanApprovalRoute: HUMAN_APPROVAL_ROUTE,
    };
  }

  return {
    allowed: true,
    blockReason: null,
    blockMessage: null,
    workflowState: "READY_FOR_GOVERNED_SUBMIT",
    requiresGovernedDraft: true,
    humanApprovalRoute: HUMAN_APPROVAL_ROUTE,
  };
}

export function deriveMobileDraftWorkflowState(
  draft: FastCreateDraftSnapshot,
  submitted: boolean,
): MobileDraftWorkflowState {
  if (submitted) return "SUBMITTED_AWAITING_HUMAN_APPROVAL";
  if (!draft.productName.trim()) return "INTAKE";
  if (draft.suggestions) return "READY_FOR_GOVERNED_SUBMIT";
  return "DRAFT_IN_PROGRESS";
}

export function extractPoint30Provenance(
  suggestions: FastCreateSuggestions | null,
): GovernedAiProvenance[] {
  return suggestions?.extractionProvenance ?? [];
}

function metaStatusForField(
  field: string,
  meta: ComplianceFieldMetaMap | undefined,
): DeferredFieldStatus {
  const entry = meta?.[field as keyof ComplianceFieldMetaMap];
  if (!entry) return "unknown";
  if (entry.approved === true) return "unknown";
  if (entry.source === "category_rule") return "deferred";
  if (entry.source === "ai_suggestion" || entry.approved === false) {
    return "suggestion_only";
  }
  return "unknown";
}

/**
 * UI-facing preview of unresolved details. This does not replace Point53's
 * publication transition contract; it only makes unresolved mobile-draft facts visible.
 */
export function classifyDeferredFields(
  suggestions: FastCreateSuggestions | null,
): DeferredFieldEntry[] {
  if (!suggestions) return [];

  const entries: DeferredFieldEntry[] = [];
  const meta = suggestions.complianceFieldMeta;

  for (const field of COMPLIANCE_SENSITIVE_FIELDS) {
    const value = suggestions.formPatch[field];
    const status = metaStatusForField(field, meta);
    if (value == null || value === "") {
      entries.push({
        field,
        status: "unknown",
        point53Note: "Unresolved — requires human review in Full Editor or Approval Inbox.",
      });
      continue;
    }
    if (status === "suggestion_only" || status === "deferred") {
      entries.push({
        field,
        status,
        point53Note:
          status === "suggestion_only"
            ? "AI suggestion only — not catalogue truth until approved."
            : "Category rule — deferred to compliance review before publication.",
      });
    }
  }

  if (suggestions.pendingAiAliases?.length) {
    entries.push({
      field: "pending_ai_aliases",
      status: "suggestion_only",
      point53Note: `${suggestions.pendingAiAliases.length} AI alias suggestion(s) await human approval.`,
    });
  }

  return entries;
}

export type MobileCreateSaveGuardInput = {
  productName: string;
  roles: string[];
  canWriteDirectly: boolean;
  isContributor: boolean;
  suggestions: FastCreateSuggestions;
  saleType?: SaleType;
};

export function assertMobileProductCreateSaveAllowed(input: MobileCreateSaveGuardInput): void {
  const result = evaluateMobileProductCreateAuthority(input);
  if (!result.allowed) {
    throw new Error(result.blockMessage ?? "Mobile product creation is blocked by governance.");
  }
}
