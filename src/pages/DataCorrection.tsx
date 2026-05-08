import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, FileWarning, Image as ImageIcon, Pencil, Eraser, Tag as TagIcon } from "lucide-react";

type FilterKey =
  | "all" | "needs_real_photo" | "missing_price" | "missing_moq"
  | "missing_category" | "missing_department" | "missing_label_data"
  | "reviewed" | "not_reviewed";

const FILTERS: { k: FilterKey; label: string }[] = [
  { k: "all", label: "All" },
  { k: "needs_real_photo", label: "Needs real photo" },
  { k: "missing_price", label: "Missing price" },
  { k: "missing_moq", label: "Missing MOQ" },
  { k: "missing_category", label: "Missing category" },
  { k: "missing_department", label: "Missing department" },
  { k: "missing_label_data", label: "Missing label data" },
  { k: "reviewed", label: "Reviewed" },
  { k: "not_reviewed", label: "Not reviewed" },
];

const REVIEW_KEY = "oasis_data_correction_reviewed_v1";

const isPdf = (u?: string | null) => !!u && u.includes("/_pdf_pages/");

const DataCorrection = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [docFilter, setDocFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [reviewed, setReviewed] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(REVIEW_KEY) || "{}"); } catch { return {}; }
  });

  const persistReviewed = (r: Record<string, boolean>) => {
    setReviewed(r);
    localStorage.setItem(REVIEW_KEY, JSON.stringify(r));
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("id, sku, product_name, hero_image_url, source_document, source_page, source_pdf_sku, b2b_price_inr, b2b_price, export_price_usd, export_price, mrp, moq_value, moq_uom, category, main_department, production_department, shelf_life_days, storage_instructions, is_catalogue_ready")
      .order("product_name");
    if (error) toast.error(error.message);
    setRows(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const docs = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => { if (r.source_document) s.add(r.source_document); });
    return ["all", ...Array.from(s)];
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((p) => {
      if (docFilter !== "all" && p.source_document !== docFilter) return false;
      if (q && !`${p.product_name} ${p.sku} ${p.source_pdf_sku ?? ""}`.toLowerCase().includes(q)) return false;
      const noPrice = !(p.b2b_price_inr || p.b2b_price || p.export_price_usd || p.export_price || p.mrp);
      const noMoq = !p.moq_value;
      const noCat = !p.category;
      const noDept = !p.main_department && !p.production_department;
      const noLabel = !p.shelf_life_days || !p.storage_instructions;
      const needsPhoto = !p.hero_image_url || isPdf(p.hero_image_url);
      switch (filter) {
        case "all": return true;
        case "needs_real_photo": return needsPhoto;
        case "missing_price": return noPrice;
        case "missing_moq": return noMoq;
        case "missing_category": return noCat;
        case "missing_department": return noDept;
        case "missing_label_data": return noLabel;
        case "reviewed": return !!reviewed[p.id];
        case "not_reviewed": return !reviewed[p.id];
      }
    });
  }, [rows, filter, docFilter, search, reviewed]);

  const clearPdfHero = async (p: any) => {
    if (!confirm("Clear the PDF screenshot used as hero image?")) return;
    const { error } = await supabase.from("products").update({ hero_image_url: null }).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("PDF hero cleared");
    load();
  };

  const markReviewed = (id: string) => {
    persistReviewed({ ...reviewed, [id]: !reviewed[id] });
  };

  const markCatalogueReady = async (p: any) => {
    const { error } = await supabase.from("products").update({ is_catalogue_ready: !p.is_catalogue_ready }).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success(p.is_catalogue_ready ? "Marked not ready" : "Marked catalogue-ready");
    load();
  };

  return (
    <>
      <PageHeader title="Data Correction Center" subtitle="Review and correct imported PDF products: photos, prices, MOQ, departments, label data." />

      <div className="luxe-panel mb-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 min-w-0">
          <Input placeholder="Search name / SKU…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="h-10 px-3 rounded-md border border-input bg-background text-sm w-full truncate" value={docFilter} onChange={(e) => setDocFilter(e.target.value)}>
            {docs.map((d) => <option key={d} value={d}>{d === "all" ? "All source documents" : d}</option>)}
          </select>
          <div className="text-xs text-muted-foreground self-center truncate">{filtered.length} of {rows.length} products</div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <Button key={f.k} size="sm" variant={filter === f.k ? "default" : "outline"} onClick={() => setFilter(f.k)} className="text-xs">
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {loading ? <div className="text-sm text-muted-foreground">Loading…</div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((p) => {
            const needsPhoto = !p.hero_image_url || isPdf(p.hero_image_url);
            const price = p.b2b_price_inr || p.b2b_price || p.mrp;
            const exportPrice = p.export_price_usd || p.export_price;
            return (
              <div key={p.id} className="luxe-panel min-w-0">
                <div className="flex gap-3 min-w-0">
                  <div className="h-20 w-20 rounded-lg bg-secondary/50 overflow-hidden flex items-center justify-center shrink-0">
                    {needsPhoto
                      ? <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      : <img src={p.hero_image_url} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{p.product_name}</div>
                    <div className="text-xs font-mono text-muted-foreground truncate">{p.sku}</div>
                    <div className="text-xs text-muted-foreground mt-1 truncate">
                      {p.source_document || "—"} {p.source_page ? `· p.${p.source_page}` : ""}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {needsPhoto && <Badge variant="outline" className="text-[10px] text-warning border-warning/40"><FileWarning className="h-3 w-3 mr-1" />photo</Badge>}
                      {!price && <Badge variant="outline" className="text-[10px]">no B2B price</Badge>}
                      {!exportPrice && <Badge variant="outline" className="text-[10px]">no export</Badge>}
                      {!p.moq_value && <Badge variant="outline" className="text-[10px]">no MOQ</Badge>}
                      {!p.category && <Badge variant="outline" className="text-[10px]">no category</Badge>}
                      {(!p.main_department && !p.production_department) && <Badge variant="outline" className="text-[10px]">no dept</Badge>}
                      {reviewed[p.id] && <Badge className="text-[10px] bg-success/10 text-success border-success/40">reviewed</Badge>}
                      {p.is_catalogue_ready && <Badge className="text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" />ready</Badge>}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-3 grid grid-cols-2 gap-1">
                  <div>B2B: {price ? `₹${price}` : "—"}</div>
                  <div>Export: {exportPrice ? `$${exportPrice}` : "—"}</div>
                  <div>MOQ: {p.moq_value ? `${p.moq_value} ${p.moq_uom || ""}` : "—"}</div>
                  <div className="truncate">Category: {p.category || "—"}</div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  <Button asChild size="sm" variant="outline"><Link to={`/products/${p.id}`}><Pencil className="h-3.5 w-3.5 mr-1" />Edit</Link></Button>
                  <Button asChild size="sm" variant="outline"><Link to={`/products/${p.id}?tab=media`}><ImageIcon className="h-3.5 w-3.5 mr-1" />Replace photo</Link></Button>
                  {isPdf(p.hero_image_url) && (
                    <Button size="sm" variant="outline" onClick={() => clearPdfHero(p)}><Eraser className="h-3.5 w-3.5 mr-1" />Clear PDF hero</Button>
                  )}
                  <Button size="sm" variant={reviewed[p.id] ? "default" : "outline"} onClick={() => markReviewed(p.id)}>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />{reviewed[p.id] ? "Reviewed" : "Mark reviewed"}
                  </Button>
                  <Button size="sm" variant={p.is_catalogue_ready ? "default" : "outline"} onClick={() => markCatalogueReady(p)}>
                    <TagIcon className="h-3.5 w-3.5 mr-1" />{p.is_catalogue_ready ? "Catalogue-ready" : "Mark ready"}
                  </Button>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <div className="col-span-full text-center text-sm text-muted-foreground py-12">No products match these filters.</div>}
        </div>
      )}
    </>
  );
};

export default DataCorrection;
