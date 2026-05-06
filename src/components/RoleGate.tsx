import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { canAccessPage, type PageKey } from "@/lib/permissions";
import { AccessRestricted } from "./AccessRestricted";

export const RoleGate = ({ page, children }: { page: PageKey; children: ReactNode }) => {
  const { roles, loading } = useAuth();
  if (loading) return null;
  if (!canAccessPage(roles as any, page)) return <AccessRestricted />;
  return <>{children}</>;
};
