import { ShieldCheck } from "lucide-react";
import {
  classifyDeferredFields,
  deriveMobileDraftWorkflowState,
  type MobileDraftWorkflowState,
} from "@/features/mobileProductCreate";
import type { FastCreateDraftSnapshot } from "@/features/fastCreate/fastCreateDraft";

const WORKFLOW_LABELS: Record<MobileDraftWorkflowState, string> = {
  INTAKE: "Intake — enter product identity",
  DRAFT_IN_PROGRESS: "Draft in progress — session only",
  READY_FOR_GOVERNED_SUBMIT: "Ready for governed draft submit",
  SUBMITTED_AWAITING_HUMAN_APPROVAL: "Submitted — awaiting human approval",
};

type Props = {
  draft: FastCreateDraftSnapshot;
  submitted?: boolean;
};

export function MobileProductCreateBanner({ draft, submitted = false }: Props) {
  const workflowState = deriveMobileDraftWorkflowState(draft, submitted);
  const deferred = classifyDeferredFields(draft.suggestions);
  const deferredCount = deferred.filter((d) => d.status !== "unknown").length;

  return (
    <div
      className="mb-4 rounded-md border border-accent/30 bg-accent/5 px-4 py-3 text-sm"
      data-testid="mobile-product-create-banner"
      data-workflow-state={workflowState}
    >
      <div className="flex items-start gap-2">
        <ShieldCheck className="h-4 w-4 mt-0.5 text-accent shrink-0" />
        <div className="min-w-0 space-y-1">
          <p className="font-medium text-foreground">
            Mobile product draft — {WORKFLOW_LABELS[workflowState]}
          </p>
          <p className="text-xs text-muted-foreground">
            Creates a governed catalogue draft only. Unresolved commercial and compliance fields
            remain deferred until human review in Approval Inbox.
          </p>
          {deferredCount > 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {deferredCount} field(s) require review before publication (Point 53 deferred).
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
