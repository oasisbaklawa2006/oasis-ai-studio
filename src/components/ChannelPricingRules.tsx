import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, Wand2, CheckCircle2, Archive } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const PRICE_CHANNELS = [
  "mrp", "retail", "bulk", "wholesale", "horeca", "b2b", "distributor",
  "franchisee", "own_outlet", "export", "private_label", "promotional", "special_customer",
];
const PRICE_TYPES = ["fixed_price", "discount_from_mrp", "margin_based", "quotation_based"];
const STATUSES = ["draft", "needs_review", "approved", "archived"];
const SOURCES = ["catalogue_local", "oasis_central_synced", "manual_override", "promotional", "customer_special"];

const Sel = ({ value, onChange, options, placeholder }: any) => (
  <select className="h-9 px-2 rounded border bg-background text-xs w-full"
    value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
    <option value="">{placeholder ?? "—"}</option>
    {options.map((o: string) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
  </select>
);

const computeCalc = (r: any, mrp?: number | null) => {
  if (r.price_type === "fixed_price") return r.base_price ?? null;
  if (r.price_type === "discount_from_mrp" && mrp && r.discount_percent != null) {
    return Math.round((Number(mrp) * (1 - Number(r.discount_percent) / 100)) * 100) / 100;
  }
  return null;
};

export const ChannelPricingRules = ({ productId, product }: { productId: string; product: any }) => {
  const { roles } = useAuth();
  const canApprove = roles.includes("owner") || roles.includes("admin");
  const [rows, setRows] = useState<any[]>([]);
  const load = async () => {
    const { data } = await supabase.from("product_pricing_rules").select("*")
      .eq("product_id", productId).order("price_channel");
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, [productId]);

  const update = async (id: string, patch: any) => {
    const merged = { ...rows.find((r) => r.id === id), ...patch };
    const calc = computeCalc(merged, product.mrp);
    if (calc != null && merged.price_type !== "fixed_price") patch.calculated_price = calc;
    if (merged.price_type === "fixed_price" && patch.base_price !== undefined) patch.calculated_price = patch.base_price;
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    const { error } = await supabase.from("product_pricing_rules").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  };
  const remove = async (id: string) => { await supabase.from("product_pricing_rules").delete().eq("id", id); load(); };
  const add = async () => {
    const { error } = await supabase.from("product_pricing_rules").insert({
      product_id: productId, price_channel: "retail", price_type: "fixed_price",
    });
    if (error) return toast.error(error.message);
    load();
  };

  const approve = async (id: string) => {
    if (!canApprove) return toast.error("Only owner/admin can approve");
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("product_pricing_rules").update({
      approval_status: "approved", approved_by: u.user?.id, approved_at: new Date().toISOString(),
    }).eq("id", id);
    load();
  };
  const archive = async (id: string) => {
    await supabase.from("product_pricing_rules").update({ approval_status: "archived" }).eq("id", id);
    load();
  };

  const generateDefaults = async () => {
    const mrp = product.mrp;
    const defs: any[] = [];
    const push = (r: any) => defs.push({ product_id: productId, currency: "INR", ...r });

    if (mrp) {
      push({ price_channel: "mrp", price_type: "fixed_price", base_price: mrp, calculated_price: mrp });
      push({ price_channel: "retail", price_type: "fixed_price", base_price: mrp, calculated_price: mrp });
      push({ price_channel: "bulk", price_type: "discount_from_mrp", discount_percent: 20, calculated_price: Math.round(mrp * 0.8 * 100) / 100 });
      push({ price_channel: "wholesale", price_type: "discount_from_mrp", discount_percent: 30, calculated_price: Math.round(mrp * 0.7 * 100) / 100 });
      if (product.b2b_price) push({ price_channel: "b2b", price_type: "fixed_price", base_price: product.b2b_price, calculated_price: product.b2b_price });
      else push({ price_channel: "b2b", price_type: "discount_from_mrp", discount_percent: 30, calculated_price: Math.round(mrp * 0.7 * 100) / 100 });
      if (product.export_price) push({ price_channel: "export", price_type: "fixed_price", base_price: product.export_price, calculated_price: product.export_price, currency: "USD" });
      else push({ price_channel: "export", price_type: "quotation_based" });
    } else {
      ["mrp", "retail", "bulk", "wholesale", "b2b", "export"].forEach((ch) =>
        push({ price_channel: ch, price_type: "quotation_based" }));
    }
    push({ price_channel: "private_label", price_type: "quotation_based",
      notes: product.private_label_cost_per_unit ? `Add ₹${product.private_label_cost_per_unit}/pc label cost; upfront ₹${product.private_label_upfront_cost || 0}` : null });
    push({ price_channel: "franchisee", price_type: "quotation_based" });
    push({ price_channel: "own_outlet", price_type: "quotation_based" });
    push({ price_channel: "horeca", price_type: "quotation_based" });

    const { error } = await supabase.from("product_pricing_rules").upsert(defs, {
      onConflict: "product_id,price_channel", ignoreDuplicates: true,
    } as any);
    if (error) toast.error(error.message);
    else toast.success("Default pricing generated");
    load();
  };

  return (
    <div className="card-elevated p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-xl">Channel pricing rules</h3>
          <p className="text-xs text-muted-foreground">Pricing for catalogue/proposal preparation. Final approved pricing should sync from Oasis Central Pricing Engine in production.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={generateDefaults}><Wand2 className="h-3.5 w-3.5 mr-1" />Generate defaults</Button>
          <Button size="sm" onClick={add}><Plus className="h-3.5 w-3.5 mr-1" />Add price</Button>
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.id} className="rounded-lg border p-3 space-y-2">
            <div className="grid sm:grid-cols-4 gap-2">
              <div><Label className="text-xs">Channel</Label><Sel value={r.price_channel} onChange={(v: string) => update(r.id, { price_channel: v })} options={PRICE_CHANNELS} /></div>
              <div><Label className="text-xs">Price type</Label><Sel value={r.price_type} onChange={(v: string) => update(r.id, { price_type: v })} options={PRICE_TYPES} /></div>
              <div><Label className="text-xs">Status</Label>
                <div className="flex items-center gap-1">
                  <span className={`badge-soft ${r.approval_status === "approved" ? "bg-success/10 text-success" : r.approval_status === "needs_review" ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground"}`}>{r.approval_status}</span>
                </div>
              </div>
              <div><Label className="text-xs">Source</Label><Sel value={r.source} onChange={(v: string) => update(r.id, { source: v })} options={SOURCES} /></div>

              <div><Label className="text-xs">Base price</Label><Input className="h-9" type="number" value={r.base_price ?? ""} onChange={(e) => update(r.id, { base_price: e.target.value ? Number(e.target.value) : null })} /></div>
              <div><Label className="text-xs">Discount %</Label><Input className="h-9" type="number" value={r.discount_percent ?? ""} onChange={(e) => update(r.id, { discount_percent: e.target.value ? Number(e.target.value) : null })} /></div>
              <div><Label className="text-xs">Calculated</Label><Input className="h-9" type="number" value={r.calculated_price ?? ""} onChange={(e) => update(r.id, { calculated_price: e.target.value ? Number(e.target.value) : null })} /></div>
              <div><Label className="text-xs">Currency</Label><Input className="h-9" value={r.currency ?? "INR"} onChange={(e) => update(r.id, { currency: e.target.value })} /></div>

              <div><Label className="text-xs">UOM</Label><Input className="h-9" value={r.uom ?? ""} onChange={(e) => update(r.id, { uom: e.target.value || null })} placeholder="per pc / kg" /></div>
              <div><Label className="text-xs">GST %</Label><Input className="h-9" type="number" value={r.gst_rate ?? ""} onChange={(e) => update(r.id, { gst_rate: e.target.value ? Number(e.target.value) : null })} /></div>
              <div><Label className="text-xs">Valid from</Label><Input className="h-9" type="date" value={r.valid_from ?? ""} onChange={(e) => update(r.id, { valid_from: e.target.value || null })} /></div>
              <div><Label className="text-xs">Valid until</Label><Input className="h-9" type="date" value={r.valid_until ?? ""} onChange={(e) => update(r.id, { valid_until: e.target.value || null })} /></div>

              <div className="flex items-center justify-between sm:col-span-2"><Label className="text-xs">Tax inclusive</Label><Switch checked={!!r.tax_inclusive} onCheckedChange={(v) => update(r.id, { tax_inclusive: v })} /></div>
            </div>
            <div className="flex gap-2 items-end">
              <div className="flex-1"><Label className="text-xs">Notes</Label><Textarea rows={1} value={r.notes ?? ""} onChange={(e) => update(r.id, { notes: e.target.value || null })} /></div>
              <Sel value={r.approval_status} onChange={(v: string) => update(r.id, { approval_status: v })} options={STATUSES} />
              {canApprove && r.approval_status !== "approved" && (
                <Button size="sm" variant="outline" onClick={() => approve(r.id)}><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Approve</Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => archive(r.id)}><Archive className="h-3.5 w-3.5" /></Button>
              <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="text-sm text-muted-foreground py-4 text-center">No pricing rules yet. Add one or generate defaults.</div>}
      </div>
    </div>
  );
};
