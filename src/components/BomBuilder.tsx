import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ProductPicker } from "@/components/ProductPicker";
import { toast } from "sonner";
import { AlertTriangle, Trash2, Plus, X, Eye, EyeOff, Boxes } from "lucide-react";

const COMPONENT_TYPES = [
  { v: "product", label: "Product / Edible" },
  { v: "packaging_material", label: "Packaging material" },
  { v: "decoration", label: "Decoration" },
  { v: "service", label: "Service" },
  { v: "labour", label: "Labour" },
  { v: "note", label: "Note" },
];
const SOURCE_DEPTS = [
  { v: "ready_goods_store", label: "Ready Goods Store" },
  { v: "third_party_goods_store", label: "3rd Party Goods Store" },
  { v: "packing_assembly", label: "Packing & Assembly" },
  { v: "external_vendor", label: "External Vendor" },
  { v: "internal_service", label: "Internal Service" },
];
const PROD_DEPTS = [
  { v: "arabic_sweets", label: "Arabic Sweets" },
  { v: "fusion_sweets", label: "Fusion Sweets" },
  { v: "chocolates_confectionery", label: "Chocolates & Confectionery" },
  { v: "dragees", label: "Dragees" },
  { v: "seasoned_nuts_mixes", label: "Seasoned Nuts & Mixes" },
  { v: "bakery", label: "Bakery" },
];
const ISSUE_TO = [
  { v: "packing_assembly", label: "Packing & Assembly" },
  { v: "ready_goods_store", label: "Ready Goods Store" },
  { v: "third_party_goods_store", label: "3rd Party Goods Store" },
];
const VISIBILITY_SCOPES = [
  { v: "internal_only", label: "Internal only" },
  { v: "customer_visible", label: "Customer visible" },
  { v: "catalogue_visible", label: "Catalogue visible" },
  { v: "label_visible", label: "Label visible" },
];
const UNITS = ["pc", "pcs", "g", "kg", "ml", "litre", "box", "pack", "carton", "roll", "hour"];

const Select = ({ value, onChange, options, placeholder }: any) => (
  <select
    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
    value={value ?? ""}
    onChange={(e) => onChange(e.target.value || null)}
  >
    <option value="">{placeholder ?? "— Select —"}</option>
    {options.map((o: any) =>
      typeof o === "string"
        ? <option key={o} value={o}>{o}</option>
        : <option key={o.v} value={o.v}>{o.label}</option>
    )}
  </select>
);

type Bom = any;

const emptyDraft = (): Bom => ({
  component_type: "product",
  component_name: "",
  child_product_id: null,
  quantity: 1,
  unit: "pc",
  cost_per_unit: "",
  notes: "",
  visibility_scope: "internal_only",
  show_to_customer: false,
  show_in_public_catalogue: false,
  show_in_pdf_catalogue: false,
  show_on_label: false,
  is_individually_saleable: false,
  internal_component_only: true,
  source_department: "",
  production_department: "",
  issue_to_department: "packing_assembly",
  required_before_assembly: true,
  lead_time_days: "",
  stock_check_required: true,
  is_packaging_component: false,
  is_private_label_component: false,
});

interface Props {
  parentId: string;
  productClass?: string | null;
  bomRequired?: boolean;
}

export function BomBuilder({ parentId, productClass, bomRequired }: Props) {
  const [items, setItems] = useState<Bom[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [pickChild, setPickChild] = useState(false);
  const [draft, setDraft] = useState<Bom>(emptyDraft());
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("product_bom_items")
      .select("*")
      .eq("parent_product_id", parentId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) toast.error(error.message);
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => { if (parentId) load(); }, [parentId]);

  const setD = (k: string, v: any) => setDraft((d) => ({ ...d, [k]: v }));

  const onPickChild = async (p: any) => {
    setPickChild(false);
    const { data: full } = await supabase
      .from("products")
      .select("sku,product_name,main_department,production_department,b2b_price_inr,b2b_price,mrp,primary_uom,b2b_uom")
      .eq("id", p.id)
      .maybeSingle();
    const cost = full?.b2b_price_inr ?? full?.b2b_price ?? full?.mrp ?? null;
    const unit = full?.b2b_uom ?? full?.primary_uom ?? "pc";
    setDraft((d) => ({
      ...d,
      child_product_id: p.id,
      component_name: full?.product_name || p.product_name,
      cost_per_unit: cost != null ? String(cost) : d.cost_per_unit,
      unit: unit || d.unit,
      source_department: d.source_department || full?.main_department || "",
      production_department: d.production_department || full?.production_department || "",
    }));
    if (cost == null) toast.warning("No cost/price found for this linked product. Enter cost manually.");
    else toast.success(`Cost auto-filled: ₹${cost}/${unit}`);
  };

  const validateDraft = (): string | null => {
    if (!draft.child_product_id && !draft.component_name?.trim()) return "Component name or product is required";
    if (!draft.quantity || Number(draft.quantity) <= 0) return "Quantity is required";
    if (!draft.unit) return "Unit is required";
    if (draft.source_department === "ready_goods_store" && !draft.production_department)
      return "Production department required for Ready Goods Store";
    return null;
  };

  const startEdit = (it: Bom) => {
    setDraft({ ...emptyDraft(), ...it });
    setEditingId(it.id);
    setShowAdd(true);
  };

  const cancel = () => {
    setDraft(emptyDraft());
    setEditingId(null);
    setShowAdd(false);
  };

  const save = async () => {
    const err = validateDraft();
    if (err) return toast.error(err);
    const payload: any = { ...draft, parent_product_id: parentId };
    ["cost_per_unit", "quantity", "lead_time_days"].forEach((k) => {
      payload[k] = payload[k] === "" || payload[k] == null ? null : Number(payload[k]);
    });
    payload.total_cost =
      payload.quantity != null && payload.cost_per_unit != null
        ? Number(payload.quantity) * Number(payload.cost_per_unit)
        : null;
    // visibility coherence
    if (payload.show_to_customer && payload.visibility_scope === "internal_only") {
      payload.visibility_scope = "customer_visible";
      payload.internal_component_only = false;
    }
    Object.keys(payload).forEach((k) => { if (payload[k] === "") payload[k] = null; });

    const res = editingId
      ? await (supabase as any).from("product_bom_items").update(payload).eq("id", editingId)
      : await (supabase as any).from("product_bom_items").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success(editingId ? "Component updated" : "Component added");
    cancel();
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this component?")) return;
    const { error } = await (supabase as any).from("product_bom_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  // Summaries
  const totals = useMemo(() => {
    const sum = (filter: (i: Bom) => boolean) =>
      items.filter(filter).reduce((acc, i) => acc + (Number(i.total_cost) || 0), 0);
    return {
      all: sum(() => true),
      packaging: sum((i) => !!i.is_packaging_component),
      product: sum((i) => i.component_type === "product"),
      labour: sum((i) => i.component_type === "labour" || i.component_type === "service"),
      visibleCount: items.filter((i) => i.show_to_customer).length,
      internalCount: items.filter((i) => !i.show_to_customer).length,
    };
  }, [items]);

  const routing = useMemo(() => {
    const map: Record<string, number> = {};
    items.forEach((i) => {
      const k = i.source_department || "unspecified";
      map[k] = (map[k] || 0) + 1;
    });
    return map;
  }, [items]);

  // Warnings
  const warnings: string[] = [];
  if (productClass === "gift_hamper" && items.length === 0)
    warnings.push("Gift hamper requires a BOM. Add at least one component.");
  if (productClass === "ready_pack") {
    if (!items.some((i) => i.is_packaging_component)) warnings.push("Ready pack: no packaging component yet.");
    if (!items.some((i) => i.component_type === "product")) warnings.push("Ready pack: no product/edible component yet.");
  }
  if (bomRequired && items.length === 0) warnings.push("BOM is marked required but no components exist.");

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-warning/10 border-warning/40 p-3 text-xs flex gap-2 items-start">
        <AlertTriangle className="h-4 w-4 mt-0.5 text-warning" />
        <div>
          BOM is primarily internal for Packing & Assembly. Only components explicitly marked
          <span className="font-medium"> visible</span> should ever be shown to customers.
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs space-y-1">
          {warnings.map((w, i) => <div key={i}>⚠️ {w}</div>)}
        </div>
      )}

      {/* Summary */}
      <div className="grid sm:grid-cols-4 gap-3">
        <div className="card-elevated p-4">
          <div className="text-[11px] uppercase text-muted-foreground">Total est. BOM cost</div>
          <div className="text-xl font-semibold">₹{totals.all.toFixed(2)}</div>
        </div>
        <div className="card-elevated p-4">
          <div className="text-[11px] uppercase text-muted-foreground">Packaging cost</div>
          <div className="text-xl font-semibold">₹{totals.packaging.toFixed(2)}</div>
        </div>
        <div className="card-elevated p-4">
          <div className="text-[11px] uppercase text-muted-foreground">Product cost</div>
          <div className="text-xl font-semibold">₹{totals.product.toFixed(2)}</div>
        </div>
        <div className="card-elevated p-4">
          <div className="text-[11px] uppercase text-muted-foreground">Labour / service</div>
          <div className="text-xl font-semibold">₹{totals.labour.toFixed(2)}</div>
        </div>
      </div>

      <div className="flex gap-2 text-xs">
        <Badge variant="secondary"><Eye className="h-3 w-3 mr-1" />Customer-visible: {totals.visibleCount}</Badge>
        <Badge variant="outline"><EyeOff className="h-3 w-3 mr-1" />Internal-only: {totals.internalCount}</Badge>
        {Object.entries(routing).map(([k, n]) => (
          <Badge key={k} variant="outline"><Boxes className="h-3 w-3 mr-1" />{k.replace(/_/g, " ")}: {n}</Badge>
        ))}
      </div>

      {/* Items list */}
      <div className="space-y-2">
        {loading ? <div className="text-sm text-muted-foreground">Loading…</div> :
          items.length === 0 ? <div className="text-sm text-muted-foreground">No components yet.</div> :
          items.map((it) => (
            <div key={it.id} className="card-elevated p-4 flex gap-3 items-start">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="font-medium truncate">{it.component_name || "(unnamed)"}</div>
                  <Badge variant="outline" className="text-[10px]">{it.component_type}</Badge>
                  {it.show_to_customer && <Badge className="text-[10px]">Customer-visible</Badge>}
                  {it.is_packaging_component && <Badge variant="secondary" className="text-[10px]">Packaging</Badge>}
                  {it.is_individually_saleable && <Badge variant="secondary" className="text-[10px]">Saleable</Badge>}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Qty {it.quantity} {it.unit}
                  {it.cost_per_unit != null && <> · ₹{it.cost_per_unit}/unit · Total ₹{(Number(it.total_cost) || 0).toFixed(2)}</>}
                </div>
                <div className="text-xs text-muted-foreground">
                  Route: {(it.source_department || "—").replace(/_/g, " ")}
                  {it.production_department && <> → {it.production_department.replace(/_/g, " ")}</>}
                  {" → "}{(it.issue_to_department || "—").replace(/_/g, " ")}
                </div>
                {it.notes && <div className="text-xs mt-1">{it.notes}</div>}
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => startEdit(it)}>Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => remove(it.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
      </div>

      {!showAdd && (
        <Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1" />Add component</Button>
      )}

      {showAdd && (
        <div className="card-elevated p-5 space-y-4 border-primary/30">
          <div className="flex items-center justify-between">
            <h4 className="font-display text-lg">{editingId ? "Edit component" : "Add component"}</h4>
            <Button size="icon" variant="ghost" onClick={cancel}><X className="h-4 w-4" /></Button>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Component type</Label>
              <Select value={draft.component_type} onChange={(v: string) => setD("component_type", v)} options={COMPONENT_TYPES} />
            </div>
            <div>
              <Label className="text-xs">Linked product (optional)</Label>
              {draft.child_product_id ? (
                <div className="flex items-center gap-2 border rounded-md p-2 text-sm">
                  <span className="flex-1 truncate">{draft.component_name}</span>
                  <Button size="sm" variant="ghost" onClick={() => setD("child_product_id", null)}>Clear</Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setPickChild((v) => !v)}>
                  {pickChild ? "Close picker" : "Pick product…"}
                </Button>
              )}
              {pickChild && !draft.child_product_id && (
                <div className="mt-2 border rounded-md p-2"><ProductPicker onPick={onPickChild} /></div>
              )}
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Component name</Label>
              <Input value={draft.component_name ?? ""} onChange={(e) => setD("component_name", e.target.value)} placeholder="Example: Acrylic box, Pistachio Baklawa, Ribbon" />
            </div>
            <div>
              <Label className="text-xs">Quantity</Label>
              <Input type="number" value={draft.quantity ?? ""} onChange={(e) => setD("quantity", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Unit</Label>
              <Select value={draft.unit} onChange={(v: string) => setD("unit", v)} options={UNITS} />
            </div>
            <div>
              <Label className="text-xs">Cost per unit (₹)</Label>
              <Input type="number" value={draft.cost_per_unit ?? ""} onChange={(e) => setD("cost_per_unit", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Lead time (days)</Label>
              <Input type="number" value={draft.lead_time_days ?? ""} onChange={(e) => setD("lead_time_days", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Notes</Label>
              <Textarea rows={2} value={draft.notes ?? ""} onChange={(e) => setD("notes", e.target.value)} />
            </div>

            {/* Routing */}
            <div className="sm:col-span-2 border-t pt-3">
              <div className="text-xs font-medium uppercase text-muted-foreground mb-2">Routing</div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Source department</Label>
                  <Select value={draft.source_department} onChange={(v: string) => setD("source_department", v)} options={SOURCE_DEPTS} />
                </div>
                {draft.source_department === "ready_goods_store" && (
                  <div>
                    <Label className="text-xs">Production department *</Label>
                    <Select value={draft.production_department} onChange={(v: string) => setD("production_department", v)} options={PROD_DEPTS} />
                  </div>
                )}
                <div>
                  <Label className="text-xs">Issue to</Label>
                  <Select value={draft.issue_to_department} onChange={(v: string) => setD("issue_to_department", v)} options={ISSUE_TO} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Required before assembly</Label>
                  <Switch checked={!!draft.required_before_assembly} onCheckedChange={(v) => setD("required_before_assembly", v)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Stock check required</Label>
                  <Switch checked={!!draft.stock_check_required} onCheckedChange={(v) => setD("stock_check_required", v)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Packaging component</Label>
                  <Switch checked={!!draft.is_packaging_component} onCheckedChange={(v) => setD("is_packaging_component", v)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Private label component</Label>
                  <Switch checked={!!draft.is_private_label_component} onCheckedChange={(v) => setD("is_private_label_component", v)} />
                </div>
              </div>
            </div>

            {/* Visibility & saleability */}
            <div className="sm:col-span-2 border-t pt-3">
              <div className="text-xs font-medium uppercase text-muted-foreground mb-2">Visibility & saleability</div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Visibility scope</Label>
                  <Select value={draft.visibility_scope} onChange={(v: string) => setD("visibility_scope", v)} options={VISIBILITY_SCOPES} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Show to customer</Label>
                  <Switch checked={!!draft.show_to_customer} onCheckedChange={(v) => setD("show_to_customer", v)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Show in public catalogue</Label>
                  <Switch checked={!!draft.show_in_public_catalogue} onCheckedChange={(v) => setD("show_in_public_catalogue", v)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Show in PDF catalogue</Label>
                  <Switch checked={!!draft.show_in_pdf_catalogue} onCheckedChange={(v) => setD("show_in_pdf_catalogue", v)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Show on label</Label>
                  <Switch checked={!!draft.show_on_label} onCheckedChange={(v) => setD("show_on_label", v)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Individually saleable</Label>
                  <Switch checked={!!draft.is_individually_saleable} onCheckedChange={(v) => setD("is_individually_saleable", v)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Internal component only</Label>
                  <Switch checked={!!draft.internal_component_only} onCheckedChange={(v) => setD("internal_component_only", v)} />
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={cancel}>Cancel</Button>
            <Button onClick={save}>{editingId ? "Update" : "Add"} component</Button>
          </div>
        </div>
      )}
    </div>
  );
}
