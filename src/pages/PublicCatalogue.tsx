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

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (!cat) return <div className="min-h-screen flex flex-col items-center justify-center text-center p-8">
    <div className="font-display text-3xl mb-2">Catalogue not available</div>
    <p className="text-muted-foreground">This link is unpublished, archived, or expired.</p>
  </div>;

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
      return <div className="mt-3 font-display text-lg gold-text">{r.currency || "₹"} {r.public_price} <span className="text-[10px] text-muted-foreground uppercase tracking-wider ml-1">{r.price_label || priceLabel}</span>{showDiscount && r.discount_percent ? <span className="text-[10px] text-success ml-1">-{r.discount_percent}%</span> : null}</div>;
    }
    if (showMrp && (r?.mrp ?? p.mrp)) {
      return <div className="mt-3 font-display text-lg gold-text">₹ {r?.mrp ?? p.mrp} <span className="text-[10px] text-muted-foreground uppercase tracking-wider ml-1">MRP</span></div>;
    }
    return <div className="mt-3 text-sm text-muted-foreground italic">{r?.price_display_text || "Price on request"}</div>;
  };

  const renderMoq = (p: any) => {
    const r = channelByProduct[p.id];
    return r?.moq_display_text || "MOQ depends on order type. Contact sales for details.";
  };

  return (
    <div className="min-h-screen bg-background print-page">
      <header className="bg-background border-b print:bg-white">
        <div className="max-w-6xl mx-auto px-6 py-12 sm:py-20 text-center">
          <div className="inline-flex items-center gap-3 mb-8">
            <div className="h-11 w-11 rounded-full gradient-gold flex items-center justify-center font-display text-xl text-primary">O</div>
            <div className="text-left">
              <div className="font-display text-xl leading-none text-foreground">Oasis Baklawa</div>
              <div className="luxe-sub mt-1">Premium Catalogue</div>
            </div>
          </div>
          <h1 className="font-display text-4xl sm:text-6xl text-foreground mb-3 break-words">{cat.title}</h1>
          {cat.subtitle && <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{cat.subtitle}</p>}
          {cat.client_name && <p className="mt-6 luxe-sub">Curated for <span className="font-display text-base normal-case tracking-normal text-accent ml-1">{cat.client_name}</span></p>}
          {cat.intro_text && <p className="mt-6 max-w-2xl mx-auto text-sm text-muted-foreground leading-relaxed">{cat.intro_text}</p>}
          <div className="mt-8 mx-auto h-px w-16 bg-accent/60" />
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
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
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-secondary to-accent-soft/50">
                    <span className="font-display text-5xl text-accent/30">{p.product_name?.[0] ?? "·"}</span>
                  </div>
                )}
              </div>
              <div className="p-5 sm:p-6 flex-1 flex flex-col text-center">
                <div className="luxe-sub mb-2 truncate">{p.category || p.product_type || "Oasis Baklawa"}</div>
                <h2 className="luxe-title mb-3 break-words">{p.product_name}</h2>
                {p.short_description && <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{p.short_description}</p>}
                <div className="text-xs text-muted-foreground space-y-1 mt-auto">
                  {p.pack_size && <div>Pack · {p.pack_size}</div>}
                  {p.shelf_life_days && <div>Shelf life · {p.shelf_life_days} days</div>}
                  <div className="px-2">{renderMoq(p)}</div>
                </div>
                <div className="mt-4 pt-4 border-t border-border/60">
                  {renderPrice(p)}
                </div>
              </div>
            </article>
            );
          })}
        </div>
        {products.length === 0 && <div className="text-center text-muted-foreground py-12">No products yet in this catalogue.</div>}
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-16 no-print">
        <div className="card-elevated p-8 text-center">
          <h3 className="font-display text-2xl mb-2">Place an inquiry</h3>
          <p className="text-muted-foreground mb-6 text-sm">For pricing, customisation, or bulk gifting orders.</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button asChild><a href={`https://wa.me/?text=${waText}`} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4 mr-1"/>WhatsApp Us</a></Button>
            <Button variant="outline" asChild><a href={`mailto:hello@oasisbaklawa.com?subject=Inquiry: ${cat.title}`}><Mail className="h-4 w-4 mr-1" />Email Inquiry</a></Button>
            <Button variant="ghost" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" />Print / Save PDF</Button>
          </div>
        </div>
      </section>

      <footer className="border-t py-8 text-center text-xs text-muted-foreground">
        © Oasis Baklawa · Catalogue powered by Oasis AI Studio · For inquiries, WhatsApp via the link above.
      </footer>
    </div>
  );
};

export default PublicCatalogue;
