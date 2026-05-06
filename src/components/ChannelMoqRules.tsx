import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, Wand2 } from "lucide-react";

const CHANNELS = [
  "retail", "b2c", "b2b", "horeca", "distributor",
  "export", "private_label", "internal_sales", "wedding", "corporate_gifting",
];
const UOMS = ["kg", "grams", "pcs", "box", "carton", "master_carton", "tray", "pack"];

const Sel = ({ value, onChange, options, placeholder }: any) => (
  <select className="h-9 px-2 rounded border bg-background text-xs w-full"
    value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
    <option value="">{placeholder ?? "—"}</option>
    {options.map((o: string) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
  </select>
);

export const ChannelMoqRules = ({ productId, product }: { productId: string; product: any }) => {
  const [rows, setRows] = useState<any[]>([]);
  const load = async () => {
    const { data } = await supabase.from("product_moq_rules").select("*")
      .eq("product_id", productId).order("channel");
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, [productId]);

  const update = async (id: string, patch: any) => {
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    const { error } = await supabase.from("product_moq_rules").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  };
  const remove = async (id: string) => {
    await supabase.from("product_moq_rules").delete().eq("id", id);
    load();
  };
  const add = async () => {
    const { error } = await supabase.from("product_moq_rules").insert({
      product_id: productId, channel: "retail", moq_applicable: false,
    });
    if (error) return toast.error(error.message);
    load();
  };

  const generateDefaults = async () => {
    const cls = product.product_class;
    const defaults: any[] = [];
    const push = (r: any) => defaults.push({ product_id: productId, ...r });

    if (cls === "bulk_loose_product") {
      push({ channel: "retail", moq_applicable: false });
      push({ channel: "b2b", moq_applicable: true, moq_value: 1, moq_uom: product.moq_uom || "master_carton" });
      push({ channel: "export", moq_applicable: true, moq_value: 10, moq_uom: "carton" });
      push({ channel: "internal_sales", moq_applicable: true, allow_override: true });
    } else if (cls === "ready_pack") {
      push({ channel: "retail", moq_applicable: false });
      push({ channel: "b2b", moq_applicable: true, moq_value: 1, moq_uom: "carton" });
      if (product.private_label_allowed) {
        push({ channel: "private_label", moq_applicable: true,
          moq_value: product.private_label_moq || 500,
          moq_uom: product.private_label_moq_uom || "pcs" });
      }
      push({ channel: "corporate_gifting", moq_applicable: true, moq_value: 50, moq_uom: "pcs" });
    } else if (cls === "gift_hamper") {
      push({ channel: "retail", moq_applicable: false });
      push({ channel: "b2c", moq_applicable: false });
      push({ channel: "corporate_gifting", moq_applicable: true, moq_value: 25, moq_uom: "pcs" });
      push({ channel: "wedding", moq_applicable: true, moq_value: 25, moq_uom: "pcs" });
      push({ channel: "b2b", moq_applicable: true, moq_value: 10, moq_uom: "pcs" });
    } else if (cls === "packaging_decoration_material") {
      push({ channel: "b2b", moq_applicable: true, moq_value: product.carton_qty || 1, moq_uom: "carton",
        carton_logic: product.fixed_carton_required ? "Closed carton only" : null });
      push({ channel: "retail", moq_applicable: !!product.fixed_carton_required,
        moq_value: product.carton_qty, moq_uom: product.carton_uom });
    } else {
      push({ channel: "retail", moq_applicable: false });
      push({ channel: "b2b", moq_applicable: true, moq_value: 1, moq_uom: "pcs" });
    }
    // upsert with onConflict
    const { error } = await supabase.from("product_moq_rules").upsert(defaults, {
      onConflict: "product_id,channel,customer_type", ignoreDuplicates: true,
    } as any);
    if (error) toast.error(error.message);
    else toast.success("Default MOQ rules generated");
    load();
  };

  return (
    <div className="card-elevated p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-xl">Channel MOQ rules</h3>
          <p className="text-xs text-muted-foreground">One MOQ rule per sales channel. Used by catalogues and proposals.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={generateDefaults}><Wand2 className="h-3.5 w-3.5 mr-1" />Generate defaults</Button>
          <Button size="sm" onClick={add}><Plus className="h-3.5 w-3.5 mr-1" />Add rule</Button>
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.id} className="rounded-lg border p-3 space-y-2">
            <div className="grid sm:grid-cols-4 gap-2">
              <div><Label className="text-xs">Channel</Label><Sel value={r.channel} onChange={(v: string) => update(r.id, { channel: v })} options={CHANNELS} /></div>
              <div><Label className="text-xs">Customer type</Label><Input className="h-9" value={r.customer_type ?? ""} onChange={(e) => update(r.id, { customer_type: e.target.value || null })} placeholder="optional" /></div>
              <div className="flex items-center justify-between"><Label className="text-xs">MOQ applicable</Label><Switch checked={!!r.moq_applicable} onCheckedChange={(v) => update(r.id, { moq_applicable: v })} /></div>
              <div className="flex items-center justify-between"><Label className="text-xs">Allow override</Label><Switch checked={!!r.allow_override} onCheckedChange={(v) => update(r.id, { allow_override: v })} /></div>
            </div>
            {r.moq_applicable && (
              <div className="grid sm:grid-cols-4 gap-2">
                <div><Label className="text-xs">MOQ value</Label><Input className="h-9" type="number" value={r.moq_value ?? ""} onChange={(e) => update(r.id, { moq_value: e.target.value ? Number(e.target.value) : null })} /></div>
                <div><Label className="text-xs">MOQ UOM</Label><Sel value={r.moq_uom} onChange={(v: string) => update(r.id, { moq_uom: v })} options={UOMS} /></div>
                <div><Label className="text-xs">Increment</Label><Input className="h-9" type="number" value={r.increment_value ?? ""} onChange={(e) => update(r.id, { increment_value: e.target.value ? Number(e.target.value) : null })} /></div>
                <div><Label className="text-xs">Increment UOM</Label><Sel value={r.increment_uom} onChange={(v: string) => update(r.id, { increment_uom: v })} options={UOMS} /></div>
                <div><Label className="text-xs">Min carton qty</Label><Input className="h-9" type="number" value={r.min_carton_qty ?? ""} onChange={(e) => update(r.id, { min_carton_qty: e.target.value ? Number(e.target.value) : null })} /></div>
                <div className="sm:col-span-3"><Label className="text-xs">Carton logic</Label><Input className="h-9" value={r.carton_logic ?? ""} onChange={(e) => update(r.id, { carton_logic: e.target.value || null })} /></div>
              </div>
            )}
            <div className="flex gap-2 items-end">
              <div className="flex-1"><Label className="text-xs">Notes</Label><Textarea rows={1} value={r.notes ?? ""} onChange={(e) => update(r.id, { notes: e.target.value || null })} /></div>
              <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="text-sm text-muted-foreground py-4 text-center">No MOQ rules yet. Add one or generate defaults.</div>}
      </div>
    </div>
  );
};
