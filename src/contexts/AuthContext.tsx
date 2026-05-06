import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

type Role = "owner" | "admin" | "product_manager" | "catalogue_manager" | "designer" | "sales";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  roles: Role[];
  loading: boolean;
  rolesLoading: boolean;
  bootstrapError: string | null;
  retryBootstrap: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null, session: null, roles: [], loading: true, rolesLoading: false,
  bootstrapError: null, retryBootstrap: async () => {}, signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  const loadRolesViaRpc = useCallback(async () => {
    setRolesLoading(true);
    setBootstrapError(null);
    try {
      const { data, error } = await supabase.rpc("get_current_user_roles");
      if (error) throw error;
      const arr = (Array.isArray(data) ? data : []) as Role[];
      console.log("[Auth] rpc roles:", arr);
      setRoles(arr);
      if (arr.length === 0) setBootstrapError("No role assigned. Please contact admin.");
    } catch (e: any) {
      console.error("[Auth] get_current_user_roles failed:", e);
      setBootstrapError(e?.message ?? "Role setup failed");
      setRoles([]);
    } finally {
      setRolesLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      console.log("[Auth] state change:", event, !!s);
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => { if (mounted) loadRolesViaRpc(); }, 0);
      } else {
        setRoles([]);
        setBootstrapError(null);
        setRolesLoading(false);
      }
    });

    (async () => {
      const { data: { session: s } } = await supabase.auth.getSession();
      console.log("[Auth] session found:", !!s);
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setRolesLoading(true);
        await loadRolesViaRpc();
      }
      if (mounted) setLoading(false);
    })();

    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [loadRolesViaRpc]);

  const retryBootstrap = useCallback(async () => {
    if (user) await loadRolesViaRpc();
  }, [user, loadRolesViaRpc]);

  return (
    <Ctx.Provider value={{
      user, session, roles, loading, rolesLoading, bootstrapError, retryBootstrap,
      signOut: async () => { await supabase.auth.signOut(); },
    }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => useContext(Ctx);
