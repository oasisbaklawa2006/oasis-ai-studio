import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, Package, Image, Tags, BookOpen, Gift, Leaf, Tag, Sparkles, Settings, LogOut, Menu, ClipboardCheck, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { canAccessPage, type PageKey } from "@/lib/permissions";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";

type NavItem = { to: string; label: string; icon: any; page: PageKey; featureKey?: string };
const nav: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, page: "dashboard" },
  { to: "/products", label: "Products", icon: Package, page: "products" },
  { to: "/media", label: "Media Library", icon: Image, page: "media" },
  { to: "/tags", label: "Tags", icon: Tags, page: "tags" },
  { to: "/catalogues", label: "Catalogues", icon: BookOpen, page: "catalogues" },
  { to: "/hampers", label: "Hampers & BOM", icon: Gift, page: "hampers" },
  { to: "/ingredients", label: "Ingredients", icon: Leaf, page: "ingredients" },
  { to: "/labels", label: "Label Studio", icon: Tag, page: "labels", featureKey: "barcode_label_app" },
  { to: "/label-queue", label: "Label Queue", icon: ShieldCheck, page: "labels", featureKey: "barcode_label_app" },
  { to: "/ai-studio", label: "AI Studio", icon: Sparkles, page: "ai_studio", featureKey: "ai_image_studio" },
  { to: "/testing", label: "Testing Checklist", icon: ClipboardCheck, page: "testing" },
  { to: "/settings", label: "Activation Center", icon: Settings, page: "settings" },
];

export const AppLayout = () => {
  const { user, roles, signOut, loading, rolesLoading } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rolesReady = !loading && !rolesLoading;
  const items = rolesReady ? nav.filter((n) => canAccessPage(roles as any, n.page)) : [];
  const roleLabel = !rolesReady ? "Loading account role…" : (roles[0] ?? "Role missing");

  return (
    <div className="min-h-screen flex bg-background">
      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 z-40 w-64 bg-sidebar text-sidebar-foreground transition-transform lg:translate-x-0 no-print flex flex-col",
        open ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="px-6 py-6 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg gradient-gold flex items-center justify-center font-display text-xl text-primary">O</div>
            <div>
              <div className="font-display text-lg leading-tight">Oasis</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/60">Catalogue AI Studio</div>
            </div>
          </div>
        </div>
        <nav className="px-3 py-4 space-y-1 flex-1 overflow-y-auto">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setOpen(false)}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary font-medium"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-sidebar-border text-xs">
          <div className="px-2 mb-2">
            <div className="truncate text-sidebar-foreground/90">{user?.email}</div>
            <div className="text-sidebar-foreground/60 capitalize">{roleLabel}</div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={async () => { await signOut(); navigate("/auth"); }}>
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col w-full max-w-full">
        <header className="lg:hidden sticky top-0 z-30 bg-background/80 backdrop-blur border-b px-3 h-14 flex items-center justify-between no-print">
          <button onClick={() => setOpen(!open)} className="p-2"><Menu className="h-5 w-5" /></button>
          <div className="font-display text-lg truncate">Oasis Studio</div>
          <div className="w-9" />
        </header>
        <main className="flex-1 px-3 sm:px-6 lg:px-8 py-5 lg:py-10 max-w-[1400px] w-full mx-auto min-w-0">
          <Outlet />
        </main>
      </div>
      {open && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden no-print" onClick={() => setOpen(false)} />}
    </div>
  );
};
