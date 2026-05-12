import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ChevronDown, Copy, Power, Wand2 } from "lucide-react";

const UOMS = ["kg", "grams", "pcs", "box", "carton", "master_carton", "tray", "pack", "bundle"];

const Sel = ({ value, onChange, options, placeholder }: any) => (
  <select className="h-9 px-2 rounded border bg-background text-xs w-full" value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
    <option value="">{placeholder ?? "—"}</option>
    {options.map((o: string) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
  </select>
);

const TEMPLATES: Record<string, any[]> = {
  bulk_wholesale: [
    { channel: "distributor", moq_applicable: true, moq_value: 5, moq_uom: "kg", increment_value: 1, increment_uom: "kg" },
    { channel: "export", moq_applicable: true, moq_value: 25, moq_uom: "kg", increment_value: 5, increment_uom: "kg" },
  ],
  ready_pack_retail: [
    { channel: "distributor", moq_applicable: true, moq_value: 1, moq_uom: "master_carton" },
    { channel: "modern_trade", moq_applicable: true, moq_value: 2, moq_uom: "master_carton" },
    { channel: "retail", moq_applicable: false },
  ],
  premium_gift_pack: [
    { channel: "distributor", moq_applicable: true, moq_value: 6, moq_uom: "pcs" },
    { channel: "corporate", moq_applicable: true, moq_value: 25, moq_uom: "pcs" },
    { channel: "export", moq_applicable: true, moq_value: 50, moq_uom: "pcs" },
  ],
  horeca_flexible: [{ channel: "horeca", moq_applicable: true, allow_override: true, notes: "Flexible" }],
  export_carton: [{ channel: "export", moq_applicable: true, moq_value: 10, moq_uom: "carton" }],
  packaging_material: [{ channel: "distributor", moq_applicable: true, moq_value: 1, moq_uom: "bundle" }],
  frozen_semi_processed: [
    { channel: "distributor", moq_applicable: true, moq_value: 1, moq_uom: "carton" },
    { channel: "export", moq_applicable: true, moq_value: 10, moq_uom: "carton" },
  ],
};

const asNumberOrNull = (v: unknown) => (v === "" || v === undefined || v === null ? null : Number(v));

export const ChannelMoqRules = ({ productId, product }: { productId: string; product: any }) => {
  const [rows, setRows] = useState<any[]>([]);
  const [showAdvanced, setShowAdvanced] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<Record<string, boolean>>({});

  const suggestedTemplate = useMemo(() => {
    if (product.product_class === "ready_pack") return "ready_pack_retail";
    if (product.product_class === "gift_hamper") return "premium_gift_pack";
    if (product.main_department === "third_party_goods_store") return "packaging_material";
    return "";
  }, [product.product_class, product.main_department]);

  const load = async () => {
    const { data } = await supabase.from("product_moq_rules").select("*").eq("product_id", productId).order("channel");
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, [productId]);

  const normalize = (row: any) => {
    const out = { ...row };
    out.moq_value = asNumberOrNull(out.moq_value);
    out.increment_value = asNumberOrNull(out.increment_value);
    out.min_carton_qty = asNumberOrNull(out.min_carton_qty);
    if (!out.moq_applicable) Object.assign(out, { moq_value: null, moq_uom: null, increment_value: null, increment_uom: null, min_carton_qty: null, carton_logic: null });
    return out;
  };

  const hasDup = (id: string, channel: string) => rows.some((r) => r.id !== id && r.channel === channel && r.product_id === productId);

  const update = async (id: string, patch: any) => {
    const merged = normalize({ ...rows.find((r) => r.id === id), ...patch });
    if (hasDup(id, merged.channel)) return toast.error("Please remove duplicate channel rule.");
    if (["moq_value", "increment_value", "min_carton_qty"].some((k) => patch[k] === "" || patch[k] === undefined)) {
      toast.message("Numeric fields cannot be blank. They will be saved as empty.");
    }
    setRows((r) => r.map((x) => (x.id === id ? merged : x)));
    const { error } = await supabase.from("product_moq_rules").update(normalize(patch)).eq("id", id);
    if (error) toast.error("Please remove duplicate channel rule.");
  };

  const generateBusinessRules = async (template: string) => {
    if (!template) return;
    const defs = (TEMPLATES[template] ?? []).map((r) => normalize({ product_id: productId, ...r }));
    const { error } = await supabase.from("product_moq_rules").upsert(defs, { onConflict: "product_id,channel,customer_type", ignoreDuplicates: true } as any);
    if (error) toast.error(error.message);
    else toast.success("Business rules generated");
    load();
  };

  return <div className="card-elevated p-6 space-y-4">
    <div className="flex items-center justify-between">
      <div><h3 className="font-display text-xl">Sales MOQ Rules</h3></div>
      <div className="flex items-center gap-2">
        <Sel value={suggestedTemplate} onChange={generateBusinessRules} options={Object.keys(TEMPLATES)} placeholder="Generate Business Rules" />
        <Button size="sm" variant="outline" onClick={() => generateBusinessRules(suggestedTemplate || "bulk_wholesale")}><Wand2 className="h-3.5 w-3.5 mr-1" />Generate Business Rules</Button>
      </div>
    </div>
    <div className="rounded-xl border bg-muted/20 p-4 text-sm"><b>BUSINESS SUMMARY</b>{rows.map((r) => <div key={r.id}>{r.channel}: {r.moq_applicable ? `${r.moq_value ?? "Flexible"} ${r.moq_uom ?? ""}` : "Not Available"}</div>)}</div>
    <div className="grid gap-3">
      {rows.map((r) => <div key={r.id} className="rounded-xl bg-white shadow-sm border border-teal-100 p-4 space-y-3">
        <div className="flex items-start justify-between"><div className="font-semibold text-base">{(r.channel || "channel").replace(/_/g, " ")}</div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setEditing((s) => ({ ...s, [r.id]: !s[r.id] }))}>{editing[r.id] ? "Close" : "Edit"}</Button><Button size="sm" variant="ghost" onClick={() => update(r.id, { channel: `${r.channel}_copy` })}><Copy className="h-3 w-3 mr-1" />Duplicate</Button><Button size="sm" variant="ghost" onClick={() => update(r.id, { moq_applicable: false })}><Power className="h-3 w-3 mr-1" />Disable</Button></div></div>
        <div className="text-sm text-muted-foreground">MOQ: {r.moq_applicable ? `${r.moq_value ?? "Flexible"} ${r.moq_uom ?? ""}` : "Not Available"}</div>
        <div className="text-sm text-muted-foreground">Increment: {r.increment_value ?? "-"} {r.increment_uom ?? ""}</div>
        {editing[r.id] && <div className="grid sm:grid-cols-5 gap-2">
          <div><Label className="text-xs">MOQ value</Label><Input className="h-9" value={r.moq_value ?? ""} onChange={(e) => update(r.id, { moq_value: e.target.value })} /></div>
          <div><Label className="text-xs">MOQ UOM</Label><Sel value={r.moq_uom} onChange={(v: string) => update(r.id, { moq_uom: v })} options={UOMS} /></div>
          <div><Label className="text-xs">Increment value</Label><Input className="h-9" value={r.increment_value ?? ""} onChange={(e) => update(r.id, { increment_value: e.target.value })} /></div>
          <div><Label className="text-xs">Increment UOM</Label><Sel value={r.increment_uom} onChange={(v: string) => update(r.id, { increment_uom: v })} options={UOMS} /></div>
          <div className="flex items-center justify-between"><Label className="text-xs">MOQ applicable</Label><Switch checked={!!r.moq_applicable} onCheckedChange={(v) => update(r.id, { moq_applicable: v })} /></div>
        </div>}
        {editing[r.id] && <Button size="sm" variant="outline" onClick={() => setShowAdvanced((s) => ({ ...s, [r.id]: !s[r.id] }))}><ChevronDown className="h-3 w-3 mr-1" />Advanced Settings</Button>}
        {editing[r.id] && showAdvanced[r.id] && <div className="grid sm:grid-cols-2 gap-2 rounded-lg border p-3">
          <div><Label className="text-xs">Customer type</Label><Input className="h-9" value={r.customer_type ?? ""} onChange={(e) => update(r.id, { customer_type: e.target.value || null })} /></div>
          <div><Label className="text-xs">Allow override</Label><Switch checked={!!r.allow_override} onCheckedChange={(v) => update(r.id, { allow_override: v })} /></div>
          <div><Label className="text-xs">Carton logic</Label><Input className="h-9" value={r.carton_logic ?? ""} onChange={(e) => update(r.id, { carton_logic: e.target.value || null })} /></div>
          <div><Label className="text-xs">Notes</Label><Textarea rows={1} value={r.notes ?? ""} onChange={(e) => update(r.id, { notes: e.target.value || null })} /></div>
        </div>}
      </div>)}
    </div>
  </div>;
};
