import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ChevronDown, Copy, Power } from "lucide-react";

const PRICE_TYPES = ["fixed_price", "discount_from_mrp", "margin_based", "quotation_based"];
const asNumberOrNull = (v: unknown) => (v === "" || v === undefined || v === null ? null : Number(v));
const pricingLabel = (r: any) => (r.price_type === "discount_from_mrp" ? `MRP - ${r.discount_percent ?? 0}%` : r.price_type.replace(/_/g, " "));

export const ChannelPricingRules = ({ productId, product }: { productId: string; product: any }) => {
  const [rows, setRows] = useState<any[]>([]);
  const [adv, setAdv] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const load = async () => {
    const { data } = await supabase.from("product_pricing_rules").select("*").eq("product_id", productId).order("price_channel");
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, [productId]);

  const normalize = (row: any) => {
    const out = { ...row };
    out.base_price = asNumberOrNull(out.base_price);
    out.discount_percent = asNumberOrNull(out.discount_percent);
    out.calculated_price = asNumberOrNull(out.calculated_price);
    out.gst_rate = asNumberOrNull(out.gst_rate);
    if (out.price_type === "quotation_based") Object.assign(out, { base_price: null, discount_percent: null, calculated_price: null });
    if (out.price_type === "discount_from_mrp") {
      out.calculated_price = product.mrp && out.discount_percent != null ? Math.round(Number(product.mrp) * (1 - Number(out.discount_percent) / 100) * 100) / 100 : null;
    }
    if (out.price_type === "fixed_price") out.calculated_price = out.base_price;
    return out;
  };

  const dup = (id: string, channel: string) => rows.some((r) => r.id !== id && r.price_channel === channel && r.product_id === productId);

  const update = async (id: string, patch: any) => {
    const merged = normalize({ ...rows.find((r) => r.id === id), ...patch });
    if (dup(id, merged.price_channel)) return toast.error("Please remove duplicate channel rule.");
    if (["base_price", "discount_percent", "calculated_price", "gst_rate"].some((k) => patch[k] === "" || patch[k] === undefined)) {
      toast.message("Numeric fields cannot be blank. They will be saved as empty.");
    }
    setRows((r) => r.map((x) => (x.id === id ? merged : x)));
    const { error } = await supabase.from("product_pricing_rules").update(normalize(patch)).eq("id", id);
    if (error) toast.error("Please remove duplicate channel rule.");
  };

  const summary = useMemo(() => rows.map((r) => `${r.price_channel}: ${pricingLabel(r)}`), [rows]);

  return <div className="card-elevated p-6 space-y-4">
    <div><h3 className="font-display text-xl">Sales Pricing Rules</h3></div>
    <div className="rounded-xl border bg-muted/20 p-4 text-sm"><b>BUSINESS SUMMARY</b>{summary.map((s, i) => <div key={i}>{s}</div>)}</div>
    <div className="space-y-3">
      {rows.map((r) => <div key={r.id} className="rounded-xl bg-white shadow-sm border border-amber-100 p-4 space-y-3">
        <div className="flex justify-between"><div className="font-semibold">{(r.price_channel || "channel").replace(/_/g, " ")}</div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setEditing((a) => ({ ...a, [r.id]: !a[r.id] }))}>{editing[r.id] ? "Close" : "Edit"}</Button><Button size="sm" variant="ghost" onClick={() => update(r.id, { price_channel: `${r.price_channel}_copy` })}><Copy className="h-3 w-3 mr-1" />Duplicate</Button><Button size="sm" variant="ghost" onClick={() => update(r.id, { price_type: "quotation_based" })}><Power className="h-3 w-3 mr-1" />Disable</Button></div></div>
        <div className="text-sm text-muted-foreground">Pricing: {pricingLabel(r)}</div>
        {editing[r.id] && <div className="grid sm:grid-cols-5 gap-2">
          <div><Label className="text-xs">Pricing label</Label><Input className="h-9" value={pricingLabel(r)} readOnly /></div>
          <div><Label className="text-xs">Price type</Label><select className="h-9 px-2 rounded border bg-background text-xs w-full" value={r.price_type ?? ""} onChange={(e) => update(r.id, { price_type: e.target.value })}>{PRICE_TYPES.map((o) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}</select></div>
          <div><Label className="text-xs">Base price</Label><Input className="h-9" value={r.base_price ?? ""} readOnly={r.price_type !== "fixed_price"} onChange={(e) => update(r.id, { base_price: e.target.value })} /></div>
          <div><Label className="text-xs">Discount %</Label><Input className="h-9" value={r.discount_percent ?? ""} onChange={(e) => update(r.id, { discount_percent: e.target.value })} /></div>
          <div><Label className="text-xs">Calculated price</Label><Input className="h-9" value={r.calculated_price ?? ""} readOnly={r.price_type === "discount_from_mrp" || r.price_type === "quotation_based"} onChange={(e) => update(r.id, { calculated_price: e.target.value })} /></div>
        </div>}
        {editing[r.id] && <Button size="sm" variant="outline" onClick={() => setAdv((a) => ({ ...a, [r.id]: !a[r.id] }))}><ChevronDown className="h-3 w-3 mr-1" />Advanced Settings</Button>}
        {editing[r.id] && adv[r.id] && <div className="grid sm:grid-cols-2 gap-2 rounded-lg border p-3"><div><Label className="text-xs">Source</Label><Input className="h-9" value={r.source ?? ""} onChange={(e) => update(r.id, { source: e.target.value || null })} /></div><div><Label className="text-xs">Approval status</Label><Input className="h-9" value={r.approval_status ?? "draft"} onChange={(e) => update(r.id, { approval_status: e.target.value || null })} /></div><div><Label className="text-xs">GST %</Label><Input className="h-9" value={r.gst_rate ?? ""} onChange={(e) => update(r.id, { gst_rate: e.target.value })} /></div><div><Label className="text-xs">Notes</Label><Textarea rows={1} value={r.notes ?? ""} onChange={(e) => update(r.id, { notes: e.target.value || null })} /></div></div>}
      </div>)}
    </div>
  </div>;
};
