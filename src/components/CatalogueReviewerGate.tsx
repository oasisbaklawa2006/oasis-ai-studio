import type { ReactNode } from "react";
import { useCatalogueReviewer } from "@/hooks/useCatalogueReviewer";
import { AccessRestricted } from "./AccessRestricted";

const REVIEWER_NOTE =
  "The approval inbox is restricted to catalogue reviewers. Contact an Owner or Admin to request reviewer access.";

export const CatalogueReviewerGate = ({ children }: { children: ReactNode }) => {
  const { isReviewer, loading } = useCatalogueReviewer();

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-muted-foreground">
        Loading your account…
      </div>
    );
  }

  if (!isReviewer) return <AccessRestricted note={REVIEWER_NOTE} />;
  return <>{children}</>;
};
