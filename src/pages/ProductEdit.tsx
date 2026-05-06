import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { SkuBuilder } from "@/components/SkuBuilder";
import { AliasManager } from "@/components/AliasManager";
import { ProductMediaUploader } from "@/components/ProductMediaUploader";
import { BomBuilder } from "@/components/BomBuilder";
import { AlertTriangle } from "lucide-react";

const PRODUCT_CLASSES = [
  { v: "bulk_loose_product", label: "Bulk / Loose product" },
  { v: "ready_pack", label: "Ready pack" },
  { v: "gift_hamper", label: "Gift / Hamper" },
  { v: "packaging_decoration_material", label: "Packaging / Decoration material" },
  { v: "semi_prepared_frozen", label: "Semi-prepared / Frozen" },
  { v: "service_or_customization", label: "Service / Customisation" },
];

const MAIN_DEPARTMENTS = [
  { v: "packing_assembly", label: "Packing & Assembly" },
  { v: "third_party_goods_store", label: "3rd Party Goods Store" },
  { v: "ready_goods_store", label: "Ready Goods Store" },
];

const PRODUCTION_DEPARTMENTS = [
  { v: "arabic_sweets", label: "Arabic Sweets" },
  { v: "fusion_sweets", label: "Fusion Sweets" },
  { v: "chocolates_confectionery", label: "Chocolates & Confectionery" },
  { v: "dragees", label: "Dragees" },
  { v: "seasoned_nuts_mixes", label: "Seasoned Nuts & Mixes" },
  { v: "bakery", label: "Bakery" },
];

const UOM_OPTIONS = ["kg", "grams", "pcs", "box", "carton", "tray", "pack", "litre", "ml"];
const MOQ_RULE_TYPES = [
  { v: "not_applicable", label: "Not applicable" },
  { v: "fixed_min", label: "Fixed minimum" },
  { v: "carton_based", label: "Carton based" },
  { v: "master_carton_based", label: "Master carton based" },
  { v: "private_label", label: "Private label" },
  { v: "quotation", label: "Quotation only" },
];

const DEFAULT_CAUTION =
  "Customisation must be confirmed in writing before production. Changes after approval may affect cost, timeline, and dispatch date.";

const empty: any = {
  product_name: "", short_name: "", category: "", subcategory: "",
  product_type: "", description: "", short_description: "", pack_size: "",
  net_weight_g: "", gross_weight_g: "", shelf_life_days: "", storage_instructions: "",
  hsn_code: "", gst_rate: "", mrp: "", b2b_price: "", export_price: "",
  currency: "INR", moq_text: "", carton_logic: "", hero_image_url: "",
  is_active: true, is_catalogue_ready: false,
  sku: null, sku_locked: true,
  division_code: null, category_code: null, subcategory_code: null, packaging_code: null,
  legacy_sku: null,
  // Batch B fields
  product_class: "", main_department: "", production_department: "",
  primary_uom: "", b2b_uom: "", retail_uom: "",
  price_basis: "", b2b_price_basis: "", retail_price_basis: "",
  unit_conversion_note: "",
  pieces_per_kg: "", approximate_piece_weight_g: "", pcs_per_pack: "",
  moq_rule_type: "", moq_value: "", moq_uom: "",
  increment_value: "", increment_uom: "",
  fixed_carton_required: false, carton_qty: "", carton_uom: "",
  master_carton_qty: "", master_carton_uom: "",
  dimension_l_cm: "", dimension_w_cm: "", dimension_h_cm: "",
  material_type: "", color_finish_notes: "",
  private_label_allowed: false, private_label_moq: "", private_label_moq_uom: "",
  private_label_cost_per_unit: "", private_label_upfront_cost: "",
  customization_allowed: false, customization_note: "", customization_caution: "",
  bom_required: false, pricing_notes: "", operational_notes: "",
  frozen_shelf_life_days: "", post_processing_shelf_life_days: "",
  temperature_requirement: "", thawing_instruction: "",
};

const NUMERIC_FIELDS = [
  "net_weight_g", "gross_weight_g", "shelf_life_days", "gst_rate", "mrp", "b2b_price", "export_price",
  "pieces_per_kg", "approximate_piece_weight_g", "pcs_per_pack",
  "moq_value", "increment_value",
  "carton_qty", "master_carton_qty",
  "dimension_l_cm", "dimension_w_cm", "dimension_h_cm",
  "private_label_moq", "private_label_cost_per_unit", "private_label_upfront_cost",
  "frozen_shelf_life_days", "post_processing_shelf_life_days",
];

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="space-y-1">
    <Label className="text-xs">{label}</Label>
    {children}
    {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
  </div>
);

const Select = ({ value, onChange, options, placeholder }: any) => (
  <select
    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
    value={value ?? ""}
    onChange={(e) => onChange(e.target.value)}
  >
    <option value="">{placeholder ?? "— Select —"}</option>
    {options.map((o: any) =>
      typeof o === "string"
        ? <option key={o} value={o}>{o}</option>
        : <option key={o.v} value={o.v}>{o.label}</option>
    )}
  </select>
);

const ProductEdit = () => {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const nav = useNavigate();
  const { roles } = useAuth();
  const canOverride = roles.includes("owner") || roles.includes("admin");
  const [form, setForm] = useState<any>(empty);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("identity");

  useEffect(() => {
    if (!isNew) supabase.from("products").select("*").eq("id", id).single().then(({ data }) => {
      if (data) setForm({ ...empty, ...data });
    });
  }, [id, isNew]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const patch = (p: any) => setForm((f: any) => ({ ...f, ...p }));

  // Class-aware defaults
  useEffect(() => {
    if (form.product_class === "gift_hamper" && !form.bom_required) set("bom_required", true);
    if (form.product_class === "packaging_decoration_material" && !form.fixed_carton_required) set("fixed_carton_required", true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.product_class]);

  useEffect(() => {
    if (form.customization_allowed && !form.customization_caution) set("customization_caution", DEFAULT_CAUTION);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.customization_allowed]);

  const cls = form.product_class;
  const showPrivateLabel = cls === "ready_pack" || cls === "packaging_decoration_material";
  const showCustomization = cls === "gift_hamper" || cls === "ready_pack" || cls === "service_or_customization";
  const showDimensions = cls === "packaging_decoration_material" || form.fixed_carton_required;
  const showFrozen = cls === "semi_prepared_frozen";
  const canManageBom = roles.includes("owner") || roles.includes("admin") || roles.includes("product_manager");
  const bomRelevant = cls === "ready_pack" || cls === "gift_hamper" || cls === "packaging_decoration_material" || !!form.bom_required;
  const showBom = !isNew && (bomRelevant || canManageBom);

  const missing = useMemo(() => {
    const m: string[] = [];
    if (!form.product_name) m.push("Product name");
    if (!form.sku) m.push("SKU");
    if (!form.product_class) m.push("Product class");
    if (!form.main_department) m.push("Main department");
    if (form.main_department === "ready_goods_store" && !form.production_department) m.push("Production department");
    if (form.private_label_allowed && (!form.private_label_moq || !form.private_label_cost_per_unit))
      m.push("Private label MOQ & cost");
    return m;
  }, [form]);

  const save = async () => {
    if (missing.length > 0) return toast.error(`Fix missing fields: ${missing.join(", ")}`);
    setLoading(true);
    const payload: any = { ...form };
    NUMERIC_FIELDS.forEach((k) => {
      payload[k] = payload[k] === "" || payload[k] == null ? null : Number(payload[k]);
    });
    // empty strings → null for optional text columns to keep DB tidy
    Object.keys(payload).forEach((k) => { if (payload[k] === "") payload[k] = null; });
    // restore booleans
    ["is_active","is_catalogue_ready","sku_locked","fixed_carton_required","private_label_allowed","customization_allowed","bom_required"]
      .forEach((k) => { payload[k] = !!form[k]; });

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
      <PageHeader
        title={isNew ? "New Product" : form.product_name || "Edit Product"}
        subtitle="Master record · catalogue, label, and media-ready."
        actions={<>
          <Button variant="outline" onClick={() => nav("/products")}>Back</Button>
          <Button onClick={save} disabled={loading}>{loading ? "Saving…" : "Save"}</Button>
        </>}
      />

      {missing.length > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 mt-0.5 text-warning" />
          <div><span className="font-medium">Fix missing fields:</span> {missing.join(" · ")}</div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="flex flex-wrap h-auto w-full justify-start gap-1">
              <TabsTrigger value="identity">Identity</TabsTrigger>
              <TabsTrigger value="uom">UOM / MOQ</TabsTrigger>
              {!isNew && <TabsTrigger value="media">Media</TabsTrigger>}
              {showPrivateLabel && <TabsTrigger value="private_label">Private Label</TabsTrigger>}
              {showCustomization && <TabsTrigger value="customisation">Customisation</TabsTrigger>}
              {showDimensions && <TabsTrigger value="dimensions">Dimensions</TabsTrigger>}
              {showFrozen && <TabsTrigger value="frozen">Frozen</TabsTrigger>}
              {showBom && <TabsTrigger value="bom">BOM</TabsTrigger>}
              <TabsTrigger value="compliance">Compliance</TabsTrigger>
              <TabsTrigger value="ops">Ops Notes</TabsTrigger>
            </TabsList>

            {/* IDENTITY */}
            <TabsContent value="identity" className="space-y-6">
              <div className="card-elevated p-6 grid sm:grid-cols-2 gap-4">
                <Field label="Product Name *">
                  <Input
                    value={form.product_name}
                    onChange={(e) => set("product_name", e.target.value)}
                    placeholder="Example: Cashew Pyramid Baklawa / Baklawa Acrylic Box 6 pcs"
                  />
                </Field>
                <Field label="Short Name">
                  <Input value={form.short_name ?? ""} onChange={(e) => set("short_name", e.target.value)} placeholder="Example: Cashew Pyramid" />
                </Field>
                <Field label="Product Class *">
                  <Select value={form.product_class} onChange={(v: string) => set("product_class", v)} options={PRODUCT_CLASSES} />
                </Field>
                <Field label="Product Type">
                  <Input value={form.product_type ?? ""} onChange={(e) => set("product_type", e.target.value)} placeholder="Example: Baklawa, Hamper, Jar pack" />
                </Field>
                <Field label="Display Category">
                  <Input value={form.category ?? ""} onChange={(e) => set("category", e.target.value)} placeholder="Example: Baklawa, Dates, Dragees, Hampers, Packaging Material" />
                </Field>
                <Field label="Display Subcategory">
                  <Input value={form.subcategory ?? ""} onChange={(e) => set("subcategory", e.target.value)} placeholder="Example: Pyramid, Roll, Acrylic Box" />
                </Field>
                <Field label="Main Department *" hint="Example: Baklawa → Ready Goods Store → Arabic Sweets">
                  <Select value={form.main_department} onChange={(v: string) => set("main_department", v)} options={MAIN_DEPARTMENTS} />
                </Field>
                {form.main_department === "ready_goods_store" && (
                  <Field label="Production Department *">
                    <Select value={form.production_department} onChange={(v: string) => set("production_department", v)} options={PRODUCTION_DEPARTMENTS} />
                  </Field>
                )}
                <div className="sm:col-span-2">
                  <Field label="Short description">
                    <Input
                      value={form.short_description ?? ""}
                      onChange={(e) => set("short_description", e.target.value)}
                      placeholder="Example: Premium pyramid-shaped baklawa filled with roasted cashews."
                    />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Description">
                    <Textarea rows={4} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} />
                  </Field>
                </div>
              </div>

              <SkuBuilder value={form} canOverride={canOverride} onChange={patch} />

              {!isNew && <AliasManager productId={id!} productName={form.product_name ?? ""} />}
            </TabsContent>

            {/* UOM / MOQ */}
            <TabsContent value="uom" className="space-y-6">
              <div className="card-elevated p-6 space-y-5">
                <div>
                  <h3 className="font-display text-xl mb-1">Unit of measure</h3>
                  <p className="text-xs text-muted-foreground">Example: kg for B2B, pcs for retail, grams for retail nuts/dragees.</p>
                </div>
                <div className="grid sm:grid-cols-3 gap-4">
                  <Field label="Primary UOM"><Select value={form.primary_uom} onChange={(v: string) => set("primary_uom", v)} options={UOM_OPTIONS} /></Field>
                  <Field label="B2B UOM"><Select value={form.b2b_uom} onChange={(v: string) => set("b2b_uom", v)} options={UOM_OPTIONS} /></Field>
                  <Field label="Retail UOM"><Select value={form.retail_uom} onChange={(v: string) => set("retail_uom", v)} options={UOM_OPTIONS} /></Field>
                  <Field label="Price basis"><Input value={form.price_basis ?? ""} onChange={(e) => set("price_basis", e.target.value)} placeholder="per kg / per pc / per 100g" /></Field>
                  <Field label="B2B price basis"><Input value={form.b2b_price_basis ?? ""} onChange={(e) => set("b2b_price_basis", e.target.value)} placeholder="per kg" /></Field>
                  <Field label="Retail price basis"><Input value={form.retail_price_basis ?? ""} onChange={(e) => set("retail_price_basis", e.target.value)} placeholder="per pc / per 100g" /></Field>
                  <div className="sm:col-span-3">
                    <Field label="Unit conversion note">
                      <Textarea rows={2} value={form.unit_conversion_note ?? ""} onChange={(e) => set("unit_conversion_note", e.target.value)} placeholder="Example: Approx. 55–60 pcs per kg; retail sold by piece." />
                    </Field>
                  </div>
                  <Field label="Pieces per kg"><Input type="number" value={form.pieces_per_kg ?? ""} onChange={(e) => set("pieces_per_kg", e.target.value)} placeholder="55" /></Field>
                  <Field label="Approx. piece weight (g)"><Input type="number" value={form.approximate_piece_weight_g ?? ""} onChange={(e) => set("approximate_piece_weight_g", e.target.value)} placeholder="18" /></Field>
                  <Field label="Pieces per pack"><Input type="number" value={form.pcs_per_pack ?? ""} onChange={(e) => set("pcs_per_pack", e.target.value)} placeholder="6" /></Field>
                </div>
              </div>

              <div className="card-elevated p-6 space-y-5">
                <div>
                  <h3 className="font-display text-xl mb-1">MOQ & increment</h3>
                  <p className="text-xs text-muted-foreground">Example: B2B MOQ 1 master carton; Retail MOQ not applicable.</p>
                </div>
                <div className="grid sm:grid-cols-3 gap-4">
                  <Field label="MOQ rule type"><Select value={form.moq_rule_type} onChange={(v: string) => set("moq_rule_type", v)} options={MOQ_RULE_TYPES} /></Field>
                  <Field label="MOQ value"><Input type="number" value={form.moq_value ?? ""} onChange={(e) => set("moq_value", e.target.value)} placeholder="1" /></Field>
                  <Field label="MOQ UOM"><Select value={form.moq_uom} onChange={(v: string) => set("moq_uom", v)} options={UOM_OPTIONS} /></Field>
                  <Field label="Increment value"><Input type="number" value={form.increment_value ?? ""} onChange={(e) => set("increment_value", e.target.value)} placeholder="1" /></Field>
                  <Field label="Increment UOM"><Select value={form.increment_uom} onChange={(v: string) => set("increment_uom", v)} options={UOM_OPTIONS} /></Field>
                  <Field label="Legacy MOQ note"><Input value={form.moq_text ?? ""} onChange={(e) => set("moq_text", e.target.value)} placeholder="Free text fallback" /></Field>
                </div>
              </div>

              <div className="card-elevated p-6 space-y-5">
                <div>
                  <h3 className="font-display text-xl mb-1">Carton logic</h3>
                  <p className="text-xs text-muted-foreground">Example: Sold only in closed carton of 50 pcs.</p>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Fixed carton required</Label>
                  <Switch checked={!!form.fixed_carton_required} onCheckedChange={(v) => set("fixed_carton_required", v)} />
                </div>
                <div className="grid sm:grid-cols-3 gap-4">
                  <Field label="Carton qty"><Input type="number" value={form.carton_qty ?? ""} onChange={(e) => set("carton_qty", e.target.value)} placeholder="50" /></Field>
                  <Field label="Carton UOM"><Select value={form.carton_uom} onChange={(v: string) => set("carton_uom", v)} options={UOM_OPTIONS} /></Field>
                  <Field label="Master carton qty"><Input type="number" value={form.master_carton_qty ?? ""} onChange={(e) => set("master_carton_qty", e.target.value)} placeholder="6" /></Field>
                  <Field label="Master carton UOM"><Select value={form.master_carton_uom} onChange={(v: string) => set("master_carton_uom", v)} options={UOM_OPTIONS} /></Field>
                  <div className="sm:col-span-3">
                    <Field label="Carton logic note">
                      <Input value={form.carton_logic ?? ""} onChange={(e) => set("carton_logic", e.target.value)} placeholder="Example: Sold only in closed carton of 50 pcs." />
                    </Field>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* MEDIA */}
            {!isNew && (
              <TabsContent value="media" className="space-y-6">
                <ProductMediaUploader
                  productId={id!}
                  productSku={form.sku}
                  currentHero={form.hero_image_url}
                  onHeroChange={(url) => set("hero_image_url", url)}
                />
                <div className="card-elevated p-4">
                  <Field label="Hero image URL (advanced)">
                    <Input value={form.hero_image_url ?? ""} onChange={(e) => set("hero_image_url", e.target.value)} placeholder="https://…" />
                  </Field>
                </div>
              </TabsContent>
            )}

            {/* PRIVATE LABEL */}
            {showPrivateLabel && (
              <TabsContent value="private_label" className="space-y-6">
                <div className="card-elevated p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-display text-xl">Private label</h3>
                      <p className="text-xs text-muted-foreground">Example: Private label allowed above 500 pcs. ₹10/pc label cost charged upfront.</p>
                    </div>
                    <Switch checked={!!form.private_label_allowed} onCheckedChange={(v) => set("private_label_allowed", v)} />
                  </div>
                  {form.private_label_allowed && (
                    <div className="grid sm:grid-cols-2 gap-4">
                      <Field label="Private label MOQ"><Input type="number" value={form.private_label_moq ?? ""} onChange={(e) => set("private_label_moq", e.target.value)} placeholder="500" /></Field>
                      <Field label="Private label MOQ UOM"><Select value={form.private_label_moq_uom} onChange={(v: string) => set("private_label_moq_uom", v)} options={UOM_OPTIONS} /></Field>
                      <Field label="Cost per unit (₹)"><Input type="number" value={form.private_label_cost_per_unit ?? ""} onChange={(e) => set("private_label_cost_per_unit", e.target.value)} placeholder="10" /></Field>
                      <Field label="Upfront cost (₹)"><Input type="number" value={form.private_label_upfront_cost ?? ""} onChange={(e) => set("private_label_upfront_cost", e.target.value)} placeholder="5000" /></Field>
                    </div>
                  )}
                </div>
              </TabsContent>
            )}

            {/* CUSTOMISATION */}
            {showCustomization && (
              <TabsContent value="customisation" className="space-y-6">
                <div className="card-elevated p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-display text-xl">Customisation</h3>
                      <p className="text-xs text-muted-foreground">Example: Logo sticker, ribbon color, greeting card message, client branding.</p>
                    </div>
                    <Switch checked={!!form.customization_allowed} onCheckedChange={(v) => set("customization_allowed", v)} />
                  </div>
                  {form.customization_allowed && (
                    <>
                      <Field label="Customisation note">
                        <Textarea rows={3} value={form.customization_note ?? ""} onChange={(e) => set("customization_note", e.target.value)} placeholder="Example: Logo sticker, ribbon color, greeting card message, client branding." />
                      </Field>
                      <Field label="Customisation caution">
                        <Textarea
                          rows={3}
                          value={form.customization_caution ?? ""}
                          onChange={(e) => set("customization_caution", e.target.value)}
                          className="bg-warning/10 underline decoration-warning underline-offset-2 font-medium"
                        />
                      </Field>
                    </>
                  )}
                </div>
              </TabsContent>
            )}

            {/* DIMENSIONS */}
            {showDimensions && (
              <TabsContent value="dimensions" className="space-y-6">
                <div className="card-elevated p-6 space-y-4">
                  <div>
                    <h3 className="font-display text-xl mb-1">Dimensions & material</h3>
                    <p className="text-xs text-muted-foreground">Example: L 22 cm × W 18 cm × H 6 cm.</p>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <Field label="Length (cm)"><Input type="number" value={form.dimension_l_cm ?? ""} onChange={(e) => set("dimension_l_cm", e.target.value)} placeholder="22" /></Field>
                    <Field label="Width (cm)"><Input type="number" value={form.dimension_w_cm ?? ""} onChange={(e) => set("dimension_w_cm", e.target.value)} placeholder="18" /></Field>
                    <Field label="Height (cm)"><Input type="number" value={form.dimension_h_cm ?? ""} onChange={(e) => set("dimension_h_cm", e.target.value)} placeholder="6" /></Field>
                    <Field label="Material type"><Input value={form.material_type ?? ""} onChange={(e) => set("material_type", e.target.value)} placeholder="Acrylic / Kraft / Velvet" /></Field>
                    <div className="sm:col-span-2">
                      <Field label="Colour / finish notes"><Input value={form.color_finish_notes ?? ""} onChange={(e) => set("color_finish_notes", e.target.value)} placeholder="Matte gold, transparent lid" /></Field>
                    </div>
                  </div>
                </div>
              </TabsContent>
            )}

            {/* FROZEN */}
            {showFrozen && (
              <TabsContent value="frozen" className="space-y-6">
                <div className="card-elevated p-6 space-y-4">
                  <div>
                    <h3 className="font-display text-xl mb-1">Frozen / semi-prepared</h3>
                    <p className="text-xs text-muted-foreground">Example: Store at -18°C. Use within 48 hours after thawing.</p>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Frozen shelf life (days)"><Input type="number" value={form.frozen_shelf_life_days ?? ""} onChange={(e) => set("frozen_shelf_life_days", e.target.value)} placeholder="180" /></Field>
                    <Field label="Post-processing shelf life (days)"><Input type="number" value={form.post_processing_shelf_life_days ?? ""} onChange={(e) => set("post_processing_shelf_life_days", e.target.value)} placeholder="2" /></Field>
                    <Field label="Temperature requirement"><Input value={form.temperature_requirement ?? ""} onChange={(e) => set("temperature_requirement", e.target.value)} placeholder="-18°C" /></Field>
                    <Field label="Thawing instruction"><Input value={form.thawing_instruction ?? ""} onChange={(e) => set("thawing_instruction", e.target.value)} placeholder="Thaw at 4°C overnight" /></Field>
                  </div>
                </div>
              </TabsContent>
            )}

            {/* COMPLIANCE */}
            <TabsContent value="compliance" className="space-y-6">
              <div className="card-elevated p-6">
                <h3 className="font-display text-xl mb-4">Pack & shelf</h3>
                <div className="grid sm:grid-cols-3 gap-4">
                  <Field label="Pack size"><Input value={form.pack_size ?? ""} onChange={(e) => set("pack_size", e.target.value)} placeholder="500g jar / 6 pcs box" /></Field>
                  <Field label="Net weight (g)"><Input type="number" value={form.net_weight_g ?? ""} onChange={(e) => set("net_weight_g", e.target.value)} /></Field>
                  <Field label="Gross weight (g)"><Input type="number" value={form.gross_weight_g ?? ""} onChange={(e) => set("gross_weight_g", e.target.value)} /></Field>
                  <Field label="Shelf life (days)"><Input type="number" value={form.shelf_life_days ?? ""} onChange={(e) => set("shelf_life_days", e.target.value)} /></Field>
                  <div className="sm:col-span-3">
                    <Field label="Storage instructions">
                      <Textarea rows={2} value={form.storage_instructions ?? ""} onChange={(e) => set("storage_instructions", e.target.value)} placeholder="Example: Store in cool, dry place away from sunlight." />
                    </Field>
                  </div>
                </div>
              </div>

              <div className="card-elevated p-6">
                <h3 className="font-display text-xl mb-4">Tax & pricing (legacy)</h3>
                <p className="text-xs text-muted-foreground mb-3">Channel-wise pricing comes in the next batch. These fields stay for backward compatibility.</p>
                <div className="grid sm:grid-cols-3 gap-4">
                  <Field label="HSN"><Input value={form.hsn_code ?? ""} onChange={(e) => set("hsn_code", e.target.value)} /></Field>
                  <Field label="GST %"><Input type="number" value={form.gst_rate ?? ""} onChange={(e) => set("gst_rate", e.target.value)} /></Field>
                  <Field label="Currency"><Input value={form.currency ?? "INR"} onChange={(e) => set("currency", e.target.value)} /></Field>
                  <Field label="MRP"><Input type="number" value={form.mrp ?? ""} onChange={(e) => set("mrp", e.target.value)} /></Field>
                  <Field label="B2B price"><Input type="number" value={form.b2b_price ?? ""} onChange={(e) => set("b2b_price", e.target.value)} /></Field>
                  <Field label="Export price"><Input type="number" value={form.export_price ?? ""} onChange={(e) => set("export_price", e.target.value)} /></Field>
                </div>
              </div>
            </TabsContent>

            {/* OPS NOTES */}
            <TabsContent value="ops" className="space-y-6">
              <div className="card-elevated p-6 space-y-4">
                <Field label="Pricing notes">
                  <Textarea rows={3} value={form.pricing_notes ?? ""} onChange={(e) => set("pricing_notes", e.target.value)} placeholder="Example: MRP ₹1000; Bulk = MRP - 20%; Wholesale = MRP - 30%" />
                </Field>
                <Field label="Operational notes">
                  <Textarea rows={3} value={form.operational_notes ?? ""} onChange={(e) => set("operational_notes", e.target.value)} placeholder="Example: Supplied by 3rd Party Goods Store; required before assembly." />
                </Field>
                <div className="flex items-center justify-between border-t pt-3">
                  <div>
                    <Label>BOM required</Label>
                    <div className="text-[11px] text-muted-foreground">Auto-on for gift hampers. BOM builder ships in the next batch.</div>
                  </div>
                  <Switch checked={!!form.bom_required} onCheckedChange={(v) => set("bom_required", v)} />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* SIDEBAR */}
        <div className="space-y-6">
          <div className="card-elevated p-6 space-y-4">
            <h3 className="font-display text-xl">Status</h3>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={!!form.is_active} onCheckedChange={(v) => set("is_active", v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Catalogue-ready</Label>
              <Switch checked={!!form.is_catalogue_ready} onCheckedChange={(v) => set("is_catalogue_ready", v)} />
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
