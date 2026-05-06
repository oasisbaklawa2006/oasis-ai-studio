import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Copy, ExternalLink, Trash2, MessageCircle } from "lucide-react";
import { toast } from "sonner";

const CatalogueDetail = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const [c, setC] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [linked, setLinked] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  const load = async () => {
    const [cat, prods, links] = await Promise.all([
      supabase.from("catalogues").select("*").eq("id", id).single(),
      supabase.from("products").select("id,product_name,sku,category,hero_image_url"),
      supabase.from("catalogue_products").select("*, products(id,product_name,sku,hero_image_url)").eq("catalogue_id", id).order("sort_order"),
    ]);
    setC(cat.data); setProducts(prods.data ?? []); setLinked(links.data ?? []);
  };
  useEffect(() => { load(); }, [id]);

  if (!c) return <div className="text-muted-foreground">Loading…</div>;

  const update = async (patch: any) => { await supabase.from("catalogues").update(patch).eq("id", id); setC({...c, ...patch}); };
  const addProduct = async (pid: string) => {
    if (linked.find(l => l.product_id === pid)) return;
    await supabase.from("catalogue_products").insert({ catalogue_id: id, product_id: pid, sort_order: linked.length });
    load();
  };
  const removeProduct = async (lid: string) => { await supabase.from("catalogue_products").delete().eq("id", lid); load(); };

  const publicUrl = `${window.location.origin}/c/${c.public_slug}`;
  const waText = encodeURIComponent(`Hello! View our latest Oasis catalogue: ${publicUrl}`);

  return (
    <>
      <PageHeader title={c.title} subtitle={c.subtitle ?? "Catalogue editor"}
        actions={<>
          <Button variant="outline" onClick={()=>nav("/catalogues")}>Back</Button>
          <Button variant="outline" onClick={()=>{navigator.clipboard.writeText(publicUrl); toast.success("Link copied")}}><Copy className="h-4 w-4 mr-1"/>Copy link</Button>
          <Button variant="outline" asChild><a href={`https://wa.me/?text=${waText}`} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4 mr-1"/>WhatsApp</a></Button>
          <Button asChild><a href={`/c/${c.public_slug}`} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4 mr-1"/>Preview</a></Button>
        </>} />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card-elevated p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-xl">Products in catalogue ({linked.length})</h3>
            </div>
            <div className="space-y-2">
              {linked.map((l) => (
                <div key={l.id} className="flex items-center gap-3 p-2 rounded-lg border">
                  <div className="h-12 w-12 bg-muted rounded overflow-hidden">
                    {l.products?.hero_image_url && <img src={l.products.hero_image_url} className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{l.products?.product_name}</div>
                    <div className="text-xs text-muted-foreground">{l.products?.sku}</div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={()=>removeProduct(l.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              {linked.length === 0 && <div className="text-sm text-muted-foreground py-4 text-center">Add products from the right panel.</div>}
            </div>
          </div>

          <div className="card-elevated p-5 space-y-4">
            <h3 className="font-display text-xl">Cover & intro</h3>
            <div><Label>Cover image URL</Label><Input value={c.cover_image_url ?? ""} onChange={(e)=>setC({...c,cover_image_url:e.target.value})} onBlur={(e)=>update({cover_image_url:e.target.value})} /></div>
            <div><Label>Intro text</Label><Textarea rows={3} value={c.intro_text ?? ""} onChange={(e)=>setC({...c,intro_text:e.target.value})} onBlur={(e)=>update({intro_text:e.target.value})} /></div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card-elevated p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Label>Published</Label>
              <Switch checked={c.is_published} onCheckedChange={(v)=>update({is_published:v})} />
            </div>
            <div className="text-xs text-muted-foreground">Slug</div>
            <div className="text-sm font-mono bg-muted px-2 py-1 rounded truncate">{c.public_slug}</div>
            <div className="text-xs text-muted-foreground border-t pt-2 capitalize">
              Type: {c.catalogue_type?.replace(/_/g," ")}<br />
              Theme: {c.theme?.replace(/_/g," ")}<br />
              Price: {c.price_visibility}
            </div>
          </div>

          <div className="card-elevated p-5">
            <h3 className="font-display text-lg mb-2">Add products</h3>
            <Input placeholder="Search…" value={search} onChange={(e)=>setSearch(e.target.value)} className="mb-3" />
            <div className="max-h-96 overflow-auto space-y-1">
              {products.filter(p => !linked.find(l=>l.product_id===p.id) && p.product_name.toLowerCase().includes(search.toLowerCase())).map(p => (
                <button key={p.id} onClick={()=>addProduct(p.id)} className="w-full text-left p-2 rounded hover:bg-muted flex items-center gap-2 text-sm">
                  <div className="h-8 w-8 bg-muted rounded overflow-hidden flex-shrink-0">
                    {p.hero_image_url && <img src={p.hero_image_url} className="w-full h-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1 truncate">{p.product_name}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CatalogueDetail;
