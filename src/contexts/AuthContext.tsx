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

  const loadRolesFor = useCallback(async (uid: string): Promise<Role[]> => {
    const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    if (error) { console.warn("[Auth] roles fetch error:", error.message); return []; }
    return (data ?? []).map((r: any) => r.role as Role);
  }, []);

  const ensureRoles = useCallback(async (uid: string) => {
    setRolesLoading(true);
    setBootstrapError(null);
    try {
      let current = await loadRolesFor(uid);
      console.log("[Auth] roles found:", current);
      if (current.length === 0) {
        console.log("[Auth] bootstrap_current_user called");
        const { error } = await supabase.rpc("bootstrap_current_user");
        if (error) throw error;
        current = await loadRolesFor(uid);
        console.log("[Auth] roles after bootstrap:", current);
      }
      setRoles(current);
      console.log("[Auth] final role loaded:", current);
    } catch (e: any) {
      console.error("[Auth] bootstrap failed:", e);
      setBootstrapError(e?.message ?? "Role setup failed");
      setRoles([]);
    } finally {
      setRolesLoading(false);
    }
  }, [loadRolesFor]);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      console.log("[Auth] state change:", event, !!s);
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => { ensureRoles(s.user.id); }, 0);
      } else {
        setRoles([]);
        setBootstrapError(null);
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("[Auth] session found:", !!session);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) ensureRoles(session.user.id);
    });
    return () => sub.subscription.unsubscribe();
  }, [ensureRoles]);

  const retryBootstrap = useCallback(async () => {
    if (user) await ensureRoles(user.id);
  }, [user, ensureRoles]);

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
