import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { SkuBuilder } from "@/components/SkuBuilder";
import { AliasManager } from "@/components/AliasManager";
import { ProductMediaUploader } from "@/components/ProductMediaUploader";

const empty = {
  product_name: "", short_name: "", category: "", subcategory: "",
  product_type: "", description: "", short_description: "", pack_size: "",
  net_weight_g: "", gross_weight_g: "", shelf_life_days: "", storage_instructions: "",
  hsn_code: "", gst_rate: "", mrp: "", b2b_price: "", export_price: "",
  currency: "INR", moq_text: "", carton_logic: "", hero_image_url: "",
  is_active: true, is_catalogue_ready: false,
  sku: null, sku_locked: true,
  division_code: null, category_code: null, subcategory_code: null, packaging_code: null,
  legacy_sku: null,
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div><Label className="text-xs">{label}</Label>{children}</div>
);

const ProductEdit = () => {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const nav = useNavigate();
  const { roles } = useAuth();
  const canOverride = roles.includes("owner") || roles.includes("admin");
  const [form, setForm] = useState<any>(empty);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isNew) supabase.from("products").select("*").eq("id", id).single().then(({ data }) => data && setForm(data));
  }, [id, isNew]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const patch = (p: any) => setForm((f: any) => ({ ...f, ...p }));

  const save = async () => {
    if (!form.sku) return toast.error("Generate a SKU before saving.");
    if (!form.product_name) return toast.error("Product name is required.");
    setLoading(true);
    const payload: any = { ...form };
    ["net_weight_g","gross_weight_g","shelf_life_days","gst_rate","mrp","b2b_price","export_price"].forEach((k) => {
      payload[k] = payload[k] === "" || payload[k] == null ? null : Number(payload[k]);
    });
    const res = isNew
      ? await supabase.from("products").insert(payload).select().single()
      : await supabase.from("products").update(payload).eq("id", id).select().single();
    setLoading(false);
    if (res.error) return toast.error(res.error.message);
    toast.success("Saved");
    nav(`/products/${res.data.id}`);
  };

  return (
    <>
      <PageHeader title={isNew ? "New Product" : form.product_name || "Edit Product"} subtitle="Master record · catalogue, label, and media-ready."
        actions={<><Button variant="outline" onClick={() => nav("/products")}>Back</Button><Button onClick={save} disabled={loading}>{loading?"Saving…":"Save"}</Button></>} />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card-elevated p-6 grid sm:grid-cols-2 gap-4">
            <Field label="Product Name *"><Input value={form.product_name} onChange={(e) => set("product_name", e.target.value)} /></Field>
            <Field label="Short Name"><Input value={form.short_name ?? ""} onChange={(e) => set("short_name", e.target.value)} /></Field>
            <Field label="Product Type"><Input value={form.product_type ?? ""} onChange={(e) => set("product_type", e.target.value)} /></Field>
            <Field label="Display Category"><Input value={form.category ?? ""} onChange={(e) => set("category", e.target.value)} /></Field>
            <Field label="Display Subcategory"><Input value={form.subcategory ?? ""} onChange={(e) => set("subcategory", e.target.value)} /></Field>
            <Field label="Hero image URL"><Input value={form.hero_image_url ?? ""} onChange={(e) => set("hero_image_url", e.target.value)} placeholder="https://…" /></Field>
            <div className="sm:col-span-2"><Field label="Short description"><Input value={form.short_description ?? ""} onChange={(e) => set("short_description", e.target.value)} /></Field></div>
            <div className="sm:col-span-2"><Field label="Description"><Textarea rows={4} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} /></Field></div>
          </div>

          <SkuBuilder value={form} canOverride={canOverride} onChange={patch} />

          {!isNew && <AliasManager productId={id!} productName={form.product_name ?? ""} />}

          {!isNew && (
            <ProductMediaUploader
              productId={id!}
              productSku={form.sku}
              currentHero={form.hero_image_url}
              onHeroChange={(url) => set("hero_image_url", url)}
            />
          )}

          <div className="card-elevated p-6">
            <h3 className="font-display text-xl mb-4">Pack & weight</h3>
            <div className="grid sm:grid-cols-3 gap-4">
              <Field label="Pack size"><Input value={form.pack_size ?? ""} onChange={(e) => set("pack_size", e.target.value)} /></Field>
              <Field label="Net weight (g)"><Input type="number" value={form.net_weight_g ?? ""} onChange={(e) => set("net_weight_g", e.target.value)} /></Field>
              <Field label="Gross weight (g)"><Input type="number" value={form.gross_weight_g ?? ""} onChange={(e) => set("gross_weight_g", e.target.value)} /></Field>
              <Field label="Shelf life (days)"><Input type="number" value={form.shelf_life_days ?? ""} onChange={(e) => set("shelf_life_days", e.target.value)} /></Field>
              <Field label="MOQ"><Input value={form.moq_text ?? ""} onChange={(e) => set("moq_text", e.target.value)} /></Field>
              <Field label="Carton logic"><Input value={form.carton_logic ?? ""} onChange={(e) => set("carton_logic", e.target.value)} /></Field>
              <div className="sm:col-span-3"><Field label="Storage instructions"><Textarea rows={2} value={form.storage_instructions ?? ""} onChange={(e) => set("storage_instructions", e.target.value)} /></Field></div>
            </div>
          </div>

          <div className="card-elevated p-6">
            <h3 className="font-display text-xl mb-4">Pricing</h3>
            <div className="grid sm:grid-cols-3 gap-4">
              <Field label="HSN"><Input value={form.hsn_code ?? ""} onChange={(e) => set("hsn_code", e.target.value)} /></Field>
              <Field label="GST %"><Input type="number" value={form.gst_rate ?? ""} onChange={(e) => set("gst_rate", e.target.value)} /></Field>
              <Field label="Currency"><Input value={form.currency ?? "INR"} onChange={(e) => set("currency", e.target.value)} /></Field>
              <Field label="MRP"><Input type="number" value={form.mrp ?? ""} onChange={(e) => set("mrp", e.target.value)} /></Field>
              <Field label="B2B price"><Input type="number" value={form.b2b_price ?? ""} onChange={(e) => set("b2b_price", e.target.value)} /></Field>
              <Field label="Export price"><Input type="number" value={form.export_price ?? ""} onChange={(e) => set("export_price", e.target.value)} /></Field>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card-elevated p-6 space-y-4">
            <h3 className="font-display text-xl">Status</h3>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Catalogue-ready</Label>
              <Switch checked={form.is_catalogue_ready} onCheckedChange={(v) => set("is_catalogue_ready", v)} />
            </div>
            <div className="text-xs text-muted-foreground border-t pt-3">
              Label status: <span className="font-medium text-foreground">{form.label_status ?? "draft"}</span><br />
              Media status: <span className="font-medium text-foreground">{form.media_status ?? "missing"}</span>
            </div>
          </div>

          <div className="card-elevated p-6 bg-accent-soft/40">
            <div className="text-xs uppercase tracking-wider text-accent-foreground/80 mb-2">API integration note</div>
            <p className="text-sm">SKU is the permanent system identity used by Oasis Central, B2B Portal, label & barcode tools, and all future APIs. Aliases are search helpers only — never use alias text as an external reference.</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default ProductEdit;
