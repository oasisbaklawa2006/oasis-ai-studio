import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { BookOpen, GripVertical, Plus, Star, Trash2, MessageCircle, FileDown, QrCode } from "lucide-react";
import {
  CATALOGUE_COLLECTION_TYPES,
  type CatalogueCollectionType,
  type CatalogueProductCard,
} from "@/features/catalogueBuilder/types";
import {
  addProductToCollection,
  buildPublicCatalogueUrl,
  createCollection,
  createCatalogueShareLink,
  getCollectionsPersistenceSource,
  listCollectionItems,
  listCollections,
  removeProductFromCollection,
  reorderCollectionItems,
  transitionCollection,
} from "@/features/catalogueBuilder/collectionStore";
import { AuthorityStatusBadges } from "@/components/catalogueAuthority/AuthorityStatusBadges";
import { getCollectionsLoadFailure } from "@/lib/catalogueAuthority/dataSource";
import { LocalCatalogueFallbackDisabledError } from "@/lib/catalogueAuthority/localStoragePolicy";
import { formatSupabaseDiagnostic } from "@/lib/supabase/diagnostics";
import { resolveProductHeroUrl } from "@/lib/productImage";
import { evaluateCataloguePublishability } from "@/features/catalogueBuilder/cataloguePublishability";
import { generateWhatsAppMiniCatalogueText } from "@/features/catalogueBuilder/whatsappPreview";
import { prepareCatalogueExport } from "@/features/catalogueBuilder/catalogueExport";
import {
  CATALOGUE_AUDIENCES,
  CATALOGUE_EXPORT_PROFILES,
  type CatalogueAudience,
} from "@/features/catalogueBuilder/exportProfiles";
import { mediaAssetsFromSources } from "@/features/mediaReadiness/mediaAssetsFromForm";
import { selectApprovedImageUrlsForCentral } from "@/features/mediaReadiness/mediaReadinessEngine";
import { getChannelPrice } from "@/features/productTruth/channelPricingMoqEngine";
import { mapPricingRules, type PricingRuleRow } from "@/features/productTruth/channelAuthorityMappers";
import type { ChannelPriceRecord } from "@/features/productTruth/types";
import type { ProductMediaRow } from "@/features/mediaReadiness/mediaAssetsFromForm";
import { deriveComplianceApprovedForReadiness } from "@/shared/ai/compliancePersistence";
import type { ExtendedDatabase } from "@/integrations/supabase/types.extensions";

const catalogueDb = supabase as unknown as import("@supabase/supabase-js").SupabaseClient<ExtendedDatabase>;

type ProductRow = {
  id: string;
  product_name: string | null;
  sku: string | null;
  category: string | null;
  short_description: string | null;
  hero_image_url?: string | null;
  image_url?: string | null;
  product_class?: string | null;
  product_type?: string | null;
  media_status?: string | null;
  hsn_code?: string | null;
  gst_rate?: number | null;
  mrp?: number | null;
  b2b_price?: number | null;
  export_price?: number | null;
  primary_uom?: string | null;
  is_catalogue_ready?: boolean | null;
};

function productToForm(row: ProductRow): Record<string, unknown> {
  return {
    id: row.id,
    product_name: row.product_name,
    sku: row.sku,
    category: row.category,
    short_description: row.short_description,
    hero_image_url: resolveProductHeroUrl(row),
    product_class: row.product_class,
    product_type: row.product_type,
    media_status: row.media_status,
    hsn_code: row.hsn_code,
    gst_rate: row.gst_rate,
    mrp: row.mrp,
    b2b_price: row.b2b_price,
    export_price: row.export_price,
    primary_uom: row.primary_uom,
  };
}

function rowToCard(
  row: ProductRow,
  featured: boolean,
  prices: ChannelPriceRecord[],
  mediaRows: ProductMediaRow[],
  catalogueVersionStatus: string | null,
): CatalogueProductCard {
  const form = productToForm(row);
  const complianceApproved = deriveComplianceApprovedForReadiness(form);
  const pub = evaluateCataloguePublishability({
    form,
    complianceApproved,
    prices,
    productMediaRows: mediaRows,
    catalogueVersionStatus,
  });
  const assets = mediaAssetsFromSources({ form, productMediaRows: mediaRows });
  const urls = selectApprovedImageUrlsForCentral(assets);
  const price = getChannelPrice(prices.filter((rule) => rule.priceStatus === "approved"), "retail");

  return {
    productId: row.id,
    name: row.product_name ?? "Unnamed",
    sku: row.sku,
    category: row.category,
    description: row.short_description,
    imageUrl: urls[0] ?? (row.hero_image_url as string) ?? (row.image_url as string) ?? null,
    mrp: price?.mrp ?? null,
    sellingPrice: price?.sellingPrice ?? null,
    moqLabel: null,
    isFeatured: featured,
    publishable: pub.publishable,
    blockers: pub.blockers,
    imageStatus: urls[0] || row.hero_image_url || row.image_url ? "ready" : "missing",
  };
}

function audienceForCollectionType(type: CatalogueCollectionType): CatalogueAudience {
  if (type === "retail_catalogue") return "b2c";
  if (type === "export_catalogue") return "export";
  if (type === "whatsapp_mini_catalogue") return "whatsapp";
  return "b2b";
}

export default function CatalogueBuilder() {
  const [collections, setCollections] = useState<Awaited<ReturnType<typeof listCollections>>>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [items, setItems] = useState<Awaited<ReturnType<typeof listCollectionItems>>>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [pricingByProduct, setPricingByProduct] = useState<Record<string, ChannelPriceRecord[]>>({});
  const [mediaByProduct, setMediaByProduct] = useState<Record<string, ProductMediaRow[]>>({});
  const [versionStatusById, setVersionStatusById] = useState<Record<string, string | null>>({});
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<CatalogueCollectionType>("b2b_catalogue");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [whatsappText, setWhatsappText] = useState("");
  const [loading, setLoading] = useState(false);
  const [transitionPending, setTransitionPending] = useState(false);
  const [exportAudience, setExportAudience] = useState<CatalogueAudience>("b2b");
  const [persistenceSource, setPersistenceSource] = useState(
    getCollectionsPersistenceSource(),
  );
  const [collectionsError, setCollectionsError] = useState(
    getCollectionsLoadFailure(),
  );

  const selected = collections.find((c) => c.id === selectedId) ?? null;

  useEffect(() => {
    if (selected) setExportAudience(audienceForCollectionType(selected.catalogue_type));
  }, [selected]);

  const refreshCollections = useCallback(async () => {
    const rows = await listCollections();
    setCollections(rows);
    setPersistenceSource(getCollectionsPersistenceSource());
    setCollectionsError(getCollectionsLoadFailure());
    if (!selectedId && rows[0]) setSelectedId(rows[0].id);
  }, [selectedId]);

  const refreshItems = useCallback(async () => {
    if (!selectedId) return;
    setItems(await listCollectionItems(selectedId));
  }, [selectedId]);

  useEffect(() => {
    void refreshCollections();
    supabase
      .from("products")
      .select("id, product_name, sku, category, short_description, hero_image_url, image_url, product_class, product_type, media_status, hsn_code, gst_rate, mrp, b2b_price, export_price, primary_uom, is_catalogue_ready")
      .eq("is_active", true)
      .order("product_name")
      .then(({ data }) => setProducts((data as ProductRow[]) ?? []));
  }, [refreshCollections]);

  useEffect(() => {
    void refreshItems();
  }, [refreshItems]);

  useEffect(() => {
    const productIds = items.map((item) => item.product_id);
    if (!productIds.length) {
      setPricingByProduct({});
      setMediaByProduct({});
      setVersionStatusById({});
      return;
    }
    let cancelled = false;
    void Promise.all([
      supabase.from("product_pricing_rules").select("*").in("product_id", productIds),
      supabase.from("product_media").select("*").in("product_id", productIds),
      items.some((item) => item.catalogue_version_id)
        ? catalogueDb
            .from("catalogue_versions")
            .select("id, status")
            .in("id", items.flatMap((item) => item.catalogue_version_id ? [item.catalogue_version_id] : []))
        : Promise.resolve({ data: [], error: null }),
    ]).then(([pricingResult, mediaResult, versionResult]) => {
      if (cancelled) return;
      const pricingMap: Record<string, PricingRuleRow[]> = {};
      for (const row of (pricingResult.data ?? []) as PricingRuleRow[]) {
        const productId = String(row.product_id ?? "");
        if (!productId) continue;
        (pricingMap[productId] ??= []).push(row);
      }
      setPricingByProduct(Object.fromEntries(
        Object.entries(pricingMap).map(([productId, rows]) => [productId, mapPricingRules(rows)]),
      ));
      const mediaMap: Record<string, ProductMediaRow[]> = {};
      for (const row of (mediaResult.data ?? []) as ProductMediaRow[]) {
        const productId = String(row.product_id ?? "");
        if (!productId) continue;
        (mediaMap[productId] ??= []).push(row);
      }
      setMediaByProduct(mediaMap);
      setVersionStatusById(Object.fromEntries(
        ((versionResult.data ?? []) as Array<{ id: string; status: string }>).map((row) => [row.id, row.status]),
      ));
    });
    return () => { cancelled = true; };
  }, [items]);

  const cards = useMemo(() => {
    const productMap = new Map(products.map((p) => [p.id, p]));
    return items
      .map((item) => {
        const row = productMap.get(item.product_id);
        if (!row) return null;
        return rowToCard(
          row,
          item.is_featured,
          pricingByProduct[row.id] ?? [],
          mediaByProduct[row.id] ?? [],
          item.catalogue_version_id ? versionStatusById[item.catalogue_version_id] ?? null : null,
        );
      })
      .filter(Boolean) as CatalogueProductCard[];
  }, [items, mediaByProduct, pricingByProduct, products, versionStatusById]);

  const exportInput = useMemo(() => selected ? {
    title: selected.title,
    subtitle: selected.catalogue_type.replace(/_/g, " "),
    products: cards,
    audience: exportAudience,
    metadata: {
      version: items.find((item) => item.catalogue_version_id)?.catalogue_version_id ?? "draft",
      generatedAt: selected.updated_at,
      sourceCollectionId: selected.id,
      sourceRevision: selected.updated_at,
    },
  } : null, [cards, exportAudience, items, selected]);

  const exportPreparation = useMemo(
    () => exportInput ? prepareCatalogueExport(exportInput) : null,
    [exportInput],
  );
  const collectionReady = cards.length > 0 && cards.every((card) => card.publishable);

  const createNew = async () => {
    if (!newTitle.trim()) return toast.error("Title required");
    try {
      const row = await createCollection({
        title: newTitle.trim(),
        catalogue_type: newType,
        channel: newType.replace("_catalogue", ""),
      });
      setNewTitle("");
      await refreshCollections();
      setSelectedId(row.id);
      toast.success("Collection created");
    } catch (e) {
      toast.error(
        e instanceof LocalCatalogueFallbackDisabledError
          ? "Supabase required to create collections. Local fallback is disabled."
          : e instanceof Error
            ? e.message
            : "Could not create collection",
      );
    }
  };

  const addProduct = async (productId: string) => {
    if (!selectedId || selected?.status !== "draft") return;
    try {
      const result = await addProductToCollection({
        collectionId: selectedId,
        expectedRevision: selected.revision,
        productId,
      });
      setCollections((current) => current.map((collection) =>
        collection.id === result.collection_id
          ? { ...collection, revision: result.revision }
          : collection,
      ));
      await Promise.all([refreshItems(), refreshCollections()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add product");
    }
  };

  const removeItem = async (productId: string) => {
    if (!selectedId || selected?.status !== "draft") return;
    try {
      const item = items.find((candidate) => candidate.product_id === productId);
      if (!item) throw new Error("Collection item not found; refresh and try again");
      const result = await removeProductFromCollection(selectedId, selected.revision, item.id);
      setCollections((current) => current.map((collection) =>
        collection.id === result.collection_id
          ? { ...collection, revision: result.revision }
          : collection,
      ));
      await Promise.all([refreshItems(), refreshCollections()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove product");
    }
  };

  const moveItem = async (productId: string, dir: -1 | 1) => {
    if (selected?.status !== "draft") return;
    const ids = items.map((i) => i.product_id);
    const idx = ids.indexOf(productId);
    if (idx < 0) return;
    const next = idx + dir;
    if (next < 0 || next >= ids.length) return;
    const swapped = [...ids];
    [swapped[idx], swapped[next]] = [swapped[next], swapped[idx]];
    try {
      const result = await reorderCollectionItems(selectedId!, selected.revision, swapped);
      setCollections((current) => current.map((collection) =>
        collection.id === result.collection_id
          ? { ...collection, revision: result.revision }
          : collection,
      ));
      await Promise.all([refreshItems(), refreshCollections()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reorder products");
    }
  };

  const runWhatsappPreview = () => {
    if (!selected) return;
    const text = generateWhatsAppMiniCatalogueText({
      title: selected.title,
      products: cards,
      shareUrl,
    });
    setWhatsappText(text);
  };

  const runPdfExport = async () => {
    if (!selected || !exportInput || !exportPreparation) return;
    if (!exportPreparation.preflight.ready) {
      toast.error("Export blocked by preflight errors");
      return;
    }
    setLoading(true);
    try {
      const { downloadCataloguePdf, exportCataloguePdf } = await import("@/features/catalogueBuilder/pdfExport");
      const blob = await exportCataloguePdf(exportInput);
      downloadCataloguePdf(blob, exportPreparation.filename);
      const warningCount = exportPreparation.preflight.issues.filter((issue) => issue.severity === "warning").length;
      toast.success(warningCount ? `PDF exported with ${warningCount} preflight warning(s)` : "PDF exported");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF export failed");
    } finally {
      setLoading(false);
    }
  };

  const createSharePlaceholder = async () => {
    if (!selectedId) return;
    try {
      const link = await createCatalogueShareLink(selectedId, "qr");
      const url = buildPublicCatalogueUrl(link.share_token);
      setShareUrl(url);
      toast.success("Active share URL created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create share link");
    }
  };

  const transitionSelected = async (next: "draft" | "internal_review" | "published") => {
    if (!selected || transitionPending) return;
    if ((next === "internal_review" && selected.status === "draft") || next === "published") {
      if (!collectionReady) return;
    }
    setTransitionPending(true);
    try {
      const updated = await transitionCollection(selected.id, selected.revision, next);
      setCollections((current) => current.map((collection) =>
        collection.id === updated.id ? updated : collection,
      ));
      if (selected.status === "published" && next === "internal_review") {
        setShareUrl(null);
      }
      await refreshCollections();
      toast.success(
        next === "published"
          ? "Collection published"
          : next === "draft"
            ? "Collection returned to draft"
            : selected.status === "published"
              ? "Published collection reopened for review"
              : "Collection submitted for internal review",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Collection transition failed");
      await refreshCollections();
    } finally {
      setTransitionPending(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Catalogue Builder"
        subtitle="Curate publishable collections — media readiness, preview cards, WhatsApp & PDF export foundation."
      />

      <div className="mb-4 space-y-2">
        <AuthorityStatusBadges
          show={{
            local_only: persistenceSource === "local_only",
            not_synced_to_central: true,
            central_live_write_disabled: true,
          }}
        />
        {persistenceSource === "supabase_unavailable" && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive space-y-1">
            <p className="font-medium">Catalogue collections unavailable</p>
            <p>
              {collectionsError
                ? formatSupabaseDiagnostic(collectionsError, "Catalogue collections query failed")
                : "Catalogue collections query failed. This may be caused by a missing table, RLS policy, or deployment mismatch. Supabase itself is reachable."}
            </p>
            {collectionsError?.kind === "missing_table" && (
              <p className="text-muted-foreground">
                Tables expected: <code className="text-[10px]">catalogue_collections</code>,{" "}
                <code className="text-[10px]">catalogue_collection_items</code>,{" "}
                <code className="text-[10px]">catalogue_share_links</code>.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        <aside className="lg:col-span-4 space-y-4">
          <div className="card-elevated p-4 space-y-3">
            <Label>New collection</Label>
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Summer B2B 2026"
            />
            <select
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              value={newType}
              onChange={(e) => setNewType(e.target.value as CatalogueCollectionType)}
            >
              {CATALOGUE_COLLECTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <Button className="w-full rounded-full" size="sm" onClick={() => void createNew()}>
              <Plus className="h-3 w-3 mr-1" /> Create
            </Button>
          </div>

          <div className="card-elevated p-2 space-y-1 max-h-64 overflow-auto">
            {collections.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                  c.id === selectedId ? "bg-accent-soft font-medium" : "hover:bg-muted/50"
                }`}
              >
                {c.title}
                <span className="block text-[10px] text-muted-foreground">{c.catalogue_type}</span>
              </button>
            ))}
          </div>
        </aside>

        <main className="lg:col-span-8 space-y-4">
          {selected ? (
            <>
              <div className="card-elevated p-4 flex flex-wrap gap-2 justify-between items-start">
                <div>
                  <h2 className="font-display text-2xl">{selected.title}</h2>
                  <p className="text-xs text-muted-foreground">
                    {selected.catalogue_type} · {selected.status} · revision {selected.revision}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <label className="sr-only" htmlFor="catalogue-export-audience">Export audience</label>
                  <select
                    id="catalogue-export-audience"
                    className="h-9 px-3 rounded-md border border-input bg-background text-xs"
                    value={exportAudience}
                    onChange={(event) => setExportAudience(event.target.value as CatalogueAudience)}
                  >
                    {CATALOGUE_AUDIENCES.map((audience) => (
                      <option key={audience} value={audience}>{CATALOGUE_EXPORT_PROFILES[audience].label}</option>
                    ))}
                  </select>
                  <Button size="sm" variant="outline" onClick={runWhatsappPreview}>
                    <MessageCircle className="h-3 w-3 mr-1" /> WhatsApp preview
                  </Button>
                  {selected.status === "draft" && (
                    <Button
                      size="sm"
                      onClick={() => void transitionSelected("internal_review")}
                      disabled={!collectionReady || transitionPending}
                    >
                      Submit review
                    </Button>
                  )}
                  {selected.status === "internal_review" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void transitionSelected("draft")}
                        disabled={transitionPending}
                      >
                        Return to draft
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => void transitionSelected("published")}
                        disabled={!collectionReady || transitionPending}
                      >
                        Publish reviewed
                      </Button>
                    </>
                  )}
                  {selected.status === "published" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void transitionSelected("internal_review")}
                      disabled={transitionPending}
                    >
                      Reopen review
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void createSharePlaceholder()}
                    disabled={selected.status !== "published"}
                  >
                    <QrCode className="h-3 w-3 mr-1" /> Share URL
                  </Button>
                  <Button size="sm" variant="secondary" disabled={loading} onClick={() => void runPdfExport()}>
                    <FileDown className="h-3 w-3 mr-1" /> Export PDF
                  </Button>
                </div>
              </div>

              {exportPreparation && (
                <div className="card-elevated p-4 space-y-2" aria-live="polite">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <Label className="text-xs">Export preflight</Label>
                      <p className="text-[11px] text-muted-foreground">
                        {exportPreparation.profile.label} · {exportPreparation.plan.pages.length} pages · {exportPreparation.plan.productCount} products
                      </p>
                    </div>
                    <Badge variant="outline" className={exportPreparation.preflight.issues.length ? "text-warning border-warning/30" : "text-success border-success/30"}>
                      {exportPreparation.preflight.issues.length ? `${exportPreparation.preflight.issues.length} review item(s)` : "Print checks passed"}
                    </Badge>
                  </div>
                  {exportPreparation.preflight.issues.slice(0, 5).map((issue, index) => (
                    <p key={`${issue.productId ?? "catalogue"}-${issue.code}-${index}`} className="text-[10px] text-muted-foreground">
                      {issue.message}
                    </p>
                  ))}
                  {exportPreparation.preflight.issues.length > 5 && (
                    <p className="text-[10px] text-muted-foreground">+{exportPreparation.preflight.issues.length - 5} more preflight items</p>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    Print quality is certified only when source dimensions meet the selected profile. Unknown or undersized media is never labelled UHD.
                  </p>
                </div>
              )}

              <div className="card-elevated p-4">
                <Label className="text-xs">Add product to collection review</Label>
                <select
                  className="w-full h-10 mt-1 px-3 rounded-md border border-input bg-background text-sm"
                  defaultValue=""
                  disabled={selected.status !== "draft"}
                  onChange={(e) => {
                    if (e.target.value) void addProduct(e.target.value);
                    e.target.value = "";
                  }}
                >
                  <option value="">
                    {selected.status === "draft" ? "Select product…" : "Return collection to draft to change products"}
                  </option>
                  {products
                    .filter((p) => !items.some((i) => i.product_id === p.id))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.product_name} {p.sku ? `(${p.sku})` : ""}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {cards.map((card) => (
                  <article
                    key={card.productId}
                    className={`card-elevated overflow-hidden ${!card.publishable ? "opacity-80 border-warning/30" : ""}`}
                  >
                    {card.imageUrl ? (
                      <img src={card.imageUrl} alt="" className="h-32 w-full object-cover" />
                    ) : (
                      <div className="h-32 bg-muted flex items-center justify-center text-xs text-muted-foreground">
                        No image
                      </div>
                    )}
                    <div className="p-3 space-y-2">
                      <div className="flex justify-between gap-2">
                        <h3 className="font-medium text-sm leading-tight">{card.name}</h3>
                        {card.isFeatured && <Star className="h-3 w-3 text-accent shrink-0" />}
                      </div>
                      {card.sku && <p className="text-[10px] font-mono text-muted-foreground">{card.sku}</p>}
                      <p className="text-[10px] font-mono text-muted-foreground break-all">
                        Pinned version: {items.find((item) => item.product_id === card.productId)?.catalogue_version_id ?? "missing"}
                      </p>
                      {!card.publishable && (
                        <Badge variant="outline" className="text-[10px] text-warning border-warning/30">
                          Not publishable
                        </Badge>
                      )}
                      {card.blockers.slice(0, 2).map((b) => (
                        <p key={b} className="text-[10px] text-destructive">
                          {b}
                        </p>
                      ))}
                      <div className="flex gap-1 pt-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => void moveItem(card.productId, -1)}
                          disabled={selected.status !== "draft"}
                          aria-label={`Move ${card.name}`}
                        >
                          <GripVertical className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => void removeItem(card.productId)}
                          disabled={selected.status !== "draft"}
                          aria-label={`Remove ${card.name}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              {whatsappText && (
                <div className="card-elevated p-4">
                  <Label className="text-xs">WhatsApp mini catalogue preview</Label>
                  <Textarea readOnly rows={8} value={whatsappText} className="mt-2 font-mono text-xs" />
                </div>
              )}

              {shareUrl && (
                <p className="text-xs text-muted-foreground font-mono break-all">
                  Active public catalogue URL: {shareUrl}
                </p>
              )}
            </>
          ) : (
            <div className="catalogue-empty card-elevated p-8 text-center">
              <BookOpen className="h-10 w-10 mx-auto text-accent/60 mb-3" />
              <p className="text-sm text-muted-foreground">Create or select a collection to start building.</p>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
