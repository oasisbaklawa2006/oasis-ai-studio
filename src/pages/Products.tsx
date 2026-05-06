import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Image as ImageIcon, Tag as TagIcon, BookOpen } from "lucide-react";

const Badge = ({ tone, children }: { tone: "ok" | "warn" | "muted"; children: React.ReactNode }) => {
  const map = {
    ok: "bg-success/10 text-success",
    warn: "bg-warning/10 text-warning",
    muted: "bg-muted text-muted-foreground",
  } as const;
  return <span className={`badge-soft ${map[tone]}`}>{children}</span>;
};

const Products = () => {
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    supabase.from("products").select("*").order("created_at", { ascending: false }).then(({ data }) => setItems(data ?? []));
  }, []);

  const filtered = items.filter((p) =>
    [p.product_name, p.sku, p.category].join(" ").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <>
      <PageHeader title="Product Master" subtitle="The single source of truth for every Oasis product."
        actions={<Button asChild><Link to="/products/new"><Plus className="h-4 w-4 mr-1" />New Product</Link></Button>} />

      <div className="card-elevated p-4 mb-6 flex items-center gap-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, SKU, category…" className="border-0 focus-visible:ring-0 px-0" />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((p) => (
          <Link to={`/products/${p.id}`} key={p.id} className="card-elevated p-5 group">
            <div className="aspect-[4/3] rounded-lg bg-muted mb-4 flex items-center justify-center overflow-hidden">
              {p.hero_image_url
                ? <img src={p.hero_image_url} alt={p.product_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                : <ImageIcon className="h-10 w-10 text-muted-foreground/40" />}
            </div>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <div className="font-display text-xl leading-tight">{p.product_name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{p.sku} · {p.category ?? "Uncategorised"}</div>
              </div>
              {p.is_sample && <span className="badge-soft bg-accent-soft text-accent-foreground">Sample</span>}
            </div>
            <div className="text-xs text-muted-foreground mb-3">{p.pack_size} · {p.shelf_life_days ? `${p.shelf_life_days}d shelf` : "—"}</div>
            <div className="flex flex-wrap gap-1.5">
              <Badge tone={p.media_status === "approved" ? "ok" : "warn"}><ImageIcon className="h-3 w-3" />{p.media_status}</Badge>
              <Badge tone={p.label_status === "approved" ? "ok" : "warn"}><TagIcon className="h-3 w-3" />{p.label_status}</Badge>
              <Badge tone={p.is_catalogue_ready ? "ok" : "muted"}><BookOpen className="h-3 w-3" />{p.is_catalogue_ready ? "ready" : "not ready"}</Badge>
            </div>
          </Link>
        ))}
        {filtered.length === 0 && <div className="col-span-full text-muted-foreground text-sm py-12 text-center">No products yet.</div>}
      </div>
    </>
  );
};

export default Products;
