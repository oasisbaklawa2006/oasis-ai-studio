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
    const rule = pricingByProduct[p.id];
    if (showPrice && rule?.calculated_price != null) {
      return <div className="mt-3 font-display text-lg gold-text">{rule.currency || "₹"} {rule.calculated_price} <span className="text-[10px] text-muted-foreground uppercase tracking-wider ml-1">{priceLabel}</span></div>;
    }
    if (showMrp && p.mrp) {
      return <div className="mt-3 font-display text-lg gold-text">₹ {p.mrp} <span className="text-[10px] text-muted-foreground uppercase tracking-wider ml-1">MRP</span>{showDiscount && rule?.discount_percent ? <span className="text-[10px] text-success ml-1">-{rule.discount_percent}%</span> : null}</div>;
    }
    return <div className="mt-3 text-sm text-muted-foreground italic">Price on request</div>;
  };

  const renderMoq = (p: any) => {
    const rule = moqByProduct[p.id];
    if (rule) {
      if (rule.moq_applicable === false) return "MOQ not applicable";
      if (rule.moq_value) return `MOQ: ${rule.moq_value} ${rule.moq_uom || ""}`.trim();
    }
    return "MOQ depends on order type. Contact sales for details.";
  };

  return (
    <div className="min-h-screen bg-background print-page">
      <header className="gradient-hero text-primary-foreground print:bg-white print:text-black">
        <div className="max-w-5xl mx-auto px-6 py-12 sm:py-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-10 w-10 rounded-lg gradient-gold flex items-center justify-center font-display text-xl text-primary">O</div>
            <div>
              <div className="font-display text-xl leading-none">Oasis Baklawa</div>
              <div className="text-[10px] uppercase tracking-[0.25em] opacity-70">Premium Catalogue</div>
            </div>
          </div>
          <h1 className="font-display text-4xl sm:text-6xl mb-3">{cat.title}</h1>
          {cat.subtitle && <p className="text-xl opacity-80">{cat.subtitle}</p>}
          {cat.client_name && <p className="mt-4 text-sm opacity-70">Curated for <span className="gold-text font-display text-lg">{cat.client_name}</span></p>}
          {cat.intro_text && <p className="mt-6 max-w-2xl opacity-90 leading-relaxed">{cat.intro_text}</p>}
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 py-12">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 print-grid">
          {products.map(({ products: p }) => (
            <article key={p.id} className="card-elevated overflow-hidden">
              <div className="aspect-[4/5] bg-muted">
                {p.hero_image_url && <img src={p.hero_image_url} alt={p.product_name} className="w-full h-full object-cover" />}
              </div>
              <div className="p-5">
                <h2 className="font-display text-xl mb-1">{p.product_name}</h2>
                <div className="text-[11px] font-mono text-muted-foreground mb-2">{p.sku}</div>
                <p className="text-sm text-muted-foreground mb-3">{p.short_description}</p>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {p.pack_size && <div>Pack · {p.pack_size}</div>}
                  {p.shelf_life_days && <div>Shelf life · {p.shelf_life_days} days</div>}
                  <div>{renderMoq(p)}</div>
                </div>
                {renderPrice(p)}
              </div>
            </article>
          ))}
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
