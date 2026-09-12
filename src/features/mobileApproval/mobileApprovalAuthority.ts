/**
 * Point 52 — mobile approval / launch authority census and fail-closed policy.
 *
 * Ownership:
 * - AI Studio reviewer-gated approval surfaces usable on supported mobile viewports
 * - Launch/publication actions remain fail-closed (Point 54 authority)
 *
 * Boundaries (referenced, not implemented here):
 * - Point 38 — canonical workflow state / transition contract (PR #157)
 * - Point 39 — correction / resubmission after rejection
 * - Point 44 — camera capture (not absorbed)
 * - Point 54 — publication / live Central write (fail-closed)
 */

/** Minimum supported operator viewport (matches Testing.tsx section J). */
export const MOBILE_APPROVAL_MIN_VIEWPORT_PX = 390;

export type MobileApprovalSurface =
  | "approval_inbox"
  | "catalogue_product_studio"
  | "central_sync_preview"
  | "pilot_alias_review"
  | "product_intelligence_handoff";

export type MobileApprovalAction =
  | "approve_contributor_draft"
  | "reject_contributor_draft"
  | "approve_copy_draft"
  | "reject_copy_draft"
  | "submit_copy_draft_for_review"
  | "approve_snapshot_preview"
  | "export_approved_bundle"
  | "approve_pilot_alias";

/** Launch/publication actions — always fail-closed in AI Studio (Point 54). */
export type MobileLaunchAction =
  | "publish_catalogue_version"
  | "live_central_write"
  | "activate_knowledge_in_core"
  | "public_catalogue_route";

export type MobileApprovalContext = {
  isCatalogueReviewer: boolean;
  governedByCentral?: boolean;
  exportDistributable?: boolean;
};

export type MobileApprovalDecision = {
  allowed: boolean;
  blockReason: string | null;
};

const REVIEWER_ACTIONS: ReadonlySet<MobileApprovalAction> = new Set([
  "approve_contributor_draft",
  "reject_contributor_draft",
  "approve_copy_draft",
  "reject_copy_draft",
  "approve_snapshot_preview",
  "approve_pilot_alias",
]);

const POINT_54_BLOCK_REASON =
  "Publication and live Central write are Point 54 authority — AI Studio cannot launch directly.";

/** Census of governed approval surfaces (durable programme reference). */
export const MOBILE_APPROVAL_SURFACE_CENSUS: ReadonlyArray<{
  surface: MobileApprovalSurface;
  route: string;
  reviewerGatedActions: MobileApprovalAction[];
  mobilePosture: "supported" | "scroll_heavy";
  launchAuthority: "none" | "preview_handoff_only";
}> = [
  {
    surface: "approval_inbox",
    route: "/approvals",
    reviewerGatedActions: ["approve_contributor_draft", "reject_contributor_draft"],
    mobilePosture: "supported",
    launchAuthority: "none",
  },
  {
    surface: "catalogue_product_studio",
    route: "/admin/catalogue-product-studio",
    reviewerGatedActions: ["approve_copy_draft", "reject_copy_draft"],
    mobilePosture: "supported",
    launchAuthority: "preview_handoff_only",
  },
  {
    surface: "central_sync_preview",
    route: "/products/:id (Central Sync tab)",
    reviewerGatedActions: ["approve_snapshot_preview"],
    mobilePosture: "scroll_heavy",
    launchAuthority: "preview_handoff_only",
  },
  {
    surface: "pilot_alias_review",
    route: "/testing/pilot-aliases",
    reviewerGatedActions: ["approve_pilot_alias"],
    mobilePosture: "supported",
    launchAuthority: "none",
  },
  {
    surface: "product_intelligence_handoff",
    route: "/admin/product-intelligence (Publish tab)",
    reviewerGatedActions: [],
    mobilePosture: "scroll_heavy",
    launchAuthority: "preview_handoff_only",
  },
];

export function isSupportedMobileViewport(widthPx: number): boolean {
  return widthPx >= MOBILE_APPROVAL_MIN_VIEWPORT_PX;
}

/** All launch actions are blocked in AI Studio — Point 54 owns publication. */
export function evaluateLaunchAction(action: MobileLaunchAction): MobileApprovalDecision {
  return {
    allowed: false,
    blockReason: `${POINT_54_BLOCK_REASON} (${action})`,
  };
}

/**
 * Fail-closed policy for reviewer-gated approval actions on any viewport.
 * Does not duplicate Point 38 workflow transitions — status guards remain in catalogueDraftWorkflow.
 */
export function evaluateMobileApprovalAction(
  action: MobileApprovalAction,
  ctx: MobileApprovalContext,
): MobileApprovalDecision {
  if (REVIEWER_ACTIONS.has(action) && !ctx.isCatalogueReviewer) {
    return {
      allowed: false,
      blockReason: "Catalogue reviewer role required for this approval action.",
    };
  }

  if (
    (action === "approve_contributor_draft" || action === "reject_contributor_draft") &&
    ctx.governedByCentral
  ) {
    return {
      allowed: false,
      blockReason: "Pricing and MOQ approvals happen in Central, not AI Studio.",
    };
  }

  if (action === "export_approved_bundle" && !ctx.exportDistributable) {
    return {
      allowed: false,
      blockReason: "Export bundle is only distributable for approved, complete drafts.",
    };
  }

  return { allowed: true, blockReason: null };
}
