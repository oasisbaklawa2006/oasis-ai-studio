import { AlertTriangle, Database, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

type CapabilityUnavailableProps = {
  title: string;
  capability: string;
  retained?: string;
};

/** Honest fail-closed state for modules whose governed backend is not deployed. */
export function CapabilityUnavailable({
  title,
  capability,
  retained = "No production data was changed.",
}: CapabilityUnavailableProps) {
  return (
    <>
      <PageHeader
        title={title}
        subtitle="Frontend workspace retained; governed production capability is not deployed."
      />
      <div className="card-elevated mx-auto max-w-3xl border-warning/40 p-6">
        <div className="mb-4 flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div>
            <h2 className="font-display text-lg">Module safely on hold</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The canonical production database does not currently expose {capability}. The app has
              stopped sending invalid requests instead of pretending the module is operational.
            </p>
          </div>
        </div>
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-md border p-3">
            <Database className="mb-2 h-4 w-4 text-accent" />
            Backend status: not deployed
          </div>
          <div className="rounded-md border p-3">
            <ShieldCheck className="mb-2 h-4 w-4 text-success" />
            {retained}
          </div>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Re-enable only after forward-only schema ownership, RLS, generated types, and acceptance
          tests are approved in the backend repository.
        </p>
      </div>
    </>
  );
}
