export const MODULE_PURPOSES: Record<string, string> = {
  "/": "Your operational overview: product totals, readiness signals and shortcuts into daily work.",
  "/products":
    "Search and review the governed product master, then open Fast Create or the Full Editor.",
  "/admin/import/category-1":
    "Validate a Category-1 authority file and submit accepted rows as approval drafts—never direct master writes.",
  "/media": "Review and manage governed product imagery and media-readiness evidence.",
  "/tags": "Manage the controlled product tag catalogue when its production backend is available.",
  "/catalogues":
    "Manage governed catalogues and client-facing catalogue records when persistence is available.",
  "/admin/catalogue-builder":
    "Assemble products into curated collections and export catalogue material after backend approval.",
  "/admin/catalogue-product-studio":
    "Create product copy, localisation, media direction and approval-ready catalogue content.",
  "/hampers": "Build hamper compositions and governed bill-of-material relationships.",
  "/ingredients":
    "Maintain ingredient, allergen and nutrition authority used by products and labels.",
  "/labels": "Prepare governed product label content from approved product and compliance data.",
  "/label-queue": "Review label jobs awaiting validation, approval or print hand-off.",
  "/data-correction":
    "Inspect and repair governed product-authority data without bypassing audit controls.",
  "/ai-studio":
    "Launch operational AI Studio workspaces and see which capabilities still require approval.",
  "/testing":
    "Run operator readiness checks and review evidence before enabling production capabilities.",
  "/settings": "Inspect capability configuration and controlled activation status.",
  "/audit-log":
    "Review the governed activation history when its production audit table is available.",
  "/approvals":
    "Approve or reject contributor drafts through the production catalogue-approval contract.",
};

export const modulePurpose = (path: string): string =>
  MODULE_PURPOSES[path] ?? "Open this governed Oasis Catalogue Studio module.";
