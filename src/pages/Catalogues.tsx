import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"").slice(0,60) + "-" + Math.random().toString(36).slice(2,6);

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
      <PageHeader title="Catalogues" subtitle="Curate, theme, and share branded catalogues with clients."
        actions={<Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />New Catalogue</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create catalogue</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Title</Label><Input value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})} /></div>
              <div><Label>Subtitle</Label><Input value={form.subtitle} onChange={(e)=>setForm({...form,subtitle:e.target.value})} /></div>
              <div><Label>Client name (optional)</Label><Input value={form.client_name} onChange={(e)=>setForm({...form,client_name:e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Type</Label>
                  <select className="w-full h-10 px-3 rounded-md border bg-background text-sm" value={form.catalogue_type} onChange={(e)=>setForm({...form,catalogue_type:e.target.value})}>
                    {["general","client_specific","festival","export","wedding","corporate","whatsapp_mini","b2c_gifting"].map(t=> <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div><Label>Theme</Label>
                  <select className="w-full h-10 px-3 rounded-md border bg-background text-sm" value={form.theme} onChange={(e)=>setForm({...form,theme:e.target.value})}>
                    {["classic_white","deep_teal_luxury","festive_gold","export_minimal"].map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div><Label>Price visibility</Label>
                <select className="w-full h-10 px-3 rounded-md border bg-background text-sm" value={form.price_visibility} onChange={(e)=>setForm({...form,price_visibility:e.target.value})}>
                  {["hidden","visible","inquiry","client_specific"].map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
              <Button className="w-full" onClick={create}>Create</Button>
            </div>
          </DialogContent>
        </Dialog>} />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((c) => (
          <div key={c.id} className="card-elevated p-5">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <div className="font-display text-xl">{c.title}</div>
                <div className="text-xs text-muted-foreground">{c.subtitle}</div>
              </div>
              <span className={`badge-soft ${c.is_published ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>{c.is_published ? "Live" : "Draft"}</span>
            </div>
            {c.client_name && <div className="text-xs mb-2">For: <span className="font-medium">{c.client_name}</span></div>}
            <div className="text-xs text-muted-foreground capitalize mb-4">{c.catalogue_type.replace(/_/g," ")} · {c.theme.replace(/_/g," ")}</div>
            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline" className="flex-1"><Link to={`/catalogues/${c.id}`}>Manage</Link></Button>
              {c.public_slug && <Button asChild size="sm" variant="ghost"><a href={`/c/${c.public_slug}`} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a></Button>}
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="col-span-full text-center text-sm text-muted-foreground py-12">No catalogues yet.</div>}
      </div>
    </>
  );
};

export default Catalogues;
