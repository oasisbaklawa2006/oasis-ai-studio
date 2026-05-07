import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Lock, Unlock, ShieldX } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

type Row = {
  id: string;
  product_id: string;
  product_name: string;
  sku: string;
  status: string;
  has_label: boolean;
  has_ingredients: boolean;
  has_nutrition: boolean;
  has_fssai: boolean;
  has_mrp: boolean;
  has_net_qty: boolean;
  locked_at?: string | null;
  has_storage: boolean;
  has_shelf_life: boolean;
};

const FILTERS = ["all", "missing_data", "needs_review", "approved", "locked", "rejected"] as const;
type Filter = typeof FILTERS[number];

const LabelQueue = () => {
  const { roles } = useAuth();
  const isAdmin = roles.includes("owner" as any) || roles.includes("admin" as any);
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: prods }, { data: labels }, { data: ings }, { data: nutri }] = await Promise.all([
      supabase.from("products").select("id,product_name,sku,label_status,storage_instructions,shelf_life_days").eq("is_active", true).order("product_name"),
      supabase.from("labels").select("*"),
      supabase.from("product_ingredients").select("product_id"),
      supabase.from("nutrition_panels").select("product_id"),
    ]);
    const labelMap = new Map((labels ?? []).map((l: any) => [l.product_id, l]));
    const ingSet = new Set((ings ?? []).map((i: any) => i.product_id));
    const nutSet = new Set((nutri ?? []).map((n: any) => n.product_id));
    const out: Row[] = (prods ?? []).map((p: any) => {
      const l: any = labelMap.get(p.id);
      return {
        id: l?.id ?? p.id,
        product_id: p.id,
        product_name: p.product_name,
        sku: p.sku,
        status: l?.status ?? p.label_status ?? "draft",
        has_label: !!l,
        has_ingredients: ingSet.has(p.id),
        has_nutrition: nutSet.has(p.id),
        has_fssai: !!l?.fssai_license,
        has_mrp: l?.mrp != null,
        has_net_qty: !!l?.net_quantity,
        has_storage: !!p.storage_instructions,
        has_shelf_life: p.shelf_life_days != null,
        locked_at: l?.locked_at,
      };
    });
    setRows(out);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => rows.filter((r) => {
    switch (filter) {
      case "all": return true;
      case "missing_data": return !r.has_ingredients || !r.has_nutrition || !r.has_fssai || !r.has_mrp || !r.has_net_qty || !r.has_storage || !r.has_shelf_life;
      default: return r.status === filter;
    }
  }), [rows, filter]);

  const setStatus = async (r: Row, status: string, lock = false) => {
    const patch: any = { status };
    if (lock) { patch.locked_at = new Date().toISOString(); }
    if (status === "draft" && r.locked_at) { patch.locked_at = null; patch.locked_by = null; }
    const upsertPayload: any = { product_id: r.product_id, ...patch };
    const { error } = await supabase.from("labels").upsert(upsertPayload, { onConflict: "product_id" });
    if (error) return toast.error(error.message);
    await supabase.from("products").update({ label_status: status }).eq("id", r.product_id);
    toast.success(`Label ${status}`);
    load();
  };

  return (
    <>
      <PageHeader title="Label Approval Queue" subtitle="Review compliance, approve, and lock product labels before printing." />

      <div className="card-elevated p-3 mb-4 flex items-start gap-2 bg-warning/10 text-warning text-sm">
        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
        Legal label data must be reviewed by an authorized human before printing or publishing.
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {FILTERS.map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className="capitalize">
            {f.replace(/_/g, " ")}
          </Button>
        ))}
      </div>

      {loading ? <div className="text-sm text-muted-foreground">Loading…</div> : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const warns: string[] = [];
            if (!r.has_ingredients) warns.push("ingredients");
            if (!r.has_nutrition) warns.push("nutrition");
            if (!r.has_fssai) warns.push("FSSAI");
            if (!r.has_mrp) warns.push("MRP");
            if (!r.has_net_qty) warns.push("net qty");
            const ready = warns.length === 0;
            const locked = r.status === "locked";
            return (
              <div key={r.product_id} className="card-elevated p-4 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[220px]">
                  <Link to={`/labels?p=${r.product_id}`} className="font-medium hover:underline">{r.product_name}</Link>
                  <div className="text-xs font-mono text-muted-foreground">{r.sku}</div>
                  {warns.length > 0 && <div className="text-xs text-warning mt-1">Missing: {warns.join(", ")}</div>}
                </div>
                <span className={`badge-soft capitalize ${
                  r.status === "approved" || r.status === "locked" ? "bg-success/10 text-success" :
                  r.status === "rejected" ? "bg-destructive/10 text-destructive" :
                  r.status === "needs_review" ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground"
                }`}>{r.status.replace(/_/g, " ")}</span>
                <span className={`badge-soft ${ready ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                  {ready ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                  {ready ? "ready" : "not ready"}
                </span>
                <div className="flex gap-1.5 ml-auto">
                  {!locked && <>
                    <Button size="sm" variant="outline" onClick={() => setStatus(r, "needs_review")}>Needs Review</Button>
                    <Button size="sm" variant="outline" onClick={() => setStatus(r, "approved")}>Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => setStatus(r, "rejected")}><ShieldX className="h-3.5 w-3.5 mr-1" />Reject</Button>
                    <Button size="sm" onClick={() => setStatus(r, "locked", true)}><Lock className="h-3.5 w-3.5 mr-1" />Lock</Button>
                  </>}
                  {locked && (isAdmin
                    ? <Button size="sm" variant="outline" onClick={() => setStatus(r, "approved")}><Unlock className="h-3.5 w-3.5 mr-1" />Unlock</Button>
                    : <span className="text-xs text-muted-foreground">Owner/Admin only</span>)}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <div className="text-center text-sm text-muted-foreground py-12">No products match this filter.</div>}
        </div>
      )}
    </>
  );
};

export default LabelQueue;
