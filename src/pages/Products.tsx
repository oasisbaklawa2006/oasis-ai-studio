import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Image as ImageIcon, Tag as TagIcon, Copy } from "lucide-react";
import { searchProductsWithAliases, type ProductSearchResult } from "@/lib/productSearch";
import { toast } from "sonner";
import { ReadinessBadge } from "@/components/ReadinessBadge";

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
  const [results, setResults] = useState<ProductSearchResult[] | null>(null);
  const [q, setQ] = useState("");
  const [div, setDiv] = useState("");
  const [cat, setCat] = useState("");
  const [pack, setPack] = useState("");
  const [rules, setRules] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("products").select("*").order("created_at", { ascending: false }).then(({ data }) => setItems(data ?? []));
    supabase.from("sku_code_rules").select("*").eq("is_active", true).order("sort_order").then(({ data }) => setRules(data ?? []));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      if (!q.trim()) { setResults(null); return; }
      const r = await searchProductsWithAliases(q);
      if (!cancelled) setResults(r);
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q]);

  const aliasById = new Map<string, string>();
  if (results) results.forEach((r) => { if (r.matched_alias && !aliasById.has(r.id)) aliasById.set(r.id, r.matched_alias); });
  const ids = results ? new Set(results.map((r) => r.id)) : null;

  const filtered = items.filter((p) => {
    if (ids && !ids.has(p.id)) return false;
    if (div && p.division_code !== div) return false;
    if (cat && p.category_code !== cat) return false;
    if (pack && p.packaging_code !== pack) return false;
    return true;
  });

  const by = (t: string) => rules.filter((r) => r.code_type === t);
  const copy = (e: React.MouseEvent, sku: string) => { e.preventDefault(); navigator.clipboard.writeText(sku); toast.success("SKU copied"); };

  return (
    <>
      <PageHeader title="Product Master" subtitle="The single source of truth for every Oasis product."
        actions={<Button asChild><Link to="/products/new"><Plus className="h-4 w-4 mr-1" />New Product</Link></Button>} />

      <div className="card-elevated p-4 mb-6 space-y-3">
        <div className="flex items-center gap-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, SKU, alias, misspelling, local name…" className="border-0 focus-visible:ring-0 px-0" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <select className="h-9 px-2 rounded border bg-background text-xs" value={div} onChange={(e) => setDiv(e.target.value)}>
            <option value="">All divisions</option>
            {by("division").map((r) => <option key={r.code} value={r.code}>{r.code} · {r.label}</option>)}
          </select>
          <select className="h-9 px-2 rounded border bg-background text-xs" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">All categories</option>
            {by("category").map((r) => <option key={r.code} value={r.code}>{r.code} · {r.label}</option>)}
          </select>
          <select className="h-9 px-2 rounded border bg-background text-xs" value={pack} onChange={(e) => setPack(e.target.value)}>
            <option value="">All packaging</option>
            {by("packaging").map((r) => <option key={r.code} value={r.code}>{r.code} · {r.label}</option>)}
          </select>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((p) => {
          const matched = aliasById.get(p.id);
          return (
            <Link to={`/products/${p.id}`} key={p.id} className="card-elevated p-5 group">
              <div className="aspect-[4/3] rounded-lg bg-muted mb-4 flex items-center justify-center overflow-hidden">
                {p.hero_image_url
                  ? <img src={p.hero_image_url} alt={p.product_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  : <ImageIcon className="h-10 w-10 text-muted-foreground/40" />}
              </div>
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="min-w-0">
                  <div className="font-display text-xl leading-tight truncate">{p.product_name}</div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5 font-mono">
                    <span className="truncate">{p.sku}</span>
                    <button onClick={(e) => copy(e, p.sku)} className="hover:text-foreground"><Copy className="h-3 w-3" /></button>
                  </div>
                </div>
                {p.is_sample && <span className="badge-soft bg-accent-soft text-accent-foreground">Sample</span>}
              </div>
              {matched && <div className="text-[11px] text-accent-foreground/80 mb-2">Matched by alias: <span className="font-medium">{matched}</span></div>}
              <div className="text-xs text-muted-foreground mb-3">{p.pack_size || "—"} · {p.shelf_life_days ? `${p.shelf_life_days}d shelf` : "—"}</div>
              <div className="flex flex-wrap gap-1.5">
                <Badge tone={p.media_status === "approved" || p.hero_image_url ? "ok" : "warn"}><ImageIcon className="h-3 w-3" />{p.hero_image_url ? "image" : p.media_status}</Badge>
                <Badge tone={p.label_status === "approved" || p.label_status === "locked" ? "ok" : "warn"}><TagIcon className="h-3 w-3" />{p.label_status}</Badge>
                <ReadinessBadge product={p} compact />
              </div>
            </Link>
          );
        })}
        {filtered.length === 0 && <div className="col-span-full text-muted-foreground text-sm py-12 text-center">No products match.</div>}
      </div>
    </>
  );
};

export default Products;
