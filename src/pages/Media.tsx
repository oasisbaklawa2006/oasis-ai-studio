import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Sparkles, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

const Media = () => {
  const [media, setMedia] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ file_url: "", type: "raw", angle: "front", alt_text: "", product_id: "", status: "raw" });

  const load = async () => {
    const { data } = await supabase.from("product_media").select("*, products(product_name)").order("created_at",{ascending:false});
    setMedia(data ?? []);
  };
  useEffect(() => { load(); supabase.from("products").select("id,product_name").then(({data}) => setProducts(data ?? [])); }, []);

  const add = async () => {
    if (!form.file_url) return toast.error("URL required");
    const payload = { ...form, product_id: form.product_id || null };
    const { error } = await supabase.from("product_media").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Media added");
    setOpen(false);
    setForm({ file_url: "", type: "raw", angle: "front", alt_text: "", product_id: "", status: "raw" });
    load();
  };

  return (
    <>
      <PageHeader title="Media Library" subtitle="Raw, edited, hero, lifestyle, video, label imagery."
        actions={<Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Add Media</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add media asset</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Image / Video URL</Label><Input value={form.file_url} onChange={(e)=>setForm({...form,file_url:e.target.value})} placeholder="https://…" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Type</Label>
                  <select className="w-full h-10 px-3 rounded-md border bg-background text-sm" value={form.type} onChange={(e)=>setForm({...form,type:e.target.value})}>
                    {["raw","edited","hero","white_bg","lifestyle","video","label"].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div><Label>Angle</Label>
                  <select className="w-full h-10 px-3 rounded-md border bg-background text-sm" value={form.angle} onChange={(e)=>setForm({...form,angle:e.target.value})}>
                    {["front","top","side","45","closeup","hamper_open","hamper_closed"].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div><Label>Product (optional)</Label>
                <select className="w-full h-10 px-3 rounded-md border bg-background text-sm" value={form.product_id} onChange={(e)=>setForm({...form,product_id:e.target.value})}>
                  <option value="">— None —</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.product_name}</option>)}
                </select>
              </div>
              <div><Label>Alt text</Label><Input value={form.alt_text} onChange={(e)=>setForm({...form,alt_text:e.target.value})} /></div>
              <Button className="w-full" onClick={add}>Save</Button>
            </div>
          </DialogContent>
        </Dialog>} />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {media.map((m) => (
          <div key={m.id} className="card-elevated overflow-hidden">
            <div className="aspect-square bg-muted flex items-center justify-center">
              {m.type === "video" ? <video src={m.file_url} className="w-full h-full object-cover" /> :
                <img src={m.file_url} alt={m.alt_text || "media"} className="w-full h-full object-cover" onError={(e)=>{(e.target as HTMLImageElement).style.display='none'}} />}
            </div>
            <div className="p-3 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="badge-soft bg-secondary text-secondary-foreground">{m.type}</span>
                <span className="text-muted-foreground">{m.angle}</span>
              </div>
              <div className="text-xs text-muted-foreground truncate">{m.products?.product_name ?? "Unlinked"}</div>
              <div className="flex items-center gap-1 text-[11px] text-accent-foreground/80 bg-accent-soft px-2 py-1 rounded">
                <Sparkles className="h-3 w-3" />Future AI: enhance · BG remove · multi-angle · reel · identify
              </div>
            </div>
          </div>
        ))}
        {media.length === 0 && <div className="col-span-full text-sm text-muted-foreground text-center py-12"><ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />No media yet.</div>}
      </div>
    </>
  );
};

export default Media;
