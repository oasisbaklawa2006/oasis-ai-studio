import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Download,
  FileText,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCw,
  Share2,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { AuthorityStatusBadges } from "@/components/catalogueAuthority/AuthorityStatusBadges";
import { PageHeader } from "@/components/PageHeader";
import { SharePanel } from "@/components/SharePanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  addProductToCollection,
  buildShareUrlPlaceholder,
  createCollection,
  createShareLinkPlaceholder,
  getCollectionsPersistenceSource,
  listCollectionItems,
  listCollections,
  removeProductFromCollection,
  reorderCollectionItems,
  updateCollectionItem,
} from "@/features/catalogueBuilder/collectionStore";
import {
  buildPrintComposition,
  validateCompositionForPrint,
} from "@/features/catalogueBuilder/printComposition";
import {
  defaultTemplateForCollectionType,
  getPrintTemplate,
  PRINT_TEMPLATES,
  type PrintTemplateId,
} from "@/features/catalogueBuilder/printTemplates";
import {
  createPrintCatalogueSnapshot,
  listPrintSnapshots,
  savePrintSnapshot,
} from "@/features/catalogueBuilder/printSnapshot";
import { downloadCataloguePdf, exportPrintCataloguePdf } from "@/features/catalogueBuilder/pdfExport";
import { buildCatalogueProductCard } from "@/features/catalogueBuilder/productCardBuilder";
import { generateWhatsAppMiniCatalogueText } from "@/features/catalogueBuilder/whatsappPreview";
import {
  CATALOGUE_COLLECTION_TYPES,
  type CatalogueCollectionItemRow,
  type CatalogueCollectionRow,
  type CatalogueCollectionType,
  type CatalogueProductCard,
} from "@/features/catalogueBuilder/types";
import { getCollectionsLoadFailure } from "@/lib/catalogueAuthority/dataSource";
import { resolveProductCardHeroUrl } from "@/lib/productImage";
import {
  fetchProductAuthorityBundle,
  fetchProductsForMasterList,
} from "@/features/productMaster/productListFetch";
import { productDisplayName, productVisibleInActiveView } from "@/features/productMaster/productListModel";

const COLLECTION_TYPE_LABELS: Record<CatalogueCollectionType, string> = {
  b2b_catalogue: "B2B Catalogue",
  retail_catalogue: "Retail Catalogue",
  export_catalogue: "Export Catalogue",
  franchise_catalogue: "Franchise Catalogue",
  wedding_catalogue: "Wedding Catalogue",
  corporate_catalogue: "Corporate Catalogue",
  whatsapp_mini_catalogue: "WhatsApp Mini",
  qr_exhibition_catalogue: "QR / Exhibition",
  seasonal_catalogue: "Seasonal Catalogue",
};

export default function CatalogueBuilder() {
  const [collections, setCollections] = useState<CatalogueCollectionRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [items, setItems] = useState<CatalogueCollectionItemRow[]>([]);
  const [products, setProducts] = useState<Array<Record<string, unknown> & { id: string }>>([]);
  const [authorityBundle, setAuthorityBundle] = useState<Awaited<
    ReturnType<typeof fetchProductAuthorityBundle>
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<CatalogueCollectionType>("b2b_catalogue");
  const [templateId, setTemplateId] = useState<PrintTemplateId>("b2b_classic");
  const [addProductId, setAddProductId] = useState("");
  const [whatsappText, setWhatsappText] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [snapshots, setSnapshots] = useState<ReturnType<typeof listPrintSnapshots>>([]);

  const activeCollection = collections.find((c) => c.id === activeId) ?? null;
  const persistenceSource = getCollectionsPersistenceSource();
  const loadFailure = getCollectionsLoadFailure();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [cols, prodRes, bundle] = await Promise.all([
        listCollections(),
        fetchProductsForMasterList({ showArchived: false }),
        fetchProductAuthorityBundle(),
      ]);
      setCollections(cols);
      setProducts(
        prodRes.products.filter((p) => productVisibleInActiveView(p)) as Array<
          Record<string, unknown> & { id: string }
        >,
      );
      setAuthorityBundle(bundle);
      if (!activeId && cols.length) setActiveId(cols[0].id);
    } finally {
      setLoading(false);
    }
  }, [activeId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!activeId) {
      setItems([]);
      return;
    }
    listCollectionItems(activeId).then(setItems);
    setSnapshots(listPrintSnapshots(activeId));
  }, [activeId]);

  useEffect(() => {
    if (activeCollection) {
      setTemplateId(defaultTemplateForCollectionType(activeCollection.catalogue_type));
    }
  }, [activeCollection?.id, activeCollection?.catalogue_type]);

  const productCards: CatalogueProductCard[] = useMemo(() => {
    if (!authorityBundle) return [];
    const productMap = new Map(products.map((p) => [p.id, p]));
    return items
      .map((item) => {
        const product = productMap.get(item.product_id);
        if (!product) return null;
        return buildCatalogueProductCard({
          product,
          item,
          mediaRows: authorityBundle.mediaByProduct[item.product_id],
          pricingRows: authorityBundle.pricingByProduct[item.product_id],
          moqRows: authorityBundle.moqByProduct[item.product_id],
          catalogueVersionStatus: authorityBundle.catalogueApprovedByProduct[item.product_id]
            ? "synced"
            : null,
          channel: activeCollection?.channel,
        });
      })
      .filter(Boolean) as CatalogueProductCard[];
  }, [items, products, authorityBundle, activeCollection?.channel]);

  const composition = useMemo(() => {
    if (!activeCollection) return null;
    return buildPrintComposition({
      collection: activeCollection,
      items,
      cards: productCards,
      templateId,
    });
  }, [activeCollection, items, productCards, templateId]);

  const printValidation = useMemo(() => {
    if (!composition) return null;
    return validateCompositionForPrint(composition, productCards);
  }, [composition, productCards]);

  const availableProducts = useMemo(() => {
    const inCollection = new Set(items.map((i) => i.product_id));
    return products.filter((p) => !inCollection.has(p.id));
  }, [products, items]);

  const handleCreateCollection = async () => {
    if (!newTitle.trim()) {
      toast.error("Enter a collection title");
      return;
    }
    const col = await createCollection({
      title: newTitle.trim(),
      catalogue_type: newType,
    });
    setCollections((prev) => [col, ...prev]);
    setActiveId(col.id);
    setNewTitle("");
    toast.success("Collection created");
  };

  const handleAddProduct = async () => {
    if (!activeId || !addProductId) return;
    try {
      await addProductToCollection({ collectionId: activeId, productId: addProductId });
      const next = await listCollectionItems(activeId);
      setItems(next);
      setAddProductId("");
      toast.success("Product added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add product");
    }
  };

  const handleRemove = async (productId: string) => {
    if (!activeId) return;
    await removeProductFromCollection(activeId, productId);
    setItems(await listCollectionItems(activeId));
  };

  const moveProduct = async (productId: string, direction: -1 | 1) => {
    if (!activeId) return;
    const ids = items
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((i) => i.product_id);
    const idx = ids.indexOf(productId);
    const swap = idx + direction;
    if (swap < 0 || swap >= ids.length) return;
    [ids[idx], ids[swap]] = [ids[swap], ids[idx]];
    await reorderCollectionItems(activeId, ids);
    setItems(await listCollectionItems(activeId));
  };

  const handlePriceVisibility = async (
    productId: string,
    visibility: CatalogueCollectionItemRow["price_visibility"],
  ) => {
    if (!activeId) return;
    await updateCollectionItem(activeId, productId, { price_visibility: visibility });
    setItems(await listCollectionItems(activeId));
  };

  const handleWhatsAppPreview = () => {
    if (!activeCollection) return;
    setWhatsappText(
      generateWhatsAppMiniCatalogueText({
        title: activeCollection.title,
        products: productCards,
        shareUrl,
      }),
    );
  };

  const handleShareUrl = async () => {
    if (!activeId || !activeCollection) return;
    const link = await createShareLinkPlaceholder(activeId, "view");
    const url = buildShareUrlPlaceholder(link.share_token);
    setShareUrl(url);
    toast.success("Share link created (placeholder until public resolver is deployed)");
  };

  const handleExportPdf = async () => {
    if (!composition || !activeCollection) return;
    setExporting(true);
    try {
      const existing = listPrintSnapshots(activeCollection.id);
      const snapshot = createPrintCatalogueSnapshot({
        collection: activeCollection,
        items,
        cards: productCards,
        templateId,
        composition,
        existingVersions: existing,
      });
      savePrintSnapshot(snapshot);
      setSnapshots(listPrintSnapshots(activeCollection.id));

      const blob = await exportPrintCataloguePdf({
        composition,
        templateId,
        snapshot,
      });
      downloadCataloguePdf(blob, `${activeCollection.slug}-v${snapshot.versionNumber}.pdf`);
      toast.success(`Print PDF v${snapshot.versionNumber} exported (${snapshot.contentHash})`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF export failed");
    } finally {
      setExporting(false);
    }
  };

  const template = getPrintTemplate(templateId);

  return (
    <>
      <PageHeader
        title="Print Catalogue Builder"
        subtitle="Governed product selection, templates, price visibility, print validation, and deterministic PDF generation."
        actions={
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <div className="mb-6 space-y-3">
        <AuthorityStatusBadges
          show={{
            local_only: persistenceSource === "local_only",
            not_synced_to_central: persistenceSource !== "supabase",
            central_live_write_disabled: true,
          }}
        />
        {loadFailure && (
          <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-sm flex gap-2">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <span>
              Collections persistence: {loadFailure.kind} — {loadFailure.userMessage}
              {persistenceSource === "local_only" && " Using browser-local fallback."}
            </span>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Collections</CardTitle>
              <CardDescription>Select or create a catalogue collection</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {collections.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActiveId(c.id)}
                    className={`w-full text-left rounded-md border p-2 text-sm transition-colors ${
                      c.id === activeId ? "border-accent bg-accent/5" : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="font-medium truncate">{c.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {COLLECTION_TYPE_LABELS[c.catalogue_type]} · {c.status}
                    </div>
                  </button>
                ))}
                {!collections.length && !loading && (
                  <p className="text-sm text-muted-foreground">No collections yet.</p>
                )}
              </div>
              <div className="border-t pt-3 space-y-2">
                <Input
                  placeholder="New collection title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
                <Select value={newType} onValueChange={(v) => setNewType(v as CatalogueCollectionType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATALOGUE_COLLECTION_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{COLLECTION_TYPE_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button className="w-full" size="sm" onClick={handleCreateCollection}>
                  <Plus className="h-4 w-4 mr-1" />Create collection
                </Button>
              </div>
            </CardContent>
          </Card>

          {snapshots.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Print versions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                {snapshots.slice(0, 5).map((s) => (
                  <div key={s.snapshotId} className="rounded border p-2">
                    <div className="font-medium">v{s.versionNumber}</div>
                    <div className="text-muted-foreground font-mono">{s.contentHash}</div>
                    <div className="text-muted-foreground">{new Date(s.createdAt).toLocaleString()}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </aside>

        <main className="space-y-6">
          {!activeCollection ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Create or select a collection to start building a print catalogue.
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>{activeCollection.title}</CardTitle>
                  <CardDescription>
                    {COLLECTION_TYPE_LABELS[activeCollection.catalogue_type]} · {items.length} products
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Print template</label>
                      <Select value={templateId} onValueChange={(v) => setTemplateId(v as PrintTemplateId)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(PRINT_TEMPLATES).map((t) => (
                            <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 items-end">
                      <Button variant="outline" size="sm" onClick={handleWhatsAppPreview}>
                        <MessageCircle className="h-4 w-4 mr-1" />WhatsApp preview
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleShareUrl}>
                        <Share2 className="h-4 w-4 mr-1" />Share URL
                      </Button>
                      <Button size="sm" onClick={handleExportPdf} disabled={exporting || !productCards.length}>
                        {exporting ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4 mr-1" />
                        )}
                        Export print PDF
                      </Button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Select value={addProductId} onValueChange={setAddProductId}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Add governed product…" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableProducts.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {productDisplayName(p)}
                            {p.sku ? ` (${p.sku})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={handleAddProduct} disabled={!addProductId}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {printValidation && (
                <Card className={printValidation.ok ? "border-success/30" : "border-warning/40"}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Print validation
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1">
                    {printValidation.issues.map((issue) => (
                      <p key={issue} className="text-destructive">{issue}</p>
                    ))}
                    {printValidation.warnings.map((w) => (
                      <p key={w} className="text-warning">{w}</p>
                    ))}
                    {printValidation.ok && !printValidation.warnings.length && (
                      <p className="text-success">Ready for production PDF export.</p>
                    )}
                  </CardContent>
                </Card>
              )}

              <Tabs defaultValue="products">
                <TabsList>
                  <TabsTrigger value="products">Products ({productCards.length})</TabsTrigger>
                  <TabsTrigger value="preview">Composition preview</TabsTrigger>
                  {whatsappText && <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>}
                  {shareUrl && <TabsTrigger value="share">Share</TabsTrigger>}
                </TabsList>

                <TabsContent value="products" className="space-y-3 mt-4">
                  {productCards.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Add published products from the master list. Products reference Core truth — no duplicate data.
                    </p>
                  )}
                  {items
                    .slice()
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((item) => {
                      const card = productCards.find((c) => c.productId === item.product_id);
                      const product = products.find((p) => p.id === item.product_id);
                      const hero = product
                        ? resolveProductCardHeroUrl(product, authorityBundle?.mediaByProduct[item.product_id])
                        : null;
                      return (
                        <Card key={item.id}>
                          <CardContent className="p-4 flex gap-4">
                            <div className="w-16 h-16 rounded border bg-muted shrink-0 overflow-hidden">
                              {hero ? (
                                <img src={hero} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                                  No image
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <h3 className="font-medium">{card?.name ?? "Unknown"}</h3>
                                  <p className="text-xs text-muted-foreground">
                                    {card?.sku} · {card?.category}
                                  </p>
                                </div>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="icon" onClick={() => moveProduct(item.product_id, -1)}>
                                    <ArrowUp className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => moveProduct(item.product_id, 1)}>
                                    <ArrowDown className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => handleRemove(item.product_id)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2 items-center">
                                <Select
                                  value={item.price_visibility}
                                  onValueChange={(v) =>
                                    handlePriceVisibility(
                                      item.product_id,
                                      v as CatalogueCollectionItemRow["price_visibility"],
                                    )
                                  }
                                >
                                  <SelectTrigger className="w-36 h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="visible">Price visible</SelectItem>
                                    <SelectItem value="hidden">No price</SelectItem>
                                    <SelectItem value="inquiry">Price on inquiry</SelectItem>
                                  </SelectContent>
                                </Select>
                                {card && !card.publishable && (
                                  <Badge variant="outline" className="text-warning text-xs">
                                    {card.blockers[0] ?? "Not publishable"}
                                  </Badge>
                                )}
                                <Link
                                  to={`/products/${item.product_id}`}
                                  className="text-xs text-accent hover:underline"
                                >
                                  Edit product truth
                                </Link>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                </TabsContent>

                <TabsContent value="preview" className="mt-4">
                  {composition && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Section outline</CardTitle>
                        <CardDescription>
                          {composition.sections.length} sections · {composition.productCount} products · template {template.label}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        {composition.sections.map((s, i) => (
                          <div key={i} className="flex justify-between border-b py-1">
                            <span>
                              <Badge variant="outline" className="mr-2 text-[10px]">{s.kind}</Badge>
                              {s.title ?? s.category ?? (s.products?.length ? `${s.products.length} products` : "")}
                            </span>
                            <span className="text-muted-foreground">p.{s.pageNumber}</span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {whatsappText && (
                  <TabsContent value="whatsapp" className="mt-4">
                    <Textarea readOnly rows={12} value={whatsappText} className="font-mono text-sm" />
                  </TabsContent>
                )}

                {shareUrl && (
                  <TabsContent value="share" className="mt-4">
                    <SharePanel url={shareUrl} title={activeCollection.title} />
                  </TabsContent>
                )}
              </Tabs>
            </>
          )}
        </main>
      </div>
    </>
  );
}
