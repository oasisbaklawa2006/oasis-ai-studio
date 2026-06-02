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
  buildShareUrlPlaceholder,
  createCollection,
  createShareLinkPlaceholder,
  listCollectionItems,
  listCollections,
  removeProductFromCollection,
  reorderCollectionItems,
} from "@/features/catalogueBuilder/collectionStore";
import { evaluateCataloguePublishability } from "@/features/catalogueBuilder/cataloguePublishability";
import { generateWhatsAppMiniCatalogueText } from "@/features/catalogueBuilder/whatsappPreview";
import { downloadCataloguePdf, exportCataloguePdf } from "@/features/catalogueBuilder/pdfExport";
import { mediaAssetsFromForm } from "@/features/mediaReadiness/mediaAssetsFromForm";
import { selectApprovedImageUrlsForCentral } from "@/features/mediaReadiness/mediaReadinessEngine";
import { getChannelPrice } from "@/features/productTruth/channelPricingMoqEngine";

type ProductRow = {
  id: string;
  product_name: string | null;
  sku: string | null;
  category: string | null;
  short_description: string | null;
  hero_image_url?: string | null;
  image_url?: string | null;
};

function productToForm(row: ProductRow): Record<string, unknown> {
  return {
    id: row.id,
    product_name: row.product_name,
    sku: row.sku,
    category: row.category,
    short_description: row.short_description,
    hero_image_url: row.hero_image_url ?? row.image_url,
    media_status: "approved",
  };
}

function rowToCard(row: ProductRow, featured: boolean): CatalogueProductCard {
  const form = productToForm(row);
  const pub = evaluateCataloguePublishability({ form, complianceApproved: true });
  const assets = mediaAssetsFromForm(form);
  const urls = selectApprovedImageUrlsForCentral(assets);
  const price = getChannelPrice([], "retail");

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
  };
}

export default function CatalogueBuilder() {
  const [collections, setCollections] = useState<Awaited<ReturnType<typeof listCollections>>>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [items, setItems] = useState<Awaited<ReturnType<typeof listCollectionItems>>>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<CatalogueCollectionType>("b2b_catalogue");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [whatsappText, setWhatsappText] = useState("");
  const [loading, setLoading] = useState(false);

  const selected = collections.find((c) => c.id === selectedId) ?? null;

  const refreshCollections = useCallback(async () => {
    const rows = await listCollections();
    setCollections(rows);
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
      .select("id, product_name, sku, category, short_description, image_url")
      .eq("is_active", true)
      .order("product_name")
      .then(({ data }) => setProducts((data as ProductRow[]) ?? []));
  }, [refreshCollections]);

  useEffect(() => {
    void refreshItems();
  }, [refreshItems]);

  const cards = useMemo(() => {
    const productMap = new Map(products.map((p) => [p.id, p]));
    return items
      .map((item) => {
        const row = productMap.get(item.product_id);
        if (!row) return null;
        return rowToCard(row, item.is_featured);
      })
      .filter(Boolean) as CatalogueProductCard[];
  }, [items, products]);

  const createNew = async () => {
    if (!newTitle.trim()) return toast.error("Title required");
    const row = await createCollection({
      title: newTitle.trim(),
      catalogue_type: newType,
      channel: newType.replace("_catalogue", ""),
    });
    setNewTitle("");
    await refreshCollections();
    setSelectedId(row.id);
    toast.success("Collection created");
  };

  const addProduct = async (productId: string) => {
    if (!selectedId) return;
    try {
      await addProductToCollection({ collectionId: selectedId, productId });
      await refreshItems();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add product");
    }
  };

  const removeItem = async (productId: string) => {
    if (!selectedId) return;
    await removeProductFromCollection(selectedId, productId);
    await refreshItems();
  };

  const moveItem = async (productId: string, dir: -1 | 1) => {
    const ids = items.map((i) => i.product_id);
    const idx = ids.indexOf(productId);
    if (idx < 0) return;
    const next = idx + dir;
    if (next < 0 || next >= ids.length) return;
    const swapped = [...ids];
    [swapped[idx], swapped[next]] = [swapped[next], swapped[idx]];
    await reorderCollectionItems(selectedId!, swapped);
    await refreshItems();
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
    if (!selected) return;
    setLoading(true);
    try {
      const blob = await exportCataloguePdf({
        title: selected.title,
        subtitle: selected.catalogue_type.replace(/_/g, " "),
        products: cards,
      });
      downloadCataloguePdf(blob, `${selected.slug}.pdf`);
      toast.success("PDF exported");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF export failed");
    } finally {
      setLoading(false);
    }
  };

  const createSharePlaceholder = async () => {
    if (!selectedId) return;
    const link = await createShareLinkPlaceholder(selectedId, "qr");
    const url = buildShareUrlPlaceholder(link.share_token);
    setShareUrl(url);
    toast.success("Share URL placeholder created");
  };

  return (
    <>
      <PageHeader
        title="Catalogue Builder"
        subtitle="Curate publishable collections — media readiness, preview cards, WhatsApp & PDF export foundation."
      />

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
                  <p className="text-xs text-muted-foreground">{selected.catalogue_type} · {selected.status}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={runWhatsappPreview}>
                    <MessageCircle className="h-3 w-3 mr-1" /> WhatsApp preview
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void createSharePlaceholder()}>
                    <QrCode className="h-3 w-3 mr-1" /> Share URL
                  </Button>
                  <Button size="sm" variant="secondary" disabled={loading} onClick={() => void runPdfExport()}>
                    <FileDown className="h-3 w-3 mr-1" /> Export PDF
                  </Button>
                </div>
              </div>

              <div className="card-elevated p-4">
                <Label className="text-xs">Add approved product</Label>
                <select
                  className="w-full h-10 mt-1 px-3 rounded-md border border-input bg-background text-sm"
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) void addProduct(e.target.value);
                    e.target.value = "";
                  }}
                >
                  <option value="">Select product…</option>
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
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => void moveItem(card.productId, -1)}>
                          <GripVertical className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => void removeItem(card.productId)}>
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
                  QR / share placeholder: {shareUrl}
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
