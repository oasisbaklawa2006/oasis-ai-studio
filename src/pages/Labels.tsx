import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ProductPicker } from "@/components/ProductPicker";

const STATUSES = ["draft","needs_review","approved","locked"];

const Labels = () => {
  const [pid, setPid] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [product, setProduct] = useState<any>(null);
  const [label, setLabel] = useState<any>({});
  const [ings, setIngs] = useState<any[]>([]);
  const [nutri, setNutri] = useState<any>(null);

  useEffect(() => {
    supabase.from("products").select("id").order("created_at").limit(1).maybeSingle().then(({ data }) => {
      if (data && !pid) setPid(data.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!pid) return;
    (async () => {
      const [p, l, i, n] = await Promise.all([
        supabase.from("products").select("*").eq("id",pid).single(),
        supabase.from("labels").select("*").eq("product_id",pid).maybeSingle(),
        supabase.from("product_ingredients").select("ingredients(name,allergen_group)").eq("product_id",pid),
        supabase.from("nutrition_panels").select("*").eq("product_id",pid).maybeSingle(),
      ]);
      setProduct(p.data);
      setLabel(l.data ?? { product_id: pid, status: "draft", country_of_origin: "India" });
      setIngs(i.data ?? []);
      setNutri(n.data);
    })();
  }, [pid]);

  const save = async () => {
    const payload = { ...label, product_id: pid };
    delete payload.id;
    const { error } = await supabase.from("labels").upsert(payload, { onConflict: "product_id" });
    if (error) return toast.error(error.message);
    await supabase.from("products").update({ label_status: label.status }).eq("id", pid);
    toast.success("Label saved");
  };

  const set = (k: string, v: any) => setLabel({...label, [k]: v});

  return (
    <>
      <PageHeader title="Label Studio" subtitle="Prepare label data and a draft preview for sticker printing."
        actions={
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline">{product?.product_name ?? "Pick product…"}</Button>
            </PopoverTrigger>
            <PopoverContent className="w-96 p-3" align="end">
              <ProductPicker onPick={(p) => { setPid(p.id); setPickerOpen(false); }} />
            </PopoverContent>
          </Popover>
        } />

      <div className="flex items-start gap-2 bg-warning/10 text-warning text-sm p-3 rounded mb-6">
        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
        AI/system-generated label data must be reviewed by an authorized human before printing or publishing.
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="card-elevated p-6 space-y-4">
          <h3 className="font-display text-xl">Label data</h3>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Net quantity</Label><Input value={label.net_quantity ?? ""} onChange={(e)=>set("net_quantity",e.target.value)} /></div>
            <div><Label className="text-xs">MRP</Label><Input type="number" value={label.mrp ?? ""} onChange={(e)=>set("mrp",e.target.value === "" ? null : Number(e.target.value))} /></div>
            <div><Label className="text-xs">Batch No</Label><Input value={label.batch_no ?? ""} onChange={(e)=>set("batch_no",e.target.value)} /></div>
            <div><Label className="text-xs">Mfg date</Label><Input type="date" value={label.mfg_date ?? ""} onChange={(e)=>set("mfg_date",e.target.value)} /></div>
            <div><Label className="text-xs">Best before</Label><Input value={label.best_before ?? ""} onChange={(e)=>set("best_before",e.target.value)} placeholder="e.g. 90 days" /></div>
            <div><Label className="text-xs">FSSAI license</Label><Input value={label.fssai_license ?? ""} onChange={(e)=>set("fssai_license",e.target.value)} /></div>
            <div className="col-span-2"><Label className="text-xs">Manufacturer</Label><Input value={label.manufacturer ?? ""} onChange={(e)=>set("manufacturer",e.target.value)} /></div>
            <div className="col-span-2"><Label className="text-xs">Customer care</Label><Input value={label.customer_care ?? ""} onChange={(e)=>set("customer_care",e.target.value)} /></div>
            <div><Label className="text-xs">Barcode</Label><Input value={label.barcode ?? ""} onChange={(e)=>set("barcode",e.target.value)} /></div>
            <div><Label className="text-xs">Country of origin</Label><Input value={label.country_of_origin ?? ""} onChange={(e)=>set("country_of_origin",e.target.value)} /></div>
            <div className="col-span-2"><Label className="text-xs">Status</Label>
              <select className="w-full h-10 px-3 rounded border bg-background text-sm" value={label.status ?? "draft"} onChange={(e)=>set("status",e.target.value)}>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <Button onClick={save} className="w-full">Save label data</Button>
        </div>

        {/* Preview */}
        <div className="card-elevated p-6 bg-secondary/30">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Label draft preview</div>
          {product && (
            <div className="bg-card border-2 border-foreground/80 p-5 rounded-md font-mono text-xs leading-relaxed">
              <div className="font-display text-2xl text-center mb-2">{product.product_name}</div>
              <div className="border-t border-b py-2 my-2 text-center">🌱 VEG</div>
              <div className="grid grid-cols-2 gap-2">
                <div><strong>Net Qty:</strong> {label.net_quantity ?? "—"}</div>
                <div><strong>MRP:</strong> ₹{label.mrp ?? "—"}</div>
                <div><strong>Batch:</strong> {label.batch_no ?? "—"}</div>
                <div><strong>Mfg:</strong> {label.mfg_date ?? "—"}</div>
                <div><strong>Best before:</strong> {label.best_before ?? "—"}</div>
                <div><strong>FSSAI:</strong> {label.fssai_license ?? "—"}</div>
              </div>
              <div className="mt-2"><strong>Ingredients:</strong> {ings.length ? ings.map(i=>i.ingredients.name).join(", ") : "—"}</div>
              <div className="mt-1"><strong>Allergens:</strong> {[...new Set(ings.map(i=>i.ingredients.allergen_group).filter(Boolean))].join(", ") || "—"}</div>
              <div className="mt-1"><strong>Storage:</strong> {product.storage_instructions ?? "—"}</div>
              <div className="mt-1"><strong>Origin:</strong> {label.country_of_origin ?? "—"}</div>
              {nutri && <div className="mt-2 border-t pt-2">
                <strong>Nutrition (per {nutri.serving_size ?? "100g"}):</strong>
                <div className="grid grid-cols-2 gap-x-3">
                  <div>Energy: {nutri.energy_kcal ?? "—"} kcal</div>
                  <div>Protein: {nutri.protein_g ?? "—"} g</div>
                  <div>Carbs: {nutri.carbohydrate_g ?? "—"} g</div>
                  <div>Fat: {nutri.total_fat_g ?? "—"} g</div>
                </div>
              </div>}
              <div className="mt-2 text-center">{label.manufacturer ?? "Manufacturer details"}</div>
              <div className="text-center">{label.customer_care ?? "Customer care"}</div>
              <div className="text-center mt-1">| | || |||| | || ||| | {label.barcode ?? ""}</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Labels;
