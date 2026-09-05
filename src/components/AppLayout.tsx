import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  ClipboardCheck,
  Gift,
  History,
  Image,
  Info,
  LayoutDashboard,
  Leaf,
  LogOut,
  Menu,
  Package,
  Settings,
  ShieldCheck,
  Sparkles,
  Tag,
  Tags,
  Upload,
  Wand2,
  Wrench,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { modulePurpose } from "@/lib/modulePurpose";
import { canAccessPage, type PageKey } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { isCatalogueReviewer } from "@/shared/auth/centralPermissions";

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  page: PageKey;
  featureKey?: string;
};
const nav: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, page: "dashboard" },
  { to: "/products", label: "Products", icon: Package, page: "products" },
  { to: "/admin/import/category-1", label: "Cat 1 Import", icon: Upload, page: "category1_import" },
  { to: "/media", label: "Media Library", icon: Image, page: "media" },
  { to: "/tags", label: "Tags", icon: Tags, page: "tags" },
  { to: "/catalogues", label: "Catalogues", icon: BookOpen, page: "catalogues" },
  {
    to: "/admin/catalogue-builder",
    label: "Catalogue Builder",
    icon: BookOpen,
    page: "catalogues",
  },
  {
    to: "/admin/catalogue-product-studio",
    label: "Catalogue Product Studio",
    icon: Wand2,
    page: "catalogues",
  },
  { to: "/hampers", label: "Hampers & BOM", icon: Gift, page: "hampers" },
  { to: "/ingredients", label: "Ingredients", icon: Leaf, page: "ingredients" },
  { to: "/labels", label: "Label Studio", icon: Tag, page: "labels" },
  { to: "/label-queue", label: "Label Queue", icon: ShieldCheck, page: "labels" },
  { to: "/data-correction", label: "Data Correction", icon: Wrench, page: "data_correction" },
  {
    to: "/ai-studio",
    label: "AI Studio",
    icon: Sparkles,
    page: "ai_studio",
    featureKey: "ai_image_studio",
  },
  { to: "/testing", label: "Testing Checklist", icon: ClipboardCheck, page: "testing" },
  { to: "/settings", label: "Activation Center", icon: Settings, page: "settings" },
  { to: "/audit-log", label: "Audit Log", icon: History, page: "audit_log" },
  { to: "/approvals", label: "Approval Inbox", icon: ShieldCheck, page: "audit_log" },
];

export const AppLayout = () => {
  const { user, roles, signOut, loading, rolesLoading } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { flags, loading: flagsLoading } = useFeatureFlags();
  const isAdmin = roles.includes("owner") || roles.includes("admin");
  const [isReviewer, setIsReviewer] = useState(false);
  useEffect(() => {
    (async () => setIsReviewer(await isCatalogueReviewer()))();
  }, []);
  const rolesReady = !loading && !rolesLoading;
  const items = rolesReady
    ? nav.filter((n) => {
        if (n.to === "/approvals") return isAdmin || isReviewer;
        if (!canAccessPage(roles, n.page)) return false;
        if (!n.featureKey) return true; // core pages always visible
        if (flagsLoading) return isAdmin; // don't hide gated items for admin while loading
        const f = flags.find((x) => x.feature_key === n.featureKey);
        if (!f) return isAdmin;
        if (isAdmin) return true;
        return f.is_enabled || f.is_visible;
      })
    : [];
  const roleLabel = !rolesReady ? "Loading account role…" : (roles[0] ?? "Role missing");

  return (
    <div className="min-h-screen flex bg-background">
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-40 w-64 bg-sidebar text-sidebar-foreground transition-transform lg:translate-x-0 no-print flex flex-col",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="px-6 py-6 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg gradient-gold flex items-center justify-center font-display text-xl text-primary">
              O
            </div>
            <div>
              <div className="font-display text-lg leading-tight">Oasis</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/60">
                Catalogue AI Studio
              </div>
            </div>
          </div>
        </div>
        <nav className="px-3 py-4 space-y-1 flex-1 overflow-y-auto">
          {items.map(({ to, label, icon: Icon }) => (
            <div key={to} className="group flex items-center gap-1">
              <NavLink
                to={to}
                end={to === "/"}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-primary font-medium"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{label}</span>
              </NavLink>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={`About ${label}`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                  >
                    <Info className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-72 leading-relaxed">
                  <p className="font-medium">{label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{modulePurpose(to)}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          ))}
        </nav>
        <div className="p-4 border-t border-sidebar-border text-xs">
          <div className="px-2 mb-2">
            <div className="truncate text-sidebar-foreground/90">{user?.email}</div>
            <div className="text-sidebar-foreground/60 capitalize">{roleLabel}</div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={async () => {
              await signOut();
              navigate("/auth");
            }}
          >
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col w-full max-w-full">
        <header className="lg:hidden sticky top-0 z-30 bg-background/80 backdrop-blur border-b px-3 h-14 flex items-center justify-between no-print">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="p-2"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="font-display text-lg truncate">Oasis Studio</div>
          <div className="w-9" />
        </header>
        <main className="flex-1 px-3 sm:px-6 lg:px-8 py-5 lg:py-10 max-w-[1400px] w-full mx-auto min-w-0">
          <Outlet />
        </main>
      </div>
      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-black/40 lg:hidden no-print"
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  );
};
