import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadRolesWithTransientRetry, roleLoadErrorMessage } from "./authRoleLoader";

type Role =
  | "owner"
  | "admin"
  | "product_manager"
  | "catalogue_manager"
  | "designer"
  | "sales"
  | "catalogue_contributor";

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
  user: null,
  session: null,
  roles: [],
  loading: true,
  rolesLoading: false,
  bootstrapError: null,
  retryBootstrap: async () => {},
  signOut: async () => {},
});

const normalizeRole = (role: unknown): Role | null => {
  const value = String(role ?? "")
    .trim()
    .toLowerCase();

  if (!value) return null;

  if (value === "super_admin" || value === "super admin" || value === "superadmin") {
    return "owner";
  }

  if (value === "owner") return "owner";
  if (value === "admin") return "admin";
  if (value === "product_manager") return "product_manager";
  if (value === "catalogue_manager") return "catalogue_manager";
  if (value === "designer") return "designer";
  if (value === "sales") return "sales";
  if (value === "catalogue_contributor") return "catalogue_contributor";

  return null;
};

const normalizeRoles = (roles: unknown): Role[] => {
  const raw = Array.isArray(roles) ? roles : [];
  const normalized = raw.map(normalizeRole).filter((role): role is Role => Boolean(role));

  return Array.from(new Set(normalized));
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const roleRequestRef = useRef<Promise<void> | null>(null);

  const loadRolesViaRpc = useCallback(async () => {
    if (roleRequestRef.current) return roleRequestRef.current;

    const request = (async () => {
      setRolesLoading(true);
      setBootstrapError(null);

      try {
        const data = await loadRolesWithTransientRetry(() =>
          supabase.rpc("get_current_user_roles"),
        );
        const normalizedRoles = normalizeRoles(data);

        console.log("[Auth] rpc roles raw:", data);
        console.log("[Auth] rpc roles normalized:", normalizedRoles);

        setRoles(normalizedRoles);

        if (normalizedRoles.length === 0) {
          setBootstrapError("No role assigned. Please contact admin.");
        }
      } catch (error: unknown) {
        console.error("[Auth] get_current_user_roles failed:", error);
        setBootstrapError(roleLoadErrorMessage(error));
        setRoles([]);
      } finally {
        setRolesLoading(false);
      }
    })().finally(() => {
      roleRequestRef.current = null;
    });

    roleRequestRef.current = request;
    return request;
  }, []);

  useEffect(() => {
    let mounted = true;

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      console.log("[Auth] state change:", event, !!s);

      setSession(s);
      setUser(s?.user ?? null);

      if (event === "SIGNED_IN" && s?.user) {
        setTimeout(() => {
          if (mounted) loadRolesViaRpc();
        }, 0);
      } else if (event === "SIGNED_OUT") {
        setRoles([]);
        setBootstrapError(null);
        setRolesLoading(false);
      }
    });

    (async () => {
      const {
        data: { session: s },
      } = await supabase.auth.getSession();

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

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadRolesViaRpc]);

  const retryBootstrap = useCallback(async () => {
    if (user) await loadRolesViaRpc();
  }, [user, loadRolesViaRpc]);

  return (
    <Ctx.Provider
      value={{
        user,
        session,
        roles,
        loading,
        rolesLoading,
        bootstrapError,
        retryBootstrap,
        signOut: async () => {
          await supabase.auth.signOut();
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => useContext(Ctx);
