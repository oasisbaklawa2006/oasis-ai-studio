import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { canAccessPage, type PageKey } from "@/lib/permissions";
import { AccessRestricted } from "./AccessRestricted";

export const RoleGate = ({ page, children }: { page: PageKey; children: ReactNode }) => {
  const { roles, loading, rolesLoading, bootstrapError, retryBootstrap, user } = useAuth();
  if (loading || rolesLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-muted-foreground">
        Loading your account…
      </div>
    );
  }
  if (user && bootstrapError) {
    return (
      <div className="min-h-[40vh] flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-muted-foreground max-w-md">
          Account role setup failed. Retry role setup or contact admin.
        </p>
        <p className="text-xs text-muted-foreground">{bootstrapError}</p>
        <Button onClick={retryBootstrap}>Retry Role Setup</Button>
      </div>
    );
  }
  if (!canAccessPage(roles, page)) return <AccessRestricted />;
  return <>{children}</>;
};
