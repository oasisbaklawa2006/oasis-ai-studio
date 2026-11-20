import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * AI Studio is a separate deployable app, but not a separate source of staff
 * authorization. Every protected route requires an active Core Studio membership.
 * A valid Auth JWT alone is not permission to enter the employee workspace.
 *
 * Outcomes are deliberately distinct:
 *  - the backend answered `true`  -> allowed
 *  - the backend answered `false` -> "access not approved" (final)
 *  - the answer could not be obtained (network, timeout, missing RPC) -> after bounded
 *    retries, a fail-closed "unable to verify" screen with a manual retry. Never allowed.
 */
type Verdict = "allowed" | "denied" | "unverified";
type RpcResult = { data: unknown; error: { message: string } | null };

const RETRY_DELAYS_MS = [400, 1200];
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function checkMembership(): Promise<Verdict> {
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<RpcResult>;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const { data, error } = await rpc("has_ai_studio_permission_v1", {
        p_key: "ai_studio.app.access",
      });
      if (!error && data === true) return "allowed";
      if (!error && data === false) return "denied";
    } catch {
      // transport failure: retry below, never treated as an authorization answer
    }
    if (attempt < RETRY_DELAYS_MS.length) await wait(RETRY_DELAYS_MS[attempt]);
  }
  return "unverified";
}

export const ProtectedRoute = () => {
  const { user, session, loading } = useAuth();
  const userId = user?.id ?? null;
  const token = session?.access_token ?? "";
  const [verdict, setVerdict] = useState<{ userId: string; value: Verdict } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const verdictRef = useRef(verdict);
  verdictRef.current = verdict;

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` is the manual re-check trigger
  useEffect(() => {
    let cancelled = false;
    if (!userId || !token) {
      setVerdict(null);
      return;
    }
    // A different identity always starts from "unknown". A token refresh for the SAME
    // identity keeps the last verdict while re-checking in the background, so the
    // protected tree (and any unsaved editor state) is not unmounted.
    const previous = verdictRef.current;
    if (previous && previous.userId !== userId) setVerdict(null);
    void checkMembership().then((value) => {
      if (cancelled) return;
      // Background re-check that could not be answered must not downgrade a verdict that
      // was just confirmed for this same identity; a real `false` always applies.
      const prior = verdictRef.current;
      if (value === "unverified" && prior?.userId === userId && prior.value === "allowed") return;
      setVerdict({ userId, value });
    });
    return () => {
      cancelled = true;
    };
  }, [userId, token, attempt]);

  const retry = useCallback(() => {
    setVerdict(null);
    setAttempt((n) => n + 1);
  }, []);

  if (loading) return <Checking />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!verdict || verdict.userId !== userId) return <Checking />;
  if (verdict.value === "allowed") return <Outlet />;
  if (verdict.value === "unverified") {
    return (
      <div
        role="alert"
        className="min-h-screen flex flex-col items-center justify-center gap-3 p-8 text-center"
      >
        <h1 className="font-display text-2xl">Unable to verify AI Studio access</h1>
        <p className="max-w-lg text-sm text-muted-foreground">
          The membership service did not answer. Access stays closed until it can be confirmed.
        </p>
        <button type="button" className="underline text-sm" onClick={retry}>
          Retry verification
        </button>
      </div>
    );
  }
  return (
    <div
      role="alert"
      className="min-h-screen flex flex-col items-center justify-center gap-3 p-8 text-center"
    >
      <h1 className="font-display text-2xl">AI Studio access not approved</h1>
      <p className="max-w-lg text-sm text-muted-foreground">
        Your Oasis login is valid, but the canonical Core identity has no active AI Studio
        membership. Contact your authorized administrator. Pending, suspended, rejected and revoked
        accounts cannot enter the Studio.
      </p>
    </div>
  );
};

const Checking = () => (
  <div className="min-h-screen flex items-center justify-center text-muted-foreground">
    Checking Studio membership…
  </div>
);
