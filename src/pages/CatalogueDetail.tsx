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
import { CatalogueWriteModeBanner } from "@/components/CatalogueWriteModeBanner";

const statusClass = (status: string) => {
  if (status === "published") return "catalogue-status-published";
  if (status === "internal_review") return "catalogue-status-review";
  if (status === "archived") return "catalogue-status-archived";
  return "catalogue-status-draft";
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

  if (!c) {
    return (
      <div className="catalogue-loading min-h-[40vh]" aria-busy="true">
        <div className="flex gap-2">
          <span className="catalogue-loading-dot" />
          <span className="catalogue-loading-dot" style={{ animationDelay: "150ms" }} />
          <span className="catalogue-loading-dot" style={{ animationDelay: "300ms" }} />
        </div>
        <p className="luxe-sub text-muted-foreground">Loading catalogue</p>
      </div>
    );
  }

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
      <CatalogueWriteModeBanner />
      <PageHeader title={c.title} subtitle={c.subtitle ?? "Catalogue editor"}
        actions={<>
          <span className={`badge-soft capitalize ${statusClass(status)}`}>{status.replace(/_/g, " ")}</span>
          <Button variant="outline" className="rounded-full" onClick={() => nav("/catalogues")}>Back</Button>
          <Button variant="outline" className="rounded-full" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" />Print / PDF</Button>
          <Button variant="outline" className="rounded-full" onClick={() => nav(`/catalogues/${id}/proposal`)}><FileText className="h-4 w-4 mr-1" />Proposal / PDF</Button>
          <Button asChild className="rounded-full"><a href={`/c/${c.public_slug}`} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4 mr-1" />Public</a></Button>
        </>} />

      {canWrite && (
        <div className="luxe-panel mb-6 flex flex-wrap gap-2 no-print">
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => setStatus("draft")}><Undo2 className="h-4 w-4 mr-1" />Save Draft</Button>
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => setStatus("internal_review")}><Send className="h-4 w-4 mr-1" />Send to Internal Review</Button>
          <Button size="sm" className="rounded-full" onClick={() => setStatus("published")}><CheckCircle2 className="h-4 w-4 mr-1" />Publish</Button>
          {status === "published" && <Button size="sm" variant="outline" className="rounded-full" onClick={() => setStatus("draft")}>Unpublish</Button>}
          <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setStatus("archived")}><Archive className="h-4 w-4 mr-1" />Archive</Button>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6 min-w-0">
        <div className="lg:col-span-2 space-y-6 min-w-0">
          <div className="luxe-panel no-print">
            <div className="flex items-center justify-between mb-4 gap-2">
              <h3 className="luxe-section-title">Products in catalogue ({linked.length})</h3>
            </div>
            <div className="space-y-2">
              {linked.map((l) => (
                <div key={l.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-background/50 min-w-0 transition-colors hover:bg-secondary/30">
                  <div className="h-14 w-14 bg-secondary/80 rounded-xl overflow-hidden flex-shrink-0 ring-1 ring-border/50">
                    {l.products?.hero_image_url && <img src={l.products.hero_image_url} className="w-full h-full object-cover" alt="" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate text-foreground">{l.products?.product_name}</div>
                    <div className="text-xs text-muted-foreground font-mono truncate mt-0.5">{l.products?.sku}</div>
                  </div>
                  {canWrite && <Button size="icon" variant="ghost" className="shrink-0 rounded-full" onClick={() => removeProduct(l.id)}><Trash2 className="h-4 w-4" /></Button>}
                </div>
              ))}
              {linked.length === 0 && (
                <div className="catalogue-empty py-10">
                  <p className="catalogue-empty-text">Add products from the panel on the right to build your catalogue.</p>
                </div>
              )}
            </div>
          </div>

          {canWrite && (
            <div className="luxe-panel space-y-4 no-print">
              <h3 className="luxe-section-title">Cover & intro</h3>
              <div><Label>Cover image URL</Label><Input value={c.cover_image_url ?? ""} onChange={(e) => setC({ ...c, cover_image_url: e.target.value })} onBlur={(e) => update({ cover_image_url: e.target.value })} /></div>
              <div><Label>Intro text</Label><Textarea rows={3} value={c.intro_text ?? ""} onChange={(e) => setC({ ...c, intro_text: e.target.value })} onBlur={(e) => update({ intro_text: e.target.value })} /></div>
            </div>
          )}

          {canWrite && (
            <div className="luxe-panel space-y-4 no-print">
              <h3 className="luxe-section-title">Customer channel & price display</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">Catalogue shows only the selected customer channel&apos;s price. Internal/franchisee/own-outlet prices must never be shown publicly.</p>
              <div className="grid sm:grid-cols-2 gap-3 min-w-0">
                <div className="min-w-0">
                  <Label className="text-xs">Target customer channel</Label>
                  <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={c.target_customer_channel ?? "price_hidden"} onChange={(e) => { setC({ ...c, target_customer_channel: e.target.value }); update({ target_customer_channel: e.target.value }); }}>
                    {["retail","b2c","bulk","wholesale","horeca","b2b","distributor","franchisee","own_outlet","export","private_label","corporate_gifting","wedding","price_hidden"].map((ch) => <option key={ch} value={ch}>{ch.replace(/_/g," ")}</option>)}
                  </select>
                </div>
                <div className="min-w-0"><Label className="text-xs">Price label (e.g. &quot;B2B price&quot;)</Label><Input value={c.show_price_label ?? ""} onChange={(e) => setC({ ...c, show_price_label: e.target.value })} onBlur={(e) => update({ show_price_label: e.target.value || null })} /></div>
                <div className="flex items-center justify-between border border-border/60 rounded-xl p-3 bg-background/40"><Label className="text-xs">Show price</Label><input type="checkbox" checked={!!c.show_price} onChange={(e) => { setC({ ...c, show_price: e.target.checked }); update({ show_price: e.target.checked }); }} /></div>
                <div className="flex items-center justify-between border border-border/60 rounded-xl p-3 bg-background/40"><Label className="text-xs">Show MRP</Label><input type="checkbox" checked={!!c.show_mrp} onChange={(e) => { setC({ ...c, show_mrp: e.target.checked }); update({ show_mrp: e.target.checked }); }} /></div>
                <div className="flex items-center justify-between border border-border/60 rounded-xl p-3 bg-background/40"><Label className="text-xs">Show discount %</Label><input type="checkbox" checked={!!c.show_discount} onChange={(e) => { setC({ ...c, show_discount: e.target.checked }); update({ show_discount: e.target.checked }); }} /></div>
              </div>
            </div>
          )}

          {canWrite && (
            <div className="luxe-panel space-y-3 no-print">
              <h3 className="luxe-section-title">Proposal notes & WhatsApp message</h3>
              <p className="text-xs text-muted-foreground">These appear in the Proposal / PDF preview. Leave blank to use defaults.</p>
              {[
                ["proposal_validity_note", "Validity note"],
                ["proposal_tax_note", "Tax / GST note"],
                ["proposal_transport_note", "Transport note"],
                ["proposal_customization_note", "Customization note"],
                ["proposal_footer_note", "Footer note"],
                ["proposal_whatsapp_message", "WhatsApp proposal message"],
              ].map(([k, label]) => (
                <div key={k}>
                  <Label className="text-xs">{label}</Label>
                  <Textarea rows={2} value={c[k] ?? ""} onChange={(e) => setC({ ...c, [k]: e.target.value })} onBlur={(e) => update({ [k]: e.target.value || null })} />
                </div>
              ))}
            </div>
          )}

          {/* Print view */}
          <div className="hidden print:block print-page">
            <div className="text-center mb-6">
              <div className="luxe-sub text-muted-foreground">Oasis Baklawa</div>
              <h1 className="font-display text-4xl mt-2 text-foreground">{c.title}</h1>
              {c.subtitle && <div className="text-sm text-muted-foreground mt-1">{c.subtitle}</div>}
              {c.client_name && <div className="text-sm mt-2">For <strong>{c.client_name}</strong></div>}
              {c.intro_text && <p className="text-sm max-w-2xl mx-auto mt-4 leading-relaxed">{c.intro_text}</p>}
            </div>
            <div className="print-grid">
              {linked.map((l) => {
                const p = l.products; if (!p) return null;
                return (
                  <div key={l.id} className="luxe-card flex flex-col">
                    <div className="luxe-media relative">
                      {p.hero_image_url
                        ? <img src={p.hero_image_url} alt={p.product_name} />
                        : <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-secondary to-accent-soft/50"><span className="font-display text-3xl text-accent/30">{p.product_name?.[0] ?? "·"}</span></div>}
                    </div>
                    <div className="p-4 text-center">
                      <div className="luxe-sub mb-1 truncate">{p.category || "Oasis Baklawa"}</div>
                      <div className="luxe-title break-words">{p.product_name}</div>
                      <div className="text-[10px] font-mono text-muted-foreground mt-1">{p.sku}</div>
                      {p.short_description && <p className="text-xs mt-2 text-muted-foreground line-clamp-3">{p.short_description}</p>}
                      <div className="text-[11px] text-muted-foreground mt-2 space-y-0.5">
                        {p.pack_size && <div>Pack · {p.pack_size}</div>}
                        {p.shelf_life_days && <div>Shelf life · {p.shelf_life_days} days</div>}
                      </div>
                      {showPrice && p.mrp && <div className="font-display text-lg text-accent mt-2">₹ {p.mrp}</div>}
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

        <div className="space-y-6 no-print min-w-0">
          <SharePanel url={publicUrl} title={c.title} />
          {canWrite && (
            <div className="luxe-panel">
              <h3 className="luxe-section-title mb-3">Add products</h3>
              <ProductPicker excludeIds={linked.map((l) => l.product_id)} onPick={(p) => addProduct(p.id)} />
            </div>
          )}
          <div className="luxe-panel text-xs text-muted-foreground space-y-2 break-words">
            <div>Slug: <code className="font-mono text-foreground break-all bg-secondary/50 px-1.5 py-0.5 rounded">{c.public_slug}</code></div>
            <div className="capitalize">Type: {c.catalogue_type?.replace(/_/g, " ")}</div>
            <div className="capitalize">Theme: {c.theme?.replace(/_/g, " ")}</div>
            <div className="capitalize">Price: {c.price_visibility}</div>
            {status !== "published" && <div className="text-warning mt-2 p-2 rounded-lg bg-warning/10 border border-warning/20">Public link will return &quot;Catalogue not available&quot; until status is published.</div>}
          </div>
        </div>
      </div>
    </>
  );
};

export default CatalogueDetail;
