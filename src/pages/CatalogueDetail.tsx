import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ExternalLink, Trash2, Printer, Send, CheckCircle2, Archive, Undo2, FileText } from "lucide-react";
import { toast } from "sonner";
import { ProductPicker } from "@/components/ProductPicker";
import { SharePanel } from "@/components/SharePanel";
import { useAuth } from "@/contexts/AuthContext";
import { canAccessPage } from "@/lib/permissions";

const STATUS_TONES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  internal_review: "bg-warning/10 text-warning",
  published: "bg-success/10 text-success",
  archived: "bg-destructive/10 text-destructive",
};

const CatalogueDetail = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const { roles } = useAuth();
  const canWrite = canAccessPage(roles as any, "catalogues_write");
  const [c, setC] = useState<any>(null);
  const [linked, setLinked] = useState<any[]>([]);

  const load = async () => {
    const [cat, links] = await Promise.all([
      supabase.from("catalogues").select("*").eq("id", id).single(),
      supabase.from("catalogue_products").select("*, products(id,product_name,sku,hero_image_url,short_description,pack_size,shelf_life_days,mrp)").eq("catalogue_id", id).order("sort_order"),
    ]);
    setC(cat.data); setLinked(links.data ?? []);
  };
  useEffect(() => { load(); }, [id]);

  if (!c) return <div className="text-muted-foreground">Loading…</div>;

  const update = async (patch: any) => {
    const { error } = await supabase.from("catalogues").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    setC({ ...c, ...patch });
  };
  const setStatus = async (status: string) => {
    await update({ status });
    toast.success(`Status: ${status.replace(/_/g," ")}`);
    load();
  };
  const addProduct = async (pid: string) => {
    if (linked.find((l) => l.product_id === pid)) return;
    await supabase.from("catalogue_products").insert({ catalogue_id: id, product_id: pid, sort_order: linked.length });
    load();
  };
  const removeProduct = async (lid: string) => { await supabase.from("catalogue_products").delete().eq("id", lid); load(); };

  const publicUrl = `${window.location.origin}/c/${c.public_slug}`;
  const status = c.status ?? "draft";
  const showPrice = c.price_visibility === "visible";

  return (
    <>
      <PageHeader title={c.title} subtitle={c.subtitle ?? "Catalogue editor"}
        actions={<>
          <span className={`badge-soft ${STATUS_TONES[status]} capitalize`}>{status.replace(/_/g, " ")}</span>
          <Button variant="outline" onClick={() => nav("/catalogues")}>Back</Button>
          <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" />Print / PDF</Button>
          <Button asChild><a href={`/c/${c.public_slug}`} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4 mr-1" />Public</a></Button>
        </>} />

      {canWrite && (
        <div className="card-elevated p-4 mb-6 flex flex-wrap gap-2 no-print">
          <Button size="sm" variant="outline" onClick={() => setStatus("draft")}><Undo2 className="h-4 w-4 mr-1" />Save Draft</Button>
          <Button size="sm" variant="outline" onClick={() => setStatus("internal_review")}><Send className="h-4 w-4 mr-1" />Send to Internal Review</Button>
          <Button size="sm" onClick={() => setStatus("published")}><CheckCircle2 className="h-4 w-4 mr-1" />Publish</Button>
          {status === "published" && <Button size="sm" variant="outline" onClick={() => setStatus("draft")}>Unpublish</Button>}
          <Button size="sm" variant="ghost" onClick={() => setStatus("archived")}><Archive className="h-4 w-4 mr-1" />Archive</Button>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card-elevated p-5 no-print">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-xl">Products in catalogue ({linked.length})</h3>
            </div>
            <div className="space-y-2">
              {linked.map((l) => (
                <div key={l.id} className="flex items-center gap-3 p-2 rounded-lg border">
                  <div className="h-12 w-12 bg-muted rounded overflow-hidden flex-shrink-0">
                    {l.products?.hero_image_url && <img src={l.products.hero_image_url} className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{l.products?.product_name}</div>
                    <div className="text-xs text-muted-foreground font-mono truncate">{l.products?.sku}</div>
                  </div>
                  {canWrite && <Button size="icon" variant="ghost" onClick={() => removeProduct(l.id)}><Trash2 className="h-4 w-4" /></Button>}
                </div>
              ))}
              {linked.length === 0 && <div className="text-sm text-muted-foreground py-4 text-center">Add products from the right panel.</div>}
            </div>
          </div>

          {canWrite && (
            <div className="card-elevated p-5 space-y-4 no-print">
              <h3 className="font-display text-xl">Cover & intro</h3>
              <div><Label>Cover image URL</Label><Input value={c.cover_image_url ?? ""} onChange={(e) => setC({ ...c, cover_image_url: e.target.value })} onBlur={(e) => update({ cover_image_url: e.target.value })} /></div>
              <div><Label>Intro text</Label><Textarea rows={3} value={c.intro_text ?? ""} onChange={(e) => setC({ ...c, intro_text: e.target.value })} onBlur={(e) => update({ intro_text: e.target.value })} /></div>
            </div>
          )}

          {canWrite && (
            <div className="card-elevated p-5 space-y-4 no-print">
              <h3 className="font-display text-xl">Customer channel & price display</h3>
              <p className="text-xs text-muted-foreground">Catalogue shows only the selected customer channel's price. Internal/franchisee/own-outlet prices must never be shown publicly.</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Target customer channel</Label>
                  <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={c.target_customer_channel ?? "price_hidden"} onChange={(e) => { setC({ ...c, target_customer_channel: e.target.value }); update({ target_customer_channel: e.target.value }); }}>
                    {["retail","b2c","bulk","wholesale","horeca","b2b","distributor","franchisee","own_outlet","export","private_label","corporate_gifting","wedding","price_hidden"].map((ch) => <option key={ch} value={ch}>{ch.replace(/_/g," ")}</option>)}
                  </select>
                </div>
                <div><Label className="text-xs">Price label (e.g. "B2B price")</Label><Input value={c.show_price_label ?? ""} onChange={(e) => setC({ ...c, show_price_label: e.target.value })} onBlur={(e) => update({ show_price_label: e.target.value || null })} /></div>
                <div className="flex items-center justify-between border rounded p-2"><Label className="text-xs">Show price</Label><input type="checkbox" checked={!!c.show_price} onChange={(e) => { setC({ ...c, show_price: e.target.checked }); update({ show_price: e.target.checked }); }} /></div>
                <div className="flex items-center justify-between border rounded p-2"><Label className="text-xs">Show MRP</Label><input type="checkbox" checked={!!c.show_mrp} onChange={(e) => { setC({ ...c, show_mrp: e.target.checked }); update({ show_mrp: e.target.checked }); }} /></div>
                <div className="flex items-center justify-between border rounded p-2"><Label className="text-xs">Show discount %</Label><input type="checkbox" checked={!!c.show_discount} onChange={(e) => { setC({ ...c, show_discount: e.target.checked }); update({ show_discount: e.target.checked }); }} /></div>
              </div>
            </div>
          )}

          {/* Print view */}
          <div className="hidden print:block print-page">
            <div className="text-center mb-6">
              <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Oasis Baklawa</div>
              <h1 className="font-display text-4xl mt-2">{c.title}</h1>
              {c.subtitle && <div className="text-sm text-muted-foreground mt-1">{c.subtitle}</div>}
              {c.client_name && <div className="text-sm mt-2">For <strong>{c.client_name}</strong></div>}
              {c.intro_text && <p className="text-sm max-w-2xl mx-auto mt-4">{c.intro_text}</p>}
            </div>
            <div className="print-grid">
              {linked.map((l) => {
                const p = l.products; if (!p) return null;
                return (
                  <div key={l.id} className="card-elevated overflow-hidden">
                    <div className="aspect-[4/3] bg-muted">
                      {p.hero_image_url && <img src={p.hero_image_url} className="w-full h-full object-cover" />}
                    </div>
                    <div className="p-4">
                      <div className="font-display text-lg">{p.product_name}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">{p.sku}</div>
                      {p.short_description && <p className="text-xs mt-1">{p.short_description}</p>}
                      <div className="text-[11px] text-muted-foreground mt-2 space-y-0.5">
                        {p.pack_size && <div>Pack · {p.pack_size}</div>}
                        {p.shelf_life_days && <div>Shelf life · {p.shelf_life_days} days</div>}
                      </div>
                      {showPrice && p.mrp && <div className="font-display text-base mt-2">₹ {p.mrp}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-8 pt-4 border-t text-center text-xs text-muted-foreground">
              For inquiries, please WhatsApp the Oasis Baklawa team. Curated by Oasis Catalogue AI Studio.
            </div>
          </div>
        </div>

        <div className="space-y-6 no-print">
          <SharePanel url={publicUrl} title={c.title} />
          {canWrite && (
            <div className="card-elevated p-5">
              <h3 className="font-display text-lg mb-2">Add products</h3>
              <ProductPicker excludeIds={linked.map((l) => l.product_id)} onPick={(p) => addProduct(p.id)} />
            </div>
          )}
          <div className="card-elevated p-5 text-xs text-muted-foreground space-y-1">
            <div>Slug: <code className="font-mono text-foreground">{c.public_slug}</code></div>
            <div className="capitalize">Type: {c.catalogue_type?.replace(/_/g, " ")}</div>
            <div className="capitalize">Theme: {c.theme?.replace(/_/g, " ")}</div>
            <div className="capitalize">Price: {c.price_visibility}</div>
            {status !== "published" && <div className="text-warning mt-2">Public link will return “Catalogue not available” until status is published.</div>}
          </div>
        </div>
      </div>
    </>
  );
};

export default CatalogueDetail;
