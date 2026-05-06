import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Package, Image, BookOpen, Tag, Sparkles, Plus, Upload, Gift, Wand2 } from "lucide-react";

const StatCard = ({ label, value, hint }: { label: string; value: string | number; hint?: string }) => (
  <div className="card-elevated p-6">
    <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="font-display text-4xl mt-2 text-primary">{value}</div>
    {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
  </div>
);

const Dashboard = () => {
  const [stats, setStats] = useState({ products: 0, catalogues: 0, media: 0, pendingLabels: 0 });
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [p, c, m, l, r] = await Promise.all([
        supabase.from("products").select("*", { count: "exact", head: true }),
        supabase.from("catalogues").select("*", { count: "exact", head: true }).eq("is_published", true),
        supabase.from("product_media").select("*", { count: "exact", head: true }),
        supabase.from("products").select("*", { count: "exact", head: true }).neq("label_status", "approved"),
        supabase.from("catalogues").select("id,title,public_slug,is_published").order("created_at",{ascending:false}).limit(5),
      ]);
      setStats({ products: p.count ?? 0, catalogues: c.count ?? 0, media: m.count ?? 0, pendingLabels: l.count ?? 0 });
      setRecent(r.data ?? []);
    })();
  }, []);

  const ai = [
    { title: "Photo Enhancement", desc: "Upgrade raw iPhone photos to luxury-grade catalogue shots.", status: "Planned" },
    { title: "Product Identification", desc: "AI recognizes product from photo and links to master.", status: "Planned" },
    { title: "Video / Reel Generation", desc: "Auto reels for WhatsApp & social.", status: "Planned" },
    { title: "Compliance Auto-Labeling", desc: "Draft FSSAI-style label data; human approves.", status: "Planned" },
  ];

  return (
    <>
      <PageHeader title="Studio Overview" subtitle="Your premium catalogue intelligence at a glance." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard label="Products" value={stats.products} hint="In master" />
        <StatCard label="Active Catalogues" value={stats.catalogues} hint="Published" />
        <StatCard label="Media Assets" value={stats.media} hint="All types" />
        <StatCard label="Pending Labels" value={stats.pendingLabels} hint="Awaiting approval" />
      </div>

      <h2 className="font-display text-2xl mb-3">Quick actions</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-10">
        {[
          { to: "/products/new", label: "Add Product", icon: Plus },
          { to: "/media", label: "Upload Media", icon: Upload },
          { to: "/catalogues", label: "Create Catalogue", icon: BookOpen },
          { to: "/hampers", label: "Create Hamper", icon: Gift },
          { to: "/labels", label: "Prepare Label", icon: Tag },
        ].map((a) => (
          <Button asChild variant="outline" key={a.to} className="h-auto py-4 justify-start">
            <Link to={a.to}><a.icon className="h-4 w-4 mr-2 text-accent" />{a.label}</Link>
          </Button>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <h2 className="font-display text-2xl mb-3">Recent catalogues</h2>
          <div className="card-elevated divide-y">
            {recent.length === 0 && <div className="p-6 text-sm text-muted-foreground">No catalogues yet. Create one to start sharing.</div>}
            {recent.map((c) => (
              <div key={c.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium">{c.title}</div>
                  <div className="text-xs text-muted-foreground">{c.is_published ? "Published" : "Draft"}{c.public_slug ? ` · /c/${c.public_slug}` : ""}</div>
                </div>
                <Button asChild variant="ghost" size="sm"><Link to={`/catalogues/${c.id}`}>Open</Link></Button>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2 className="font-display text-2xl mb-3 flex items-center gap-2"><Sparkles className="h-5 w-5 text-accent" /> AI Studio</h2>
          <div className="space-y-3">
            {ai.map((m) => (
              <div key={m.title} className="card-elevated p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2"><Wand2 className="h-4 w-4 text-accent mt-0.5" /><div className="font-medium text-sm">{m.title}</div></div>
                  <span className="badge-soft bg-accent-soft text-accent-foreground">{m.status}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;
