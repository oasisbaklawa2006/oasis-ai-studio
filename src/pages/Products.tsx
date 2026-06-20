import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus, Search, Image as ImageIcon, Copy,
  Filter, X, Package, Layers, Tag, Boxes, Zap,
} from "lucide-react";
import {
  BASIC_SEARCH_FALLBACK_MESSAGE,
  searchProductsWithAliases,
  type ProductSearchResult,
} from "@/lib/productSearch";
import { toast } from "sonner";
import { ReadinessBadge } from "@/components/ReadinessBadge";
import { CatalogueWriteModeBanner } from "@/components/CatalogueWriteModeBanner";
import { resolveProductCardHeroUrl } from "@/lib/productImage";
import {
  buildProductReadinessSnapshot,
  dimensionCardLabel,
  dimensionIsComplete,
} from "@/features/readiness/productReadinessSnapshot";
import { mediaGovernanceStatusLine } from "@/features/mediaReadiness/mediaGovernanceDisplay";
import type { ProductMediaRow } from "@/features/mediaReadiness/mediaAssetsFromForm";
import {
  detectProductMasterDuplicates,
  duplicateKindLabel,
} from "@/features/productGovernance/duplicateDetection";
import { ProductActionsMenu } from "@/features/productGovernance/ProductActionsMenu";
import type { ProductLabelBarcodeRow } from "@/features/productGovernance/types";
import {
  fetchProductAuthorityBundle,
  fetchProductsForMasterList,
} from "@/features/productMaster/productListFetch";
import {
  filterProductsForMasterList,
  productDisplayName,
} from "@/features/productMaster/productListModel";
import type { MoqRuleRow, PricingRuleRow } from "@/features/productTruth/channelAuthorityMappers";

const PRODUCT_CLASSES = [
  { v: "bulk_loose_product", label: "Bulk / Loose" },
  { v: "ready_pack", label: "Ready pack" },
  { v: "gift_hamper", label: "Gift / Hamper" },
  { v: "packaging_decoration_material", label: "Packaging / Deco" },
  { v: "semi_prepared_frozen", label: "Frozen / Semi-prep" },
  { v: "service_or_customization", label: "Service / Custom" },
];
const MAIN_DEPTS = [
  { v: "packing_assembly", label: "Packing & Assembly" },
  { v: "third_party_goods_store", label: "3rd Party Goods Store" },
  { v: "ready_goods_store", label: "Ready Goods Store" },
];
const PROD_DEPTS = [
  { v: "arabic_sweets", label: "Arabic Sweets" },
  { v: "fusion_sweets", label: "Fusion Sweets" },
  { v: "chocolates_confectionery", label: "Chocolates & Confectionery" },
  { v: "dragees", label: "Dragees" },
  { v: "seasoned_nuts_mixes", label: "Seasoned Nuts & Mixes" },
  { v: "bakery", label: "Bakery" },
];
const UOMS = ["kg", "pcs", "grams", "box", "tray", "carton"];
const LABEL_STATUSES = ["draft", "needs_review", "approved", "locked", "rejected"];
const SORTS = [
  { v: "recent", label: "Recently created" },
  { v: "name", label: "Name A–Z" },
  { v: "class", label: "Product class" },
  { v: "dept", label: "Department" },
  { v: "ready", label: "Catalogue-ready first" },
  { v: "label_ok", label: "Label approved first" },
];

const labelOf = (list: { v: string; label: string }[], v?: string | null) =>
  list.find((x) => x.v === v)?.label ?? v ?? "";

const Badge = ({ tone = "muted", children, title }: { tone?: "ok" | "warn" | "muted" | "accent" | "primary"; children: React.ReactNode; title?: string }) => {
  const map = {
    ok: "bg-success/10 text-success",
    warn: "bg-warning/10 text-warning",
    muted: "bg-muted text-muted-foreground",
    accent: "bg-accent-soft text-accent-foreground",
    primary: "bg-primary/10 text-primary",
  } as const;
  return <span title={title} className={`badge-soft ${map[tone]}`}>{children}</span>;
};

const moqSummary = (p: any): string | null => {
  if (p.moq_rule_type === "not_applicable") return "MOQ: not applicable";
  if (p.private_label_allowed && p.private_label_moq) return `MOQ: ${p.private_label_moq} ${p.private_label_moq_uom || "pcs"} private label`;
  if (p.fixed_carton_required && p.carton_qty) return `MOQ: closed carton ${p.carton_qty} ${p.carton_uom || "pcs"}`;
  if (p.moq_value) return `MOQ: ${p.moq_value} ${p.moq_uom || ""}`.trim();
  if (p.moq_text) return `MOQ: ${p.moq_text}`;
  return null;
};

const uomSummary = (p: any): string | null => {
  if (p.b2b_uom && p.retail_uom) return `B2B: ${p.b2b_uom} · Retail: ${p.retail_uom}`;
  if (p.primary_uom) return `UOM: ${p.primary_uom}`;
  return null;
};

const deptSummary = (p: any): string | null => {
  const main = labelOf(MAIN_DEPTS, p.main_department);
  const prod = labelOf(PROD_DEPTS, p.production_department);
  if (main && prod) return `${main} · ${prod}`;
  return main || null;
};

const Products = () => {
  const [items, setItems] = useState<any[]>([]);
  const [results, setResults] = useState<ProductSearchResult[] | null>(null);
  const [searchBasicFallback, setSearchBasicFallback] = useState(false);
  const [q, setQ] = useState("");
  const [rules, setRules] = useState<any[]>([]);

  // SKU code filters (existing)
  const [div, setDiv] = useState("");
  const [cat, setCat] = useState("");
  const [pack, setPack] = useState("");

  // New Batch D filters
  const [pclass, setPclass] = useState("");
  const [mainDept, setMainDept] = useState("");
  const [prodDept, setProdDept] = useState("");
  const [uom, setUom] = useState("");
  const [pl, setPl] = useState(""); // "yes" | "no" | ""
  const [bom, setBom] = useState("");
  const [carton, setCarton] = useState("");
  const [ready, setReady] = useState(""); // "yes" | "no"
  const [labelStatus, setLabelStatus] = useState("");
  const [sort, setSort] = useState("recent");
  const [showFilters, setShowFilters] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [labelRows, setLabelRows] = useState<ProductLabelBarcodeRow[]>([]);
  const [reloadToken, setReloadToken] = useState(0);

  const reloadProducts = () => setReloadToken((n) => n + 1);

  const [moqCounts, setMoqCounts] = useState<Record<string, number>>({});
  const [priceCounts, setPriceCounts] = useState<Record<string, { total: number; approved: number }>>({});
  const [mediaByProduct, setMediaByProduct] = useState<Record<string, ProductMediaRow[]>>({});
  const [pricingByProduct, setPricingByProduct] = useState<Record<string, PricingRuleRow[]>>({});
  const [moqByProduct, setMoqByProduct] = useState<Record<string, MoqRuleRow[]>>({});
  const [catalogueApprovedByProduct, setCatalogueApprovedByProduct] = useState<Record<string, boolean>>({});
  const [authorityReady, setAuthorityReady] = useState(false);
  const [readinessUnavailable, setReadinessUnavailable] = useState(false);
  const [productsLoadError, setProductsLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setAuthorityReady(false);
      setReadinessUnavailable(false);

      const productsResult = await fetchProductsForMasterList({ showArchived });
      if (cancelled) return;

      if (productsResult.error) {
        console.error("[Products] products fetch:", productsResult.error);
        setProductsLoadError(productsResult.error);
        toast.error("Could not load full product list — showing available rows");
      } else {
        setProductsLoadError(null);
      }
      setItems(productsResult.products);

      const bundle = await fetchProductAuthorityBundle();
      if (cancelled) return;

      setRules(bundle.rules);
      setMoqCounts(bundle.moqCounts);
      setPriceCounts(bundle.priceCounts);
      setMediaByProduct(bundle.mediaByProduct);
      setPricingByProduct(bundle.pricingByProduct);
      setMoqByProduct(bundle.moqByProduct);
      setCatalogueApprovedByProduct(bundle.catalogueApprovedByProduct);
      setLabelRows(bundle.labelRows);
      setReadinessUnavailable(bundle.hadErrors);
      setAuthorityReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [showArchived, reloadToken]);

  const readinessByProduct = useMemo(() => {
    const map = new Map<string, ReturnType<typeof buildProductReadinessSnapshot>>();
    for (const p of items) {
      map.set(
        p.id,
        buildProductReadinessSnapshot(p, {
          productMediaRows: mediaByProduct[p.id] ?? [],
          pricingRows: pricingByProduct[p.id] ?? [],
          moqRows: moqByProduct[p.id] ?? [],
        }),
      );
    }
    return map;
  }, [items, mediaByProduct, pricingByProduct, moqByProduct]);

  const duplicateSignalsByProduct = useMemo(
    () => detectProductMasterDuplicates(items, labelRows),
    [items, labelRows],
  );

  const duplicateProductCount = duplicateSignalsByProduct.size;

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      if (!q.trim()) {
        setResults(null);
        setSearchBasicFallback(false);
        return;
      }
      const r = await searchProductsWithAliases(q);
      if (!cancelled) {
        setResults(r.results);
        setSearchBasicFallback(r.usedBasicFallback);
      }
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q]);

  const aliasById = new Map<string, string>();
  if (results) results.forEach((r) => { if (r.matched_alias && !aliasById.has(r.id)) aliasById.set(r.id, r.matched_alias); });
  const ids = results ? new Set(results.map((r) => r.id)) : null;

  const filtered = useMemo(() => {
    let arr = filterProductsForMasterList(items, {
      showArchived,
      searchIds: ids,
      div,
      cat,
      pack,
      pclass,
      mainDept,
      prodDept,
      uom,
      pl,
      bom,
      carton,
      ready,
      labelStatus,
    });
    switch (sort) {
      case "name": arr = [...arr].sort((a, b) => productDisplayName(a).localeCompare(productDisplayName(b))); break;
      case "class": arr = [...arr].sort((a, b) => (a.product_class || "").localeCompare(b.product_class || "")); break;
      case "dept": arr = [...arr].sort((a, b) => (a.main_department || "").localeCompare(b.main_department || "")); break;
      case "ready": arr = [...arr].sort((a, b) => Number(!!b.is_catalogue_ready) - Number(!!a.is_catalogue_ready)); break;
      case "label_ok": arr = [...arr].sort((a, b) => Number(b.label_status === "approved" || b.label_status === "locked") - Number(a.label_status === "approved" || a.label_status === "locked")); break;
    }
    return arr;
  }, [items, ids, div, cat, pack, pclass, mainDept, prodDept, uom, pl, bom, carton, ready, labelStatus, sort, showArchived]);

  const by = (t: string) => rules.filter((r) => r.code_type === t);
  const copy = (e: React.MouseEvent, sku: string) => { e.preventDefault(); navigator.clipboard.writeText(sku); toast.success("SKU copied"); };

  const activeFilterCount = [div, cat, pack, pclass, mainDept, prodDept, uom, pl, bom, carton, ready, labelStatus].filter(Boolean).length;
  const clearAll = () => {
    setDiv(""); setCat(""); setPack("");
    setPclass(""); setMainDept(""); setProdDept(""); setUom("");
    setPl(""); setBom(""); setCarton(""); setReady(""); setLabelStatus("");
  };

  const sel = "h-9 px-2 rounded-lg border border-border/60 bg-background text-xs w-full min-w-0 truncate";

  return (
    <>
      <CatalogueWriteModeBanner />
      <PageHeader
        title="Product Master"
        subtitle="The single source of truth for every Oasis product."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="default">
              <Link to="/products/new/fast"><Zap className="h-4 w-4 mr-1" />Fast Create</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/products/new"><Plus className="h-4 w-4 mr-1" />Full editor</Link>
            </Button>
          </div>
        }
      />

      <div className="sticky top-0 z-20 -mx-4 sm:mx-0 px-4 sm:px-0 mb-6 bg-background/85 backdrop-blur-md py-3">
        <div className="luxe-panel space-y-3 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Search className="h-4 w-4 text-accent shrink-0" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, SKU, alias…"
              className="border-0 focus-visible:ring-0 px-0 bg-transparent text-sm min-w-0 flex-1"
            />
            <Button variant="outline" size="sm" onClick={() => setShowFilters((v) => !v)} className="shrink-0 rounded-full">
              <Filter className="h-3.5 w-3.5 mr-1" />
              <span className="hidden sm:inline">Filters</span>{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ""}
            </Button>
            <Button
              variant={showArchived ? "secondary" : "outline"}
              size="sm"
              onClick={() => setShowArchived((v) => !v)}
              className="shrink-0 rounded-full sm:hidden"
            >
              {showArchived ? "Archived" : "Active"}
            </Button>
            <select className="h-9 px-2 rounded-full border border-border/60 bg-background text-xs hidden sm:block max-w-[160px] truncate" value={sort} onChange={(e) => setSort(e.target.value)}>
              {SORTS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
            </select>
          </div>

          {searchBasicFallback && q.trim() && (
            <p className="text-xs text-muted-foreground px-1">{BASIC_SEARCH_FALLBACK_MESSAGE}</p>
          )}

          {(duplicateProductCount > 0) && (
            <div className="px-1 text-xs">
              <span className="badge-soft bg-warning/10 text-warning">
                {duplicateProductCount} product{duplicateProductCount === 1 ? "" : "s"} with duplicate signals
              </span>
            </div>
          )}

          {showFilters && (
            <div className="space-y-3 pt-3 border-t border-border/60 min-w-0">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 min-w-0">
                <select className={sel} value={pclass} onChange={(e) => setPclass(e.target.value)}>
                  <option value="">All product classes</option>
                  {PRODUCT_CLASSES.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
                </select>
                <select className={sel} value={mainDept} onChange={(e) => { setMainDept(e.target.value); if (e.target.value !== "ready_goods_store") setProdDept(""); }}>
                  <option value="">All main departments</option>
                  {MAIN_DEPTS.map((d) => <option key={d.v} value={d.v}>{d.label}</option>)}
                </select>
                <select className={sel} value={prodDept} onChange={(e) => setProdDept(e.target.value)}>
                  <option value="">All production depts</option>
                  {PROD_DEPTS.map((d) => <option key={d.v} value={d.v}>{d.label}</option>)}
                </select>
                <select className={sel} value={uom} onChange={(e) => setUom(e.target.value)}>
                  <option value="">All UOM</option>
                  {UOMS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
                <select className={sel} value={pl} onChange={(e) => setPl(e.target.value)}>
                  <option value="">Private label: all</option>
                  <option value="yes">Private label: yes</option>
                  <option value="no">Private label: no</option>
                </select>
                <select className={sel} value={bom} onChange={(e) => setBom(e.target.value)}>
                  <option value="">BOM: all</option>
                  <option value="yes">BOM required</option>
                  <option value="no">No BOM</option>
                </select>
                <select className={sel} value={carton} onChange={(e) => setCarton(e.target.value)}>
                  <option value="">Carton: all</option>
                  <option value="yes">Fixed carton</option>
                  <option value="no">No fixed carton</option>
                </select>
                <select className={sel} value={ready} onChange={(e) => setReady(e.target.value)}>
                  <option value="">Catalogue: all</option>
                  <option value="yes">Catalogue ready</option>
                  <option value="no">Not ready</option>
                </select>
                <select className={sel} value={labelStatus} onChange={(e) => setLabelStatus(e.target.value)}>
                  <option value="">Label: all</option>
                  {LABEL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <label className={`${sel} flex items-center gap-2 cursor-pointer`}>
                  <input
                    type="checkbox"
                    checked={showArchived}
                    onChange={(e) => setShowArchived(e.target.checked)}
                    className="rounded border-border"
                  />
                  Show archived
                </label>
                <select className={sel} value={div} onChange={(e) => setDiv(e.target.value)}>
                  <option value="">All divisions</option>
                  {by("division").map((r) => <option key={r.code} value={r.code}>{r.code} · {r.label}</option>)}
                </select>
                <select className={sel} value={cat} onChange={(e) => setCat(e.target.value)}>
                  <option value="">All SKU categories</option>
                  {by("category").map((r) => <option key={r.code} value={r.code}>{r.code} · {r.label}</option>)}
                </select>
                <select className={sel} value={pack} onChange={(e) => setPack(e.target.value)}>
                  <option value="">All packaging</option>
                  {by("packaging").map((r) => <option key={r.code} value={r.code}>{r.code} · {r.label}</option>)}
                </select>
                <select className={`${sel} sm:hidden`} value={sort} onChange={(e) => setSort(e.target.value)}>
                  {SORTS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
                </select>
              </div>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearAll}>
                  <X className="h-3.5 w-3.5 mr-1" />Clear filters
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((p) => {
          const matched = aliasById.get(p.id);
          const dept = deptSummary(p);
          const uomS = uomSummary(p);
          const moqS = moqSummary(p);
          const snapshot = readinessByProduct.get(p.id);
          const readiness = authorityReady ? (snapshot?.readiness ?? null) : null;
          const heroUrl = resolveProductCardHeroUrl(p, mediaByProduct[p.id] ?? []);
          const pricingComplete = readiness
            ? dimensionIsComplete(readiness, "pricing_status")
            : false;
          const mediaComplete = readiness
            ? dimensionIsComplete(readiness, "media_status")
            : false;
          const mediaLabel = readiness
            ? dimensionCardLabel(readiness, "media_status")
            : mediaGovernanceStatusLine({ heroUrl, derivedStatus: p.media_status });
          const complianceComplete = readiness
            ? dimensionIsComplete(readiness, "compliance_status")
            : false;
          return (
            <div key={p.id} className="luxe-card flex flex-col relative">
              <div className="absolute top-2 right-2 z-10">
                <ProductActionsMenu
                  product={p}
                  onChanged={reloadProducts}
                  className="h-8 w-8 bg-background/80 backdrop-blur-sm hover:bg-background"
                />
              </div>
              <Link to={`/products/${p.id}`} className="flex flex-col flex-1 min-w-0">
              <div className="luxe-media relative">
                {heroUrl
                  ? <img src={heroUrl} alt={productDisplayName(p)} loading="lazy" className={heroUrl.includes("/_pdf_pages/") ? "opacity-60" : ""} />
                  : <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-secondary to-accent-soft/40"><ImageIcon className="h-10 w-10 text-accent/30" /></div>}
                {(heroUrl?.includes("/_pdf_pages/") || !heroUrl) && (
                  <span className="absolute top-2 left-2 text-[10px] bg-warning text-warning-foreground px-2 py-0.5 rounded-full font-medium">Photo needed</span>
                )}
              </div>
              <div className="p-4 sm:p-5 flex-1 flex flex-col min-w-0 space-y-3">
                <div className="flex items-start justify-between gap-2 min-w-0 pr-8">
                  <div className="min-w-0 flex-1">
                    <div className="luxe-sub mb-1 truncate">{p.category || p.product_type || "—"}</div>
                    <div className="font-display text-lg leading-tight truncate">{productDisplayName(p)}</div>
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5 font-mono min-w-0">
                      <span className="truncate">{p.sku}</span>
                      <button onClick={(e) => copy(e, p.sku)} className="hover:text-foreground shrink-0"><Copy className="h-3 w-3" /></button>
                    </div>
                  </div>
                  {p.is_sample && <span className="badge-soft bg-accent-soft text-accent-foreground shrink-0">Sample</span>}
                </div>

                {matched && <div className="text-[11px] text-accent">Matched by alias: <span className="font-medium">{matched}</span></div>}

              {p.archived_at && (
                <div className="text-[11px] text-muted-foreground">Archived · hidden from default search</div>
              )}

              {duplicateSignalsByProduct.get(p.id)?.map((signal) => (
                <div key={`${signal.kind}-${signal.otherProductId}`} className="text-[11px] text-warning">
                  {duplicateKindLabel(signal.kind)}: {signal.matchedValue} · {signal.otherLabel}
                </div>
              ))}

              {/* Identity + ops badges */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {p.product_class && <Badge tone="primary"><Layers className="h-3 w-3" />{labelOf(PRODUCT_CLASSES, p.product_class)}</Badge>}
                {dept && <Badge tone="muted"><Package className="h-3 w-3" />{dept}</Badge>}
              </div>

              {/* Commercial line */}
              <div className="text-xs text-muted-foreground space-y-0.5 mb-3">
                {uomS && <div>{uomS}</div>}
                {moqS && <div>{moqS}</div>}
                {!uomS && !moqS && <div>{p.pack_size || "—"} · {p.shelf_life_days ? `${p.shelf_life_days}d shelf` : "—"}</div>}
              </div>

              {/* Flags + readiness */}
              <div className="flex flex-wrap gap-1.5">
                {p.private_label_allowed && <Badge tone="accent"><Tag className="h-3 w-3" />Private label</Badge>}
                {p.bom_required && <Badge tone="accent"><Boxes className="h-3 w-3" />BOM</Badge>}
                {p.fixed_carton_required && <Badge tone="muted"><Package className="h-3 w-3" />Closed carton</Badge>}
                {moqCounts[p.id] > 0 && <Badge tone="primary" title={`${moqCounts[p.id]} channel MOQ rules`}>MOQ rules · {moqCounts[p.id]}</Badge>}
                {priceCounts[p.id]?.total > 0 && readiness && (
                  <Badge
                    tone={pricingComplete ? "ok" : "warn"}
                    title={`Pricing: ${dimensionCardLabel(readiness, "pricing_status")}`}
                  >
                    {pricingComplete ? "Approved price" : "Needs pricing"} · {priceCounts[p.id].total}
                  </Badge>
                )}
                <Badge
                  tone={mediaComplete || heroUrl ? "ok" : "warn"}
                  title={
                    readiness
                      ? `Media: ${mediaLabel}`
                      : heroUrl
                        ? "hero present"
                        : mediaLabel
                  }
                >
                  <ImageIcon className="h-3 w-3" />
                  {mediaLabel}
                </Badge>
                {readiness && (
                  <Badge
                    tone={complianceComplete ? "ok" : "warn"}
                    title={`Compliance: ${dimensionCardLabel(readiness, "compliance_status")}`}
                  >
                    GST/HSN · {dimensionCardLabel(readiness, "compliance_status")}
                  </Badge>
                )}
                {readinessUnavailable && authorityReady ? (
                  <Badge tone="muted" title="Readiness side tables could not be loaded">
                    Readiness unavailable
                  </Badge>
                ) : (
                  <ReadinessBadge
                    product={p}
                    readiness={readiness}
                    compact
                    loading={!authorityReady}
                    statusOpts={{
                      catalogueVersionApproved: catalogueApprovedByProduct[p.id],
                      pricingRows: pricingByProduct[p.id],
                      moqRows: moqByProduct[p.id],
                    }}
                  />
                )}
              </div>
              </div>
              </Link>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12 space-y-3">
            <div className="text-muted-foreground text-sm">
              {q.trim()
                ? "No products found by this name, SKU, or alias. Try another spelling."
                : productsLoadError
                  ? "Could not load products. Check your connection and try again."
                  : "No products match these filters."}
            </div>
            {activeFilterCount > 0 && (
              <Button variant="outline" size="sm" onClick={clearAll}>
                <X className="h-3.5 w-3.5 mr-1" />Clear filters
              </Button>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default Products;
