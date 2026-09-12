/**
 * Point 51 — canonical mobile AI-assisted product-draft creation authority.
 *
 * Single governed path: `/products/new/fast` (FastCreateProduct).
 * Creates catalogue drafts only — never publishes or silently fills unknown
 * commercial/compliance fields. Preserves Point 30 extraction provenance,
 * Point 38 workflow state, and Point 39 human approval routing.
 */

import type { FastCreateDraftSnapshot } from "@/features/fastCreate/fastCreateDraft";
import type { FastCreateSuggestions } from "@/features/fastCreate/fastCreateSuggestions";
import type { GovernedAiProvenance } from "@/features/governedAiExtraction/types";
import { productClassForSaleType, type SaleType } from "@/features/productAuthority/saleType";
import type { ComplianceFieldMetaMap } from "@/shared/ai/complianceApproval";
import { COMPLIANCE_SENSITIVE_FIELDS } from "@/shared/ai/complianceConstants";

/** Canonical mobile-capable product creation route (same surface on all viewports). */
export const MOBILE_PRODUCT_CREATE_ROUTE = "/products/new/fast";

export const FAST_CREATE_UNSUPPORTED_CLASS_MESSAGE_PREFIX =
  "has no supported catalogue classification yet";

/** Point 39 — human approval / correction authority lives in Approval Inbox. */
export const HUMAN_APPROVAL_ROUTE = "/approvals";

/** Intake modes supported by existing governed adapters (Point 29 lineage). */
export const SUPPORTED_MOBILE_INTAKE_MODES = ["barcode", "ocr", "voice", "text"] as const;

export type SupportedMobileIntakeMode = (typeof SUPPORTED_MOBILE_INTAKE_MODES)[number];

export type MobileCreateBlockReason =
  | "MISSING_PRODUCT_IDENTITY"
  | "UNAUTHORIZED_ROLE"
  | "MALFORMED_EXTRACTION"
  | "MISSING_DRAFT_AUTHORITY"
  | "UNSUPPORTED_SALE_TYPE_DIRECT";

/** Point 38 — governed workflow state for mobile product creation. */
export type MobileDraftWorkflowState =
  | "INTAKE"
  | "DRAFT_IN_PROGRESS"
  | "READY_FOR_GOVERNED_SUBMIT"
  | "SUBMITTED_AWAITING_HUMAN_APPROVAL";

/** Point 53 semantics — unresolved commercial/compliance fields stay explicit. */
export type DeferredFieldStatus = "deferred" | "unknown" | "suggestion_only";

export type DeferredFieldEntry = {
  field: string;
  status: DeferredFieldStatus;
  /** Human-readable Point 53 routing note for operator UI. */
  point53Note: string;
};

export type MobileCreateAuthorityInput = {
  productName: string;
  roles: string[];
  canWriteDirectly: boolean;
  isContributor: boolean;
  suggestions: FastCreateSuggestions | null;
  saleType?: SaleType;
  /** When true, direct-write path is being attempted (admin-class roles). */
  attemptingDirectWrite?: boolean;
};

export type MobileCreateAuthorityResult = {
  allowed: boolean;
  blockReason: MobileCreateBlockReason | null;
  blockMessage: string | null;
  workflowState: MobileDraftWorkflowState;
  /** True when save must route through governed draft RPC, never direct insert. */
  requiresGovernedDraft: boolean;
  humanApprovalRoute: typeof HUMAN_APPROVAL_ROUTE;
};

const ADMIN_WRITE_ROLES = new Set([
  "owner",
  "admin",
  "product_manager",
  "super_admin",
]);

function hasAdminWriteRole(roles: string[]): boolean {
  return roles.some((r) => ADMIN_WRITE_ROLES.has(r));
}

function hasProductsWritePermission(roles: string[]): boolean {
  return roles.includes("products_write");
}

/** Fail-closed identity guard — product name is mandatory draft authority. */
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

/** Detect malformed AI extraction — fail closed when provenance marks fail_closed. */
export function hasMalformedExtraction(suggestions: FastCreateSuggestions | null): boolean {
  if (!suggestions?.extractionProvenance?.length) return false;
  return suggestions.extractionProvenance.some(
    (p) => p.fail_closed && p.provider_status === "failed",
  );
}

/**
 * Evaluate whether a mobile product create save is permitted.
 * Contributors always route through governed draft RPC (Point 38/39).
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

  const canDirect =
    input.canWriteDirectly || hasAdminWriteRole(input.roles) || hasProductsWritePermission(input.roles);
  const isContributor = input.isContributor || input.roles.includes("catalogue_contributor");

  if (!canDirect && !isContributor) {
    return {
      allowed: false,
      blockReason: "UNAUTHORIZED_ROLE",
      blockMessage: "You do not have permission to create products. Contact an administrator.",
      workflowState: "DRAFT_IN_PROGRESS",
      requiresGovernedDraft: true,
      humanApprovalRoute: HUMAN_APPROVAL_ROUTE,
    };
  }

  if (canDirect && input.attemptingDirectWrite !== false) {
    if (input.saleType && !productClassForSaleType(input.saleType)) {
      return {
        allowed: false,
        blockReason: "UNSUPPORTED_SALE_TYPE_DIRECT",
        blockMessage: `Sale type "${input.saleType}" ${FAST_CREATE_UNSUPPORTED_CLASS_MESSAGE_PREFIX}. Submit for admin review as a catalogue draft instead of direct creation, or choose a sale type with a supported product class.`,
        workflowState: "READY_FOR_GOVERNED_SUBMIT",
        requiresGovernedDraft: true,
        humanApprovalRoute: HUMAN_APPROVAL_ROUTE,
      };
    }
    return {
      allowed: true,
      blockReason: null,
      blockMessage: null,
      workflowState: "READY_FOR_GOVERNED_SUBMIT",
      requiresGovernedDraft: false,
      humanApprovalRoute: HUMAN_APPROVAL_ROUTE,
    };
  }

  if (isContributor) {
    return {
      allowed: true,
      blockReason: null,
      blockMessage: null,
      workflowState: "READY_FOR_GOVERNED_SUBMIT",
      requiresGovernedDraft: true,
      humanApprovalRoute: HUMAN_APPROVAL_ROUTE,
    };
  }

  return {
    allowed: false,
    blockReason: "MISSING_DRAFT_AUTHORITY",
    blockMessage: "No governed draft authority available for this account.",
    workflowState: "DRAFT_IN_PROGRESS",
    requiresGovernedDraft: true,
    humanApprovalRoute: HUMAN_APPROVAL_ROUTE,
  };
}

/** Derive Point 38 workflow state from a Fast Create session draft. */
export function deriveMobileDraftWorkflowState(
  draft: FastCreateDraftSnapshot,
  submitted: boolean,
): MobileDraftWorkflowState {
  if (submitted) return "SUBMITTED_AWAITING_HUMAN_APPROVAL";
  if (!draft.productName.trim()) return "INTAKE";
  if (draft.suggestions) return "READY_FOR_GOVERNED_SUBMIT";
  return "DRAFT_IN_PROGRESS";
}

/** Extract Point 30 governed AI provenance from suggestions for audit trail. */
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
  if (entry.source === "ai_suggestion" || entry.approved === false) return "suggestion_only";
  if (entry.source === "category_default") return "deferred";
  return "unknown";
}

/**
 * Classify unresolved fields under Point 53 semantics — never silently canonical.
 * Compliance-sensitive fields without explicit approval remain suggestion_only or deferred.
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
            : "Category default — deferred to compliance review before publication.",
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

  if (suggestions.sources?.aiCompliance && !suggestions.sources.defaults) {
    entries.push({
      field: "ai_compliance_bundle",
      status: "suggestion_only",
      point53Note: "AI compliance bundle is review-only until explicitly approved.",
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

/** Throws on blocked save — used by saveFastCreateProduct fail-closed gate. */
export function assertMobileProductCreateSaveAllowed(input: MobileCreateSaveGuardInput): void {
  const result = evaluateMobileProductCreateAuthority({
    ...input,
    attemptingDirectWrite: input.canWriteDirectly,
  });
  if (!result.allowed && result.blockMessage) {
    throw new Error(result.blockMessage);
  }
}
