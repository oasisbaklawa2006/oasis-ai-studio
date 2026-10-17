import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";

type CapabilityUnavailableProps = {
  title: string;
  capability: string;
  retained?: string;
  publicView?: boolean;
};

/** Keep unavailable Core capabilities separate from Studio's product editing workspace. */
export function CapabilityUnavailable({
  title,
  retained,
  publicView = false,
}: CapabilityUnavailableProps) {
  return (
    <>
      <PageHeader
        title={title}
        subtitle={
          publicView
            ? "This catalogue link is not available."
            : "This capability is managed in Oasis Core."
        }
      />
      <div className="card-elevated mx-auto max-w-3xl border-warning/40 p-6" role="status">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
          <div>
            <h2 className="font-display text-lg">
              {publicView ? "Catalogue unavailable" : "Capability awaiting activation"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {publicView
                ? "Ask the catalogue owner for an approved, published catalogue. This link cannot display one yet."
                : "Ask your catalogue administrator to enable the governed capability in Oasis Core. You can continue editing products in AI Studio while it is on hold."}
            </p>
            {!publicView && (
              <Button asChild className="mt-4">
                <Link to="/products">Open products</Link>
              </Button>
            )}
            {!publicView && retained && (
              <p className="mt-3 text-sm text-muted-foreground">{retained}</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
