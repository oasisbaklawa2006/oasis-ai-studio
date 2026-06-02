import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MessageCircle, Mail, Printer } from "lucide-react";

const PublicCatalogue = () => {
  const { slug } = useParams();
  const [cat, setCat] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [channelByProduct, setChannelByProduct] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("catalogues").select("*").eq("public_slug", slug).eq("status", "published").maybeSingle();
      if (!data) { setLoading(false); return; }
      setCat(data);
      const { data: cp } = await supabase.from("catalogue_products").select("*, products(*)").eq("catalogue_id", data.id).order("sort_order");
      setProducts(cp ?? []);

      const { data: rpc } = await supabase.rpc("get_public_catalogue_channel_data", { _slug: slug as string });
      const map: Record<string, any> = {};
      (rpc ?? []).forEach((r: any) => { map[r.product_id] = r; });
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
  const priceLabel = cat.show_price_label || (channel !== "price_hidden" ? channel.replace(/_/g, " ") + " price" : "Price");

  const url = window.location.href;
  const waText = encodeURIComponent(`Hello! I'd like to inquire about the ${cat.title} catalogue: ${url}`);

  const renderPrice = (p: any) => {
    const r = channelByProduct[p.id];
    if (showPrice && r?.public_price != null) {
      return <div className="luxe-price font-display text-accent">{r.currency || "₹"} {r.public_price} <span className="text-[10px] text-muted-foreground uppercase tracking-wider ml-1 normal-case font-sans">{r.price_label || priceLabel}</span>{showDiscount && r.discount_percent ? <span className="text-[10px] text-success ml-1 font-sans">-{r.discount_percent}%</span> : null}</div>;
    }
    if (showMrp && (r?.mrp ?? p.mrp)) {
      return <div className="luxe-price font-display text-accent">₹ {r?.mrp ?? p.mrp} <span className="text-[10px] text-muted-foreground uppercase tracking-wider ml-1 font-sans">MRP</span></div>;
    }
    return <div className="text-sm text-muted-foreground italic">{r?.price_display_text || "Price on request"}</div>;
  };

  const renderMoq = (p: any) => {
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
