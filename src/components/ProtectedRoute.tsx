import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * AI Studio is a separate deployable app, but not a separate source of staff
 * authorization. Every protected route requires an active Core Studio membership.
 * A valid Auth JWT alone is not permission to enter the employee workspace.
 */
export const ProtectedRoute = () => {
  const { user, session, loading } = useAuth();
  const [access, setAccess] = useState<{
    userId: string;
    accessToken: string;
    allowed: boolean;
  } | null>(null);
  const [checking, setChecking] = useState(false);
  const userId = user?.id ?? null;
  const token = session?.access_token ?? "";

  useEffect(() => {
    let cancelled = false;
    setAccess(null);
    if (!userId || !token) {
      setChecking(false);
      return;
    }
    setChecking(true);
    const rpc = supabase.rpc as unknown as (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
    void rpc("has_ai_studio_permission_v1", { p_key: "ai_studio.app.access" })
      .then(({ data, error }) => {
        if (!cancelled) setAccess({ userId, accessToken: token, allowed: !error && data === true });
      })
      .catch(() => {
        if (!cancelled) setAccess({ userId, accessToken: token, allowed: false });
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, token]);

  if (
    loading ||
    (userId && (checking || access?.userId !== userId || access?.accessToken !== token))
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Checking Studio membership…
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!access?.allowed) {
    return (
      <div
        role="alert"
        className="min-h-screen flex flex-col items-center justify-center gap-3 p-8 text-center"
      >
        <h1 className="font-display text-2xl">AI Studio access not approved</h1>
        <p className="max-w-lg text-sm text-muted-foreground">
          Your Oasis login is valid, but the canonical Core identity has no active AI Studio
          membership. Contact your authorized administrator. Pending, suspended, rejected and
          revoked accounts cannot enter the Studio.
        </p>
      </div>
    );
  }
  return <Outlet />;
};
