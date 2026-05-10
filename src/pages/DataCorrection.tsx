import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  FileWarning,
  Image as ImageIcon,
  Pencil,
  Eraser,
  Tag as TagIcon,
} from "lucide-react";

type FilterKey =
  | "all"
  | "needs_real_photo"
  | "missing_price"
  | "missing_moq"
  | "missing_category"
  | "missing_department"
  | "missing_label_data"
  | "reviewed"
  | "not_reviewed";

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

const productDisplayName = (p: any) => p?.name || p?.sku || p?.id || "Unnamed product";

const getPrice = (p: any) =>
  p.price_b2b ||
  p.price_bulk ||
  p.price_wholesale ||
  p.wholesale_price ||
  p.base_price ||
  p.mrp ||
  null;

const getMoq = (p: any) => p.moq || p.moq_packs || p.private_label_moq || null;

const DataCorrection = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [reviewed, setReviewed] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem(REVIEW_KEY) || "{}");
    } catch {
      return {};
    }
  });

  const persistReviewed = (r: Record<string, boolean>) => {
    setReviewed(r);
    localStorage.setItem(REVIEW_KEY, JSON.stringify(r));
  };

  const load = async () => {
    setLoading(true);
    setQueryError(null);

    const { data, error } = await supabase
      .from("products")
      .select(
        [
          "id",
          "name",
          "sku",
          "category",
          "sub_category",
          "description",
          "image_url",
          "mrp",
          "base_price",
          "wholesale_price",
          "price_bulk",
          "price_wholesale",
          "price_horeca",
          "price_b2b",
          "price_special",
          "moq",
          "moq_packs",
          "private_label_moq",
          "department",
          "production_department",
          "shelf_life_days",
          "storage_instructions",
          "ingredients",
          "nutritional_info",
          "nutrition_facts",
          "allergen_warnings",
          "visible_in_catalog",
          "uom",
          "hsn_code",
          "gst_rate",
          "gst_percentage",
          "aliases",
          "product_family",
        ].join(", ")
      )
      .order("name", { ascending: true });

    if (error) {
      setQueryError(error.message);
      toast.error(error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows.filter((p) => {
      const aliasText = Array.isArray(p.aliases) ? p.aliases.join(" ") : "";
      const searchText = [
        p.name,
        p.sku,
        p.category,
        p.sub_category,
        p.department,
        p.production_department,
        p.product_family,
        aliasText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (q && !searchText.includes(q)) return false;

      const noPrice = !getPrice(p);
      const noMoq = !getMoq(p);
      const noCat = !p.category;
      const noDept = !p.department && !p.production_department;
      const noLabel =
        !p.shelf_life_days ||
        !p.storage_instructions ||
        !p.ingredients ||
        !p.allergen_warnings;
      const needsPhoto = !p.image_url || isPdf(p.image_url);

      switch (filter) {
        case "all":
          return true;
        case "needs_real_photo":
          return needsPhoto;
        case "missing_price":
          return noPrice;
        case "missing_moq":
          return noMoq;
        case "missing_category":
          return noCat;
        case "missing_department":
          return noDept;
        case "missing_label_data":
          return noLabel;
        case "reviewed":
          return !!reviewed[p.id];
        case "not_reviewed":
          return !reviewed[p.id];
        default:
          return true;
      }
    });
  }, [rows, filter, search, reviewed]);

  const clearPdfHero = async (p: any) => {
    if (!confirm("Clear the PDF screenshot used as product image?")) return;

    const { error } = await supabase
      .from("products")
      .update({ image_url: null })
      .eq("id", p.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("PDF image cleared");
    load();
  };

  const markReviewed = (id: string) => {
    persistReviewed({ ...reviewed, [id]: !reviewed[id] });
  };

  const markCatalogueReady = async (p: any) => {
    const { error } = await supabase
      .from("products")
      .update({ visible_in_catalog: !p.visible_in_catalog })
      .eq("id", p.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(p.visible_in_catalog ? "Hidden from catalogue" : "Marked visible in catalogue");
    load();
  };

  return (
    <>
      <PageHeader
        title="Data Correction Center"
        subtitle="Review and correct products: photos, prices, MOQ, departments, and label data."
      />

      {queryError && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 mt-0.5" />
          <div>
            <div className="font-medium">Product query failed</div>
            <div>{queryError}</div>
          </div>
        </div>
      )}

      <div className="luxe-panel mb-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
          <Input
            placeholder="Search name / SKU / category / alias…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="text-xs text-muted-foreground self-center truncate">
            {filtered.length} of {rows.length} products
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <Button
              key={f.k}
              size="sm"
              variant={filter === f.k ? "default" : "outline"}
              onClick={() => setFilter(f.k)}
              className="text-xs"
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((p) => {
            const displayName = productDisplayName(p);
            const needsPhoto = !p.image_url || isPdf(p.image_url);
            const price = getPrice(p);
            const moq = getMoq(p);
            const noDept = !p.department && !p.production_department;
            const noLabel =
              !p.shelf_life_days ||
              !p.storage_instructions ||
              !p.ingredients ||
              !p.allergen_warnings;

            return (
              <div key={p.id} className="luxe-panel min-w-0">
                <div className="flex gap-3 min-w-0">
                  <div className="h-20 w-20 rounded-lg bg-secondary/50 overflow-hidden flex items-center justify-center shrink-0">
                    {needsPhoto ? (
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    ) : (
                      <img
                        src={p.image_url}
                        alt={displayName}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{displayName}</div>
                    <div className="text-xs font-mono text-muted-foreground truncate">
                      {p.sku || "No SKU"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 truncate">
                      {p.category || "No category"}
                      {p.sub_category ? ` · ${p.sub_category}` : ""}
                    </div>

                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {needsPhoto && (
                        <Badge
                          variant="outline"
                          className="text-[10px] text-warning border-warning/40"
                        >
                          <FileWarning className="h-3 w-3 mr-1" />
                          photo
                        </Badge>
                      )}
                      {!price && (
                        <Badge variant="outline" className="text-[10px]">
                          no price
                        </Badge>
                      )}
                      {!moq && (
                        <Badge variant="outline" className="text-[10px]">
                          no MOQ
                        </Badge>
                      )}
                      {!p.category && (
                        <Badge variant="outline" className="text-[10px]">
                          no category
                        </Badge>
                      )}
                      {noDept && (
                        <Badge variant="outline" className="text-[10px]">
                          no dept
                        </Badge>
                      )}
                      {noLabel && (
                        <Badge variant="outline" className="text-[10px]">
                          label data
                        </Badge>
                      )}
                      {reviewed[p.id] && (
                        <Badge className="text-[10px] bg-success/10 text-success border-success/40">
                          reviewed
                        </Badge>
                      )}
                      {p.visible_in_catalog && (
                        <Badge className="text-[10px]">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          visible
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground mt-3 grid grid-cols-2 gap-1">
                  <div>B2B: {price ? `₹${price}` : "—"}</div>
                  <div>MOQ: {moq ? `${moq} ${p.uom || ""}` : "—"}</div>
                  <div className="truncate">Category: {p.category || "—"}</div>
                  <div className="truncate">
                    Dept: {p.department || p.production_department || "—"}
                  </div>
                  <div className="truncate">HSN: {p.hsn_code || "—"}</div>
                  <div>
                    GST: {p.gst_rate ?? p.gst_percentage ?? "—"}
                    {p.gst_rate || p.gst_percentage ? "%" : ""}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mt-3">
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/products/${p.id}`}>
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      Edit
                    </Link>
                  </Button>

                  <Button asChild size="sm" variant="outline">
                    <Link to={`/products/${p.id}?tab=media`}>
                      <ImageIcon className="h-3.5 w-3.5 mr-1" />
                      Replace photo
                    </Link>
                  </Button>

                  {isPdf(p.image_url) && (
                    <Button size="sm" variant="outline" onClick={() => clearPdfHero(p)}>
                      <Eraser className="h-3.5 w-3.5 mr-1" />
                      Clear PDF image
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant={reviewed[p.id] ? "default" : "outline"}
                    onClick={() => markReviewed(p.id)}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    {reviewed[p.id] ? "Reviewed" : "Mark reviewed"}
                  </Button>

                  <Button
                    size="sm"
                    variant={p.visible_in_catalog ? "default" : "outline"}
                    onClick={() => markCatalogueReady(p)}
                  >
                    <TagIcon className="h-3.5 w-3.5 mr-1" />
                    {p.visible_in_catalog ? "Visible" : "Mark visible"}
                  </Button>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="col-span-full text-center text-sm text-muted-foreground py-12">
              No products match these filters.
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default DataCorrection;
