import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, ExternalLink, BookOpen } from "lucide-react";
import { toast } from "sonner";

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"").slice(0,60) + "-" + Math.random().toString(36).slice(2,6);

const statusClass = (status: string) => {
  if (status === "published") return "catalogue-status-published";
  if (status === "internal_review") return "catalogue-status-review";
  if (status === "archived") return "catalogue-status-archived";
  return "catalogue-status-draft";
};

const Catalogues = () => {
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", subtitle: "", client_name: "", catalogue_type: "general", theme: "classic_white", price_visibility: "hidden" });

  const load = () => supabase.from("catalogues").select("*").order("created_at",{ascending:false}).then(({data}) => setItems(data ?? []));
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.title) return toast.error("Title required");
    const { data, error } = await supabase.from("catalogues").insert({ ...form, public_slug: slugify(form.title) }).select().single();
    if (error) return toast.error(error.message);
    toast.success("Catalogue created");
    setOpen(false);
    window.location.href = `/catalogues/${data.id}`;
  };

  return (
    <>
      <PageHeader title="Catalogues" subtitle="Curate, theme, and share branded luxury catalogues with clients."
        actions={<Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="rounded-full"><Plus className="h-4 w-4 mr-1" />New Catalogue</Button></DialogTrigger>
          <DialogContent className="sm:max-w-md border-border/80">
            <DialogHeader><DialogTitle className="font-display text-2xl">Create catalogue</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Title</Label><Input value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})} /></div>
              <div><Label>Subtitle</Label><Input value={form.subtitle} onChange={(e)=>setForm({...form,subtitle:e.target.value})} /></div>
              <div><Label>Client name (optional)</Label><Input value={form.client_name} onChange={(e)=>setForm({...form,client_name:e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Type</Label>
                  <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" value={form.catalogue_type} onChange={(e)=>setForm({...form,catalogue_type:e.target.value})}>
                    {["general","client_specific","festival","export","wedding","corporate","whatsapp_mini","b2c_gifting"].map(t=> <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div><Label>Theme</Label>
                  <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" value={form.theme} onChange={(e)=>setForm({...form,theme:e.target.value})}>
                    {["classic_white","deep_teal_luxury","festive_gold","export_minimal"].map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div><Label>Price visibility</Label>
                <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" value={form.price_visibility} onChange={(e)=>setForm({...form,price_visibility:e.target.value})}>
                  {["hidden","visible","inquiry","client_specific"].map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
              <Button className="w-full rounded-full" onClick={create}>Create</Button>
            </div>
          </DialogContent>
        </Dialog>} />

      {items.length === 0 ? (
        <div className="catalogue-empty">
          <BookOpen className="h-10 w-10 mx-auto text-accent/60 mb-4" strokeWidth={1.25} />
          <h2 className="catalogue-empty-title">No catalogues yet</h2>
          <p className="catalogue-empty-text mb-6">Create your first branded catalogue to share with clients, festivals, or corporate gifting.</p>
          <Button className="rounded-full" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />New Catalogue</Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {items.map((c) => {
            const status = c.status ?? (c.is_published ? "published" : "draft");
            return (
              <div key={c.id} className="catalogue-list-card">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <div className="font-display text-xl sm:text-2xl truncate text-foreground">{c.title}</div>
                    {c.subtitle && <div className="text-sm text-muted-foreground truncate mt-0.5">{c.subtitle}</div>}
                  </div>
                  <span className={`badge-soft capitalize shrink-0 ${statusClass(status)}`}>{status.replace(/_/g, " ")}</span>
                </div>
                {c.client_name && (
                  <div className="text-xs text-muted-foreground mb-2">
                    For <span className="font-medium text-foreground">{c.client_name}</span>
                  </div>
                )}
                <div className="text-xs text-muted-foreground capitalize mb-5 flex-1">
                  {c.catalogue_type?.replace(/_/g, " ")} · {c.theme?.replace(/_/g, " ")}
                </div>
                <div className="flex gap-2 pt-2 border-t border-border/50">
                  <Button asChild size="sm" variant="outline" className="flex-1 rounded-full border-primary/20">
                    <Link to={`/catalogues/${c.id}`}>Manage</Link>
                  </Button>
                  {c.public_slug && status === "published" && (
                    <Button asChild size="sm" variant="ghost" className="rounded-full">
                      <a href={`/c/${c.public_slug}`} target="_blank" rel="noreferrer" aria-label="Open public catalogue">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};

export default Catalogues;
