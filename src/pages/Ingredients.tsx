import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const Ingredients = () => {
  const [ings, setIngs] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [pid, setPid] = useState<string>("");
  const [pIngs, setPIngs] = useState<any[]>([]);
  const [nutri, setNutri] = useState<any | null>(null);
  const [name, setName] = useState("");

  const loadIngs = () => supabase.from("ingredients").select("*").order("name").then(({data})=>setIngs(data ?? []));
  useEffect(() => {
    loadIngs();
    supabase.from("products").select("id,product_name").then(({data})=> { setProducts(data ?? []); if (data?.[0]) setPid(data[0].id); });
  }, []);

  useEffect(() => {
    if (!pid) return;
    supabase.from("product_ingredients").select("*, ingredients(name,allergen_group)").eq("product_id", pid).order("display_order").then(({data})=>setPIngs(data ?? []));
    supabase.from("nutrition_panels").select("*").eq("product_id", pid).maybeSingle().then(({data})=>setNutri(data ?? { product_id: pid, needs_review: true }));
  }, [pid]);

  const addIngredient = async () => {
    if (!name) return;
    const { error } = await supabase.from("ingredients").insert({ name });
    if (error) return toast.error(error.message);
    setName(""); loadIngs();
  };
  const linkIngredient = async (ingId: string) => {
    await supabase.from("product_ingredients").insert({ product_id: pid, ingredient_id: ingId, display_order: pIngs.length });
    const { data } = await supabase.from("product_ingredients").select("*, ingredients(name,allergen_group)").eq("product_id", pid).order("display_order");
    setPIngs(data ?? []);
  };
  const unlink = async (id: string) => { await supabase.from("product_ingredients").delete().eq("id", id); setPIngs(pIngs.filter(p=>p.id!==id)); };

  const saveNutrition = async () => {
    const payload: any = { ...nutri, product_id: pid };
    delete payload.id;
    const { error } = await supabase.from("nutrition_panels").upsert(payload, { onConflict: "product_id" });
    if (error) return toast.error(error.message);
    toast.success("Nutrition saved");
  };

  const numField = (k: string, label: string) => (
    <div><Label className="text-xs">{label}</Label><Input type="number" step="0.01" value={nutri?.[k] ?? ""} onChange={(e)=>setNutri({...nutri,[k]:e.target.value === "" ? null : Number(e.target.value)})} /></div>
  );

  return (
    <>
      <PageHeader title="Ingredients & Nutrition" subtitle="Master ingredient records, recipe links, and panel data per product." />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="card-elevated p-5">
          <h3 className="font-display text-xl mb-3">Ingredient master</h3>
          <div className="flex gap-2 mb-3"><Input value={name} onChange={(e)=>setName(e.target.value)} placeholder="New ingredient" /><Button onClick={addIngredient}><Plus className="h-4 w-4"/></Button></div>
          <div className="space-y-1 max-h-72 overflow-auto">
            {ings.map(i => (
              <button key={i.id} onClick={()=>linkIngredient(i.id)} className="w-full text-left p-2 text-sm rounded hover:bg-muted flex justify-between">
                <span>{i.name}</span>
                {i.allergen_group && <span className="badge-soft bg-warning/10 text-warning">{i.allergen_group}</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="card-elevated p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-xl">Recipe</h3>
              <select className="h-9 px-2 rounded border bg-background text-sm" value={pid} onChange={(e)=>setPid(e.target.value)}>
                {products.map(p => <option key={p.id} value={p.id}>{p.product_name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              {pIngs.map(pi => (
                <div key={pi.id} className="flex items-center justify-between p-2 border rounded">
                  <span className="text-sm">{pi.ingredients?.name}</span>
                  <button onClick={()=>unlink(pi.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5"/></button>
                </div>
              ))}
              {pIngs.length === 0 && <div className="text-xs text-muted-foreground py-2">Click an ingredient on the left to link it.</div>}
            </div>
          </div>

          <div className="card-elevated p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-xl">Nutrition panel</h3>
              <Button size="sm" onClick={saveNutrition}>Save</Button>
            </div>
            <div className="flex items-start gap-2 bg-warning/10 text-warning text-xs p-3 rounded mb-4">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              Nutrition data must be verified by an authorized human before label printing or publishing.
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div><Label className="text-xs">Serving size</Label><Input value={nutri?.serving_size ?? ""} onChange={(e)=>setNutri({...nutri,serving_size:e.target.value})} /></div>
              {numField("energy_kcal","Energy (kcal)")}
              {numField("protein_g","Protein (g)")}
              {numField("carbohydrate_g","Carbs (g)")}
              {numField("total_sugar_g","Total sugar (g)")}
              {numField("added_sugar_g","Added sugar (g)")}
              {numField("total_fat_g","Total fat (g)")}
              {numField("saturated_fat_g","Saturated fat (g)")}
              {numField("trans_fat_g","Trans fat (g)")}
              {numField("sodium_mg","Sodium (mg)")}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Ingredients;
