export type WorkspaceStatus = "operational" | "review" | "blocked";

export type AiStudioWorkspace = {
  title: string;
  description: string;
  href: string | null;
  status: WorkspaceStatus;
  statusLabel: string;
  nextAction: string;
};

export const AI_STUDIO_WORKSPACES: AiStudioWorkspace[] = [
  {
    title: "Product creation",
    description: "Create governed product drafts with structured SKU and packaging validation.",
    href: "/products/new/fast",
    status: "operational",
    statusLabel: "Operational",
    nextAction: "Create product",
  },
  {
    title: "Full product editor",
    description: "Search the product master, then open the complete authority editor.",
    href: "/products",
    status: "operational",
    statusLabel: "Operational",
    nextAction: "Open products",
  },
  {
    title: "Catalogue product studio",
    description: "Draft catalogue copy, media direction, localisation and approval evidence.",
    href: "/admin/catalogue-product-studio",
    status: "operational",
    statusLabel: "Operational",
    nextAction: "Open studio",
  },
  {
    title: "Media workspace",
    description: "Review governed product media and readiness without bypassing product authority.",
    href: "/media",
    status: "operational",
    statusLabel: "Operational",
    nextAction: "Review media",
  },
  {
    title: "Approval inbox",
    description: "Approve or reject contributor drafts through the production approval contract.",
    href: "/approvals",
    status: "operational",
    statusLabel: "Operational",
    nextAction: "Review drafts",
  },
  {
    title: "Category-1 import",
    description:
      "Validate authority exports and submit accepted rows as drafts, never master writes.",
    href: "/admin/import/category-1",
    status: "review",
    statusLabel: "Acceptance required",
    nextAction: "Stage import",
  },
  {
    title: "Product resolver",
    description:
      "Test governed alias and utterance matching before enabling downstream automation.",
    href: "/admin/resolver-preview",
    status: "review",
    statusLabel: "Review tool",
    nextAction: "Test resolver",
  },
  {
    title: "Image generation and reel production",
    description:
      "Provider-backed generation remains unavailable until its governed backend is approved.",
    href: null,
    status: "blocked",
    statusLabel: "Backend required",
    nextAction: "Not available",
  },
];

export const summarizeAiStudioWorkspaces = (workspaces = AI_STUDIO_WORKSPACES) => ({
  operational: workspaces.filter((workspace) => workspace.status === "operational").length,
  review: workspaces.filter((workspace) => workspace.status === "review").length,
  blocked: workspaces.filter((workspace) => workspace.status === "blocked").length,
});
