import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MessageCircle, Mail, Printer } from "lucide-react";

type CatalogueView = {
  id?: string;
  title: string;
  subtitle?: string | null;
  client_name?: string | null;
  intro_text?: string | null;
  target_customer_channel?: string | null;
  show_price?: boolean | null;
  show_mrp?: boolean | null;
  show_discount?: boolean | null;
  show_price_label?: string | null;
};

type ProductCard = {
  id: string;
  product_name: string;
  short_description?: string | null;
  category?: string | null;
  product_type?: string | null;
  sku?: string | null;
  pack_size?: string | null;
  shelf_life_days?: number | null;
  hero_image_url?: string | null;
  mrp?: number | null;
};

type ProductEntry = { products: ProductCard };
type ChannelInfo = {
  product_id?: string;
  public_price?: number | null;
  currency?: string | null;
  price_label?: string | null;
  price_display_text?: string | null;
  moq_display_text?: string | null;
  mrp?: number | null;
  discount_percent?: number | null;
};

type PublicCollectionEnvelope = {
  schema_version: "oasis.public-catalogue.v1";
  collection: {
    id: string;
    title: string;
    description: string | null;
    channel: string | null;
  };
  items: Array<{
    product_id: string;
    display_name: string;
    description: string | null;
    category: string | null;
    sku: string | null;
    pack_size: string | null;
    shelf_life_days: number | null;
    hero_image_url: string | null;
    price_visibility: "visible" | "hidden" | "inquiry";
    price: { amount: number; currency: string; label: string } | null;
    moq_display_text: string | null;
  }>;
};

type LegacyPublicCatalogueEnvelope = {
  schema_version: "oasis.legacy-public-catalogue.v1";
  catalogue: CatalogueView;
  items: ProductCard[];
};

const publicCatalogueRpc = supabase as unknown as {
  rpc: {
    (
      name: "get_public_collection_catalogue",
      args: { _token: string },
    ): Promise<{ data: PublicCollectionEnvelope | null; error: unknown }>;
    (
      name: "get_public_legacy_catalogue_v1",
      args: { _slug: string },
    ): Promise<{ data: LegacyPublicCatalogueEnvelope | null; error: unknown }>;
  };
};

const PublicCatalogue = () => {
  const { slug } = useParams();
  const [cat, setCat] = useState<CatalogueView | null>(null);
  const [products, setProducts] = useState<ProductEntry[]>([]);
  const [channelByProduct, setChannelByProduct] = useState<Record<string, ChannelInfo>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: collectionPayload } = await publicCatalogueRpc.rpc(
        "get_public_collection_catalogue",
        { _token: slug as string },
      );
      if (
        collectionPayload?.schema_version === "oasis.public-catalogue.v1" &&
        collectionPayload.collection &&
        Array.isArray(collectionPayload.items)
      ) {
        const collection = collectionPayload.collection;
        setCat({
          ...collection,
          subtitle: collection.description,
          target_customer_channel: collection.channel ?? "price_hidden",
          show_price: true,
          show_mrp: false,
          show_discount: false,
          show_price_label: null,
        });
        const mapped: Record<string, ChannelInfo> = {};
        const rows: ProductEntry[] = collectionPayload.items.map((item) => {
          mapped[item.product_id] = {
            public_price: item.price_visibility === "visible" ? item.price?.amount ?? null : null,
            currency: item.price?.currency ?? "₹",
            price_label: item.price?.label ?? null,
            price_display_text: item.price_visibility === "hidden" ? "Price hidden" : "Price on request",
            moq_display_text: item.moq_display_text,
          };
          return {
            products: {
              id: item.product_id,
              product_name: item.display_name,
              short_description: item.description,
              category: item.category,
              sku: item.sku,
              pack_size: item.pack_size,
              shelf_life_days: item.shelf_life_days,
              hero_image_url: item.hero_image_url,
            },
          };
        });
        setProducts(rows);
        setChannelByProduct(mapped);
        setLoading(false);
        return;
      }

      // Legacy slugs use a narrow server projection. Anonymous callers never join
      // catalogue_products to products(*) or receive the product-master row.
      const { data: legacyPayload } = await publicCatalogueRpc.rpc(
        "get_public_legacy_catalogue_v1",
        { _slug: slug as string },
      );
      if (legacyPayload?.schema_version !== "oasis.legacy-public-catalogue.v1") {
        setLoading(false);
        return;
      }
      setCat(legacyPayload.catalogue);
      setProducts(legacyPayload.items.map((product) => ({ products: product })));

      const { data: rpc } = await supabase.rpc("get_public_catalogue_channel_data", { _slug: slug as string });
      const map: Record<string, ChannelInfo> = {};
      ((rpc ?? []) as unknown as Array<ChannelInfo & { product_id: string }>).forEach((row) => {
        map[row.product_id] = row;
      });
      setChannelByProduct(map);
      setLoading(false);
    })();
  }, [slug]);

  if (loading) {
    return (
      <div className="catalogue-loading" aria-busy="true" aria-label="Loading catalogue">
        <div className="flex gap-2">
          <span className="catalogue-loading-dot" style={{ animationDelay: "0ms" }} />
          <span className="catalogue-loading-dot" style={{ animationDelay: "150ms" }} />
          <span className="catalogue-loading-dot" style={{ animationDelay: "300ms" }} />
        </div>
        <p className="luxe-sub text-muted-foreground">Preparing your catalogue</p>
      </div>
    );
  }

  if (!cat) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="catalogue-empty max-w-lg w-full">
          <div className="catalogue-brand-mark mx-auto mb-6">O</div>
          <h1 className="catalogue-empty-title">Catalogue not available</h1>
          <p className="catalogue-empty-text">This link is unpublished, archived, or has expired. Please contact Oasis Baklawa for an updated catalogue.</p>
        </div>
      </div>
    );
  }

  const channel = cat.target_customer_channel ?? "price_hidden";
  const showPrice = cat.show_price && channel !== "price_hidden";
  const showMrp = !!cat.show_mrp;
  const showDiscount = !!cat.show_discount;
  const showSku = ["b2b", "b2b_horeca", "horeca", "export", "wholesale"].includes(channel);
  const priceLabel = cat.show_price_label || (channel !== "price_hidden" ? channel.replace(/_/g, " ") + " price" : "Price");

  const url = window.location.href;
  const waText = encodeURIComponent(`Hello! I'd like to inquire about the ${cat.title} catalogue: ${url}`);

  const renderPrice = (p: ProductCard) => {
    const r = channelByProduct[p.id];
    if (showPrice && r?.public_price != null) {
      return <div className="luxe-price font-display text-accent">{r.currency || "₹"} {r.public_price} <span className="text-[10px] text-muted-foreground uppercase tracking-wider ml-1 normal-case font-sans">{r.price_label || priceLabel}</span>{showDiscount && r.discount_percent ? <span className="text-[10px] text-success ml-1 font-sans">-{r.discount_percent}%</span> : null}</div>;
    }
    if (showMrp && (r?.mrp ?? p.mrp)) {
      return <div className="luxe-price font-display text-accent">₹ {r?.mrp ?? p.mrp} <span className="text-[10px] text-muted-foreground uppercase tracking-wider ml-1 font-sans">MRP</span></div>;
    }
    return <div className="text-sm text-muted-foreground italic">{r?.price_display_text || "Price on request"}</div>;
  };

  const renderMoq = (p: ProductCard) => {
    const r = channelByProduct[p.id];
    return r?.moq_display_text || "MOQ depends on order type. Contact sales for details.";
  };

  return (
    <div className="min-h-screen bg-background print-page">
      <header className="catalogue-hero print:bg-white">
        <div className="catalogue-hero-inner">
          <div className="inline-flex items-center gap-3 mb-8">
            <div className="catalogue-brand-mark">O</div>
            <div className="text-left">
              <div className="font-display text-xl sm:text-2xl leading-none text-foreground">Oasis Baklawa</div>
              <div className="luxe-sub mt-1.5">Premium Gourmet Catalogue</div>
            </div>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl text-foreground mb-4 break-words leading-tight">{cat.title}</h1>
          {cat.subtitle && <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">{cat.subtitle}</p>}
          {cat.client_name && (
            <p className="mt-8 luxe-sub">
              Curated for{" "}
              <span className="font-display text-lg normal-case tracking-normal text-accent ml-1">{cat.client_name}</span>
            </p>
          )}
          {cat.intro_text && <p className="mt-6 max-w-2xl mx-auto text-sm sm:text-base text-muted-foreground leading-relaxed">{cat.intro_text}</p>}
          <div className="catalogue-divider mt-10" />
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        {products.length === 0 ? (
          <div className="catalogue-empty">
            <h2 className="catalogue-empty-title">No products yet</h2>
            <p className="catalogue-empty-text">This catalogue is being prepared. Please check back soon or reach out to our team.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 print-grid">
            {products.map(({ products: p }) => {
              const isPdf = p.hero_image_url?.includes("/_pdf_pages/");
              const showImg = p.hero_image_url && !isPdf;
              return (
                <article key={p.id} className="luxe-card flex flex-col">
                  <div className="luxe-media relative">
                    {showImg ? (
                      <img src={p.hero_image_url} alt={p.product_name} loading="lazy" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-secondary to-accent-soft/60">
                        <span className="font-display text-5xl sm:text-6xl text-accent/35">{p.product_name?.[0] ?? "·"}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-5 sm:p-6 flex-1 flex flex-col text-center">
                    <div className="luxe-sub mb-2 truncate">{p.category || p.product_type || "Oasis Baklawa"}</div>
                    <h2 className="luxe-title mb-3 break-words">{p.product_name}</h2>
                    {p.short_description && <p className="text-sm text-muted-foreground mb-4 line-clamp-3 leading-relaxed">{p.short_description}</p>}
                    <div className="text-xs text-muted-foreground space-y-1.5 mt-auto">
                      {showSku && p.sku && <div className="font-mono">SKU · {p.sku}</div>}
                      {p.pack_size && <div>Pack · {p.pack_size}</div>}
                      {p.shelf_life_days && <div>Shelf life · {p.shelf_life_days} days</div>}
                      <div className="px-2 pt-1">{renderMoq(p)}</div>
                    </div>
                    <div className="mt-5 pt-4 border-t border-border/60">
                      {renderPrice(p)}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-16 sm:pb-20 no-print">
        <div className="catalogue-cta-panel">
          <p className="luxe-sub mb-3 text-accent/80">Inquiries welcome</p>
          <h3 className="font-display text-2xl sm:text-3xl text-foreground mb-2">Place an inquiry</h3>
          <p className="text-muted-foreground mb-8 text-sm sm:text-base max-w-md mx-auto leading-relaxed">
            For pricing, customisation, corporate gifting, or bulk orders — our team will respond promptly.
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 justify-center">
            <Button asChild size="lg" className="rounded-full px-6">
              <a href={`https://wa.me/?text=${waText}`} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4 mr-2" />WhatsApp Us</a>
            </Button>
            <Button variant="outline" size="lg" asChild className="rounded-full px-6 border-accent/30 hover:bg-accent-soft/50">
              <a href={`mailto:hello@oasisbaklawa.com?subject=Inquiry: ${cat.title}`}><Mail className="h-4 w-4 mr-2" />Email Inquiry</a>
            </Button>
            <Button variant="ghost" size="lg" onClick={() => window.print()} className="rounded-full">
              <Printer className="h-4 w-4 mr-2" />Print / Save PDF
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/70 py-10 text-center text-xs text-muted-foreground px-6 leading-relaxed">
        <span className="font-display text-sm text-foreground/80 block mb-1">Oasis Baklawa</span>
        Premium Arabic &amp; Indo-Arabic gourmet sweets · Catalogue powered by Oasis AI Studio
      </footer>
    </div>
  );
};

export default PublicCatalogue;
