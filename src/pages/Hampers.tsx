import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Gift, Trash2 } from "lucide-react";
import { toast } from "sonner";

const Hampers = () => {
  const [hampers, setHampers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [items, setItems] = useState<Record<string, any[]>>({});
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const [item, setItem] = useState({ child_product_id: "", component_name: "", quantity: 1, unit: "pc", is_packaging_component: false, is_customer_visible: true });

  const load = async () => {
    const [h, p] = await Promise.all([
      supabase.from("hampers").select("*").order("created_at",{ascending:false}),
      supabase.from("products").select("id,product_name"),
    ]);
    setHampers(h.data ?? []); setProducts(p.data ?? []);
    if (h.data) {
      const all: Record<string, any[]> = {};
      for (const hp of h.data) {
        const { data } = await supabase.from("hamper_items").select("*, products(product_name)").eq("hamper_id", hp.id);
        all[hp.id] = data ?? [];
      }
      setItems(all);
    }
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name) return;
    const { data, error } = await supabase.from("hampers").insert({ name }).select().single();
    if (error) return toast.error(error.message);
    setName(""); setOpen(false); setActive(data.id); load();
  };
  const addItem = async (hamperId: string) => {
    await supabase.from("hamper_items").insert({ ...item, hamper_id: hamperId, child_product_id: item.child_product_id || null });
    setItem({ child_product_id: "", component_name: "", quantity: 1, unit: "pc", is_packaging_component: false, is_customer_visible: true });
    load();
  };
  const delItem = async (id: string) => { await supabase.from("hamper_items").delete().eq("id", id); load(); };

  return (
    <>
      <PageHeader title="Hampers & BOM" subtitle="Treat hampers as parent products with full bill-of-materials."
        actions={<Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />New Hamper</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New hamper</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={name} onChange={(e)=>setName(e.target.value)} /></div>
              <Button className="w-full" onClick={create}>Create</Button>
            </div>
          </DialogContent>
        </Dialog>} />

      <div className="grid lg:grid-cols-2 gap-4">
        {hampers.map((h) => (
          <div key={h.id} className="card-elevated p-5">
            <div className="flex items-center gap-2 mb-3">
              <Gift className="h-5 w-5 text-accent" />
              <div className="font-display text-xl">{h.name}</div>
            </div>
            <div className="space-y-1.5 mb-3">
              {(items[h.id] ?? []).map(it => (
                <div key={it.id} className="flex items-center justify-between text-sm border-l-2 border-accent/40 pl-3 py-1">
                  <div>
                    <span className="font-medium">{it.products?.product_name ?? it.component_name}</span>
                    <span className="text-muted-foreground"> · {it.quantity} {it.unit}</span>
                    {it.is_packaging_component && <span className="badge-soft bg-muted text-muted-foreground ml-2">packaging</span>}
                    {!it.is_customer_visible && <span className="badge-soft bg-muted text-muted-foreground ml-2">internal</span>}
                  </div>
                  <button onClick={()=>delItem(it.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5"/></button>
                </div>
              ))}
              {(items[h.id]?.length ?? 0) === 0 && <div className="text-xs text-muted-foreground py-2">No components yet.</div>}
            </div>
            {active === h.id ? (
              <div className="border-t pt-3 space-y-2">
                <select className="w-full h-9 px-2 rounded border bg-background text-sm" value={item.child_product_id} onChange={(e)=>setItem({...item,child_product_id:e.target.value})}>
                  <option value="">— Custom component —</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.product_name}</option>)}
                </select>
                {!item.child_product_id && <Input placeholder="Component name (e.g. Silk ribbon)" value={item.component_name} onChange={(e)=>setItem({...item,component_name:e.target.value})} />}
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" placeholder="Qty" value={item.quantity} onChange={(e)=>setItem({...item,quantity:Number(e.target.value)})} />
                  <Input placeholder="Unit" value={item.unit} onChange={(e)=>setItem({...item,unit:e.target.value})} />
                </div>
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={item.is_packaging_component} onChange={(e)=>setItem({...item,is_packaging_component:e.target.checked})} />Packaging component</label>
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={item.is_customer_visible} onChange={(e)=>setItem({...item,is_customer_visible:e.target.checked})} />Customer visible</label>
                <div className="flex gap-2">
                  <Button size="sm" onClick={()=>addItem(h.id)}>Add</Button>
                  <Button size="sm" variant="ghost" onClick={()=>setActive(null)}>Done</Button>
                </div>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={()=>setActive(h.id)}><Plus className="h-4 w-4 mr-1" />Add component</Button>
            )}
          </div>
        ))}
        {hampers.length === 0 && <div className="col-span-full text-center text-sm text-muted-foreground py-12">No hampers yet.</div>}
      </div>
    </>
  );
};

export default Hampers;
