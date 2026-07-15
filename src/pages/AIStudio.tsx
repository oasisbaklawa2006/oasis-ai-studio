import { ArrowRight, CheckCircle2, Clock3, LockKeyhole } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AI_STUDIO_WORKSPACES,
  summarizeAiStudioWorkspaces,
  type WorkspaceStatus,
} from "@/features/aiStudio/aiStudioWorkspace";

const statusStyle: Record<WorkspaceStatus, string> = {
  operational: "border-success/30 bg-success/10 text-success",
  review: "border-warning/30 bg-warning/10 text-warning",
  blocked: "border-border bg-muted text-muted-foreground",
};

const statusIcon = {
  operational: CheckCircle2,
  review: Clock3,
  blocked: LockKeyhole,
} as const;

const AIStudio = () => {
  const summary = summarizeAiStudioWorkspaces();

  return (
    <>
      <PageHeader
        title="AI Studio"
        subtitle="A governed operating workspace for product creation, catalogue content, media and human approval."
      />

      <section className="card-elevated mb-8 overflow-hidden gradient-hero p-6 text-primary-foreground">
        <p className="text-xs font-medium uppercase tracking-[0.2em] opacity-70">Current build</p>
        <h2 className="mt-2 font-display text-3xl">
          Work with what is live. See what still needs authority.
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed opacity-80">
          Operational tools open directly. Review tools are safe to exercise with acceptance
          evidence. Provider-backed capabilities remain visibly locked until their backend, security
          and cost controls are approved.
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs">
          <Badge className="border-white/20 bg-white/10 text-white">
            {summary.operational} operational
          </Badge>
          <Badge className="border-white/20 bg-white/10 text-white">
            {summary.review} require acceptance
          </Badge>
          <Badge className="border-white/20 bg-white/10 text-white">
            {summary.blocked} backend-blocked
          </Badge>
        </div>
      </section>

      <section aria-labelledby="workspace-heading">
        <div className="mb-4">
          <h2 id="workspace-heading" className="font-display text-2xl">
            Workspaces
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Every available action stays inside the existing role and approval boundaries.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {AI_STUDIO_WORKSPACES.map((workspace) => {
            const StatusIcon = statusIcon[workspace.status];
            return (
              <article key={workspace.title} className="card-elevated flex min-h-56 flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-xl">{workspace.title}</h3>
                  <Badge variant="outline" className={statusStyle[workspace.status]}>
                    <StatusIcon className="mr-1 h-3 w-3" />
                    {workspace.statusLabel}
                  </Badge>
                </div>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {workspace.description}
                </p>
                {workspace.href ? (
                  <Button asChild className="mt-5 w-full justify-between">
                    <Link to={workspace.href}>
                      {workspace.nextAction}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                ) : (
                  <Button className="mt-5 w-full" variant="outline" disabled>
                    <LockKeyhole className="mr-2 h-4 w-4" />
                    {workspace.nextAction}
                  </Button>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
};

export default AIStudio;
