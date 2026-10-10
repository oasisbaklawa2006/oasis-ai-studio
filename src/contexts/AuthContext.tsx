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
  // A role snapshot is never valid for a different authenticated identity.
  const [rolesUserId, setRolesUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const roleRequestRef = useRef<{ userId: string; request: Promise<void> } | null>(null);
  const identityRef = useRef<string | null>(null);
  const identityVersionRef = useRef(0);
  const authEventSeenRef = useRef(false);

  const bindIdentity = useCallback((userId: string | null) => {
    if (identityRef.current === userId) return;
    identityRef.current = userId;
    identityVersionRef.current += 1;
    roleRequestRef.current = null;
    setRoles([]);
    setRolesUserId(null);
    setRolesLoading(false);
    setBootstrapError(null);
  }, []);

  const loadRolesViaRpc = useCallback(async (userId: string) => {
    if (identityRef.current !== userId) return;
    if (roleRequestRef.current?.userId === userId) {
      return roleRequestRef.current.request;
    }
    const version = identityVersionRef.current;
    const current = () => identityRef.current === userId && identityVersionRef.current === version;

    const request = (async () => {
      setRolesLoading(true);
      setBootstrapError(null);
      try {
        const data = await loadRolesWithTransientRetry(() =>
          supabase.rpc("get_current_user_roles"),
        );
        if (!current()) return;
        const normalizedRoles = normalizeRoles(data);
        setRoles(normalizedRoles);
        setRolesUserId(userId);
        if (normalizedRoles.length === 0) {
          setBootstrapError("No role assigned. Please contact admin.");
        }
      } catch (error: unknown) {
        if (!current()) return;
        console.error("[Auth] get_current_user_roles failed:", error);
        setBootstrapError(roleLoadErrorMessage(error));
        setRoles([]);
        setRolesUserId(null);
      } finally {
        if (current()) setRolesLoading(false);
      }
    })().finally(() => {
      if (roleRequestRef.current?.request === request) {
        roleRequestRef.current = null;
      }
    });
    roleRequestRef.current = { userId, request };
    return request;
  }, []);

  useEffect(() => {
    let mounted = true;

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mounted) return;
      authEventSeenRef.current = true;
      const userId = s?.user?.id ?? null;
      bindIdentity(userId);
      setSession(s);
      setUser(s?.user ?? null);

      if (event === "SIGNED_IN" && userId) {
        // Role RPCs cannot apply to a later account, even if the earlier fetch wins.
        setTimeout(() => {
          if (mounted && identityRef.current === userId) {
            void loadRolesViaRpc(userId);
          }
        }, 0);
      }
      if (event === "SIGNED_OUT") setLoading(false);
    });

    (async () => {
      const {
        data: { session: s },
      } = await supabase.auth.getSession();

      console.log("[Auth] session found:", !!s);

      if (!mounted) return;
      // Auth events can replace the session while getSession is in flight.
      if (authEventSeenRef.current) {
        setLoading(false);
        return;
      }
      const userId = s?.user?.id ?? null;
      bindIdentity(userId);
      setSession(s);
      setUser(s?.user ?? null);
      if (userId) await loadRolesViaRpc(userId);
      if (mounted) setLoading(false);
    })();

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [bindIdentity, loadRolesViaRpc]);

  const retryBootstrap = useCallback(async () => {
    if (user) await loadRolesViaRpc(user.id);
  }, [user, loadRolesViaRpc]);

  return (
    <Ctx.Provider
      value={{
        user,
        session,
        roles: user?.id && rolesUserId === user.id ? roles : [],
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
