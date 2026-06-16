import { lazy, Suspense, startTransition, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
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
import { ChannelMoqRules } from "@/components/ChannelMoqRules";
import { ChannelPricingRules } from "@/components/ChannelPricingRules";
import { AlertTriangle } from "lucide-react";
import {
  canWriteProductsDirectly,
  isCatalogueContributor,
} from "@/shared/auth/centralPermissions";
import { submitCatalogueDraft } from "@/features/catalogueDrafts/draftService";
import { CatalogueWriteModeBanner } from "@/components/CatalogueWriteModeBanner";
import { ProductTruthTabSkeleton } from "@/features/productTruth/ProductTruthTabSkeleton";

const ProductTruthAdminSection = lazy(() =>
  import("@/features/productTruth/ProductTruthAdminSection").then((m) => ({
    default: m.ProductTruthAdminSection,
  })),
);
import { AuthorityStatusBadges } from "@/components/catalogueAuthority/AuthorityStatusBadges";
import {
  stripUnapprovedComplianceFields,
  COMPLIANCE_SENSITIVE_FIELDS,
  type ComplianceSensitiveField,
  type ComplianceFieldMetaMap,
} from "@/lib/compliance/aiComplianceSafety";
import { createManualFieldMeta, canApproveComplianceFields } from "@/shared/ai/complianceApproval";
import {
  buildComplianceMetaFromSavedProduct,
  isPersistedComplianceApproved,
} from "@/shared/ai/compliancePersistence";
import {
  repairDirectMasterMediaRows,
  syncProductMediaAuthority,
} from "@/features/mediaReadiness/mediaAuthorityContract";
import {
  isTestingMediaGovernance,
  labelStatusInfoLine,
  mediaGovernanceStatusLine,
} from "@/features/mediaReadiness/mediaGovernanceDisplay";
import { buildProductReadinessSnapshot } from "@/features/readiness/productReadinessSnapshot";
import {
  mergeDraftOverAuthorityForm,
  stripAuthorityFieldsFromDraft,
} from "@/lib/formDraftAuthority";
import {
  repairDirectMasterPricingRows,
  syncChannelPricingFromForm,
} from "@/features/productAuthority/syncChannelPricingFromForm";
import { ComplianceAiPanel, trackManualComplianceEdit } from "@/features/compliance/ComplianceAiPanel";
import { applyCreationBaselineDefaults } from "@/features/productDefaults/applyDefaults";
import {
  dbRowToProductForm,
  formToDbProductPayload,
  formatProductSaveError,
  productSaveValidationMessage,
  stripUnknownProductFields,
  validateProductSavePayload,
} from "@/features/productAuthority/productSchemaAdapter";
import { assertStructuredSkuForSave } from "@/features/productAuthority/skuGuard";
import type { ProductMediaRow } from "@/features/mediaReadiness/mediaAssetsFromForm";
import {
  mapMoqRules,
  mapPricingRules,
  type MoqRuleRow,
  type PricingRuleRow,
} from "@/features/productTruth/channelAuthorityMappers";
import type { ChannelMoqRule, ChannelPriceRecord } from "@/features/productTruth/types";
import { resolveProductHeroUrl } from "@/lib/productImage";
import { Link } from "react-router-dom";
import { Zap } from "lucide-react";
import { ProductActionsMenu } from "@/features/productGovernance/ProductActionsMenu";

const PRODUCT_CLASSES = [
  { v: "bulk_loose_product", label: "Bulk / Loose product" },
  { v: "ready_pack", label: "Ready pack" },
  { v: "gift_hamper", label: "Gift / Hamper" },
  { v: "packaging_decoration_material", label: "Packaging / Decoration material" },
  { v: "semi_prepared_frozen", label: "Semi-prepared / Frozen" },
  { v: "service_or_customization", label: "Service / Customisation" },
];

const MAIN_DEPARTMENTS = [
  { v: "ready_goods_store", label: "Ready Goods Store" },
  { v: "packing_assembly", label: "Packing & Assembly Store" },
  { v: "third_party_goods_store", label: "Third Party Goods Store" },
];

const PRODUCTION_DEPARTMENTS = [
  { v: "arabic_sweets", label: "Arabic Sweets Department" },
  { v: "dragees", label: "Dragees Department" },
  { v: "fusion_sweets", label: "Fusion Sweets Department" },
  { v: "chocolates_confectionery", label: "Chocolate Department" },
  { v: "seasoned_nuts_mixes", label: "Seasoned Nuts & Mixes Department" },
  { v: "bakery", label: "Bakery Department" },
];

const UOM_OPTIONS = [
  "kg",
  "grams",
  "pcs",
  "box",
  "carton",
  "tray",
  "pack",
  "litre",
  "ml",
  "bundle",
  "basket",
  "jar",
  "packet",
  "tub",
];

const PRIMARY_PACK_TYPES = [
  { v: "Carton", label: "Carton" },
  { v: "Box", label: "Box" },
  { v: "Tray", label: "Tray" },
  { v: "Basket", label: "Basket" },
  { v: "Jar", label: "Jar" },
  { v: "Packet", label: "Packet" },
  { v: "Tub", label: "Tub" },
  { v: "NA", label: "NA" },
];

const PACK_UOM_OPTIONS = [
  "carton",
  "box",
  "tray",
  "basket",
  "jar",
  "packet",
  "tub",
  "pack",
  "pcs",
];

const CONTENT_UOM_OPTIONS = ["pcs", "kg", "grams", "ml", "litre"];

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

const PRODUCT_TYPE_PROFILES: Record<string, any> = {
  loose_bulk_material: {
    label: "Loose / Bulk Material",
    showPrivateLabel: false,
    showCustomization: false,
    showHamperBom: false,
  },
  prepacked_ready_packs: {
    label: "Prepacked Products / Ready Packs",
    showPrivateLabel: true,
    showCustomization: false,
    showHamperBom: false,
  },
  premium_gift_packs: {
    label: "Premium Gift Packs",
    showPrivateLabel: false,
    showCustomization: true,
    showHamperBom: true,
  },
  hamper_assorted_gift_pack: {
    label: "Hamper / Assorted Gift Pack",
    showPrivateLabel: false,
    showCustomization: true,
    showHamperBom: true,
  },
  semi_prepared_frozen_bake_and_serve: {
    label: "Semi-prepared / Frozen / Bake-and-Serve Products",
    showPrivateLabel: false,
    showCustomization: false,
    showHamperBom: false,
  },
  packaging_decoration_material: {
    label: "Packaging / Decoration Material",
    showPrivateLabel: false,
    showCustomization: false,
    showHamperBom: false,
  },
};

const CUSTOMIZATION_TYPES = [
  "logo printing",
  "name personalization",
  "message card",
  "sleeve",
  "ribbon",
  "custom box",
  "custom tray",
  "product assortment",
  "corporate branding",
  "wedding branding",
  "other",
];

const empty: any = {
  product_name: "",
  short_name: "",
  category: "",
  subcategory: "",
  product_type: "",
  description: "",
  short_description: "",
  pack_size: "",
  net_weight_g: "",
  gross_weight_g: "",
  shelf_life_days: "",
  storage_instructions: "",
  hsn_code: "",
  gst_rate: "",
  mrp: "",
  b2b_price: "",
  export_price: "",
  currency: "INR",
  moq_text: "",
  carton_logic: "",
  hero_image_url: "",
  is_active: true,
  is_catalogue_ready: false,
  sku: null,
  sku_locked: true,
  division_code: null,
  category_code: null,
  subcategory_code: null,
  packaging_code: null,
  legacy_sku: null,

  product_class: "",
  main_department: "",
  production_department: "",
  primary_uom: "",
  b2b_uom: "",
  retail_uom: "",
  price_basis: "",
  b2b_price_basis: "",
  retail_price_basis: "",
  unit_conversion_note: "",
  pieces_per_kg: "",
  approximate_piece_weight_g: "",

  primary_pack_type: "",
  primary_pack_uom: "",
  qty_per_pack: "",
  qty_content_uom: "",
  pcs_per_pack: "",

  moq_rule_type: "",
  moq_value: "",
  moq_uom: "",
  increment_value: "",
  increment_uom: "",
  fixed_carton_required: false,
  carton_qty: "",
  carton_uom: "",
  master_carton_qty: "",
  master_carton_uom: "",
  dimension_l_cm: "",
  dimension_w_cm: "",
  dimension_h_cm: "",
  material_type: "",
  color_finish_notes: "",
  private_label_allowed: false,
  private_label_moq: "",
  private_label_moq_uom: "",
  private_label_cost_per_unit: "",
  private_label_upfront_cost: "",
  customization_allowed: false,
  customization_note: "",
  customization_caution: "",
  customization_types: [],
  bom_required: false,
  pricing_notes: "",
  operational_notes: "",
  frozen_shelf_life_days: "",
  post_processing_shelf_life_days: "",
  temperature_requirement: "",
  thawing_instruction: "",

  ingredients: "",
  allergen_warnings: "",
  nutritional_info: "",
  nutrition_facts: "",
  dimensions: "",
  material: "",
  product_family: "",
};

const NUMERIC_FIELDS = [
  "net_weight_g",
  "gross_weight_g",
  "shelf_life_days",
  "gst_rate",
  "mrp",
  "b2b_price",
  "export_price",
  "pieces_per_kg",
  "approximate_piece_weight_g",
  "qty_per_pack",
  "pcs_per_pack",
  "moq_value",
  "increment_value",
  "carton_qty",
  "master_carton_qty",
  "dimension_l_cm",
  "dimension_w_cm",
  "dimension_h_cm",
  "private_label_moq",
  "private_label_cost_per_unit",
  "private_label_upfront_cost",
  "frozen_shelf_life_days",
  "post_processing_shelf_life_days",
];

const Field = ({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) => (
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
      typeof o === "string" ? (
        <option key={o} value={o}>
          {o}
        </option>
      ) : (
        <option key={o.v} value={o.v}>
          {o.label}
        </option>
      )
    )}
  </select>
);

const toBlank = (v: any) => (v === null || v === undefined ? "" : v);

const cleanText = (value: any) => String(value ?? "").trim().toLowerCase();

const getPrimaryPackPreview = (form: any) => {
  if (!form?.primary_pack_uom || !form?.qty_per_pack || !form?.qty_content_uom) {
    return "";
  }

  return `1 ${form.primary_pack_uom} = ${form.qty_per_pack} ${form.qty_content_uom}`;
};

const primaryPackTypeToUom = (type: string) => {
  switch (type) {
    case "Carton":
      return "carton";
    case "Box":
      return "box";
    case "Tray":
      return "tray";
    case "Basket":
      return "basket";
    case "Jar":
      return "jar";
    case "Packet":
      return "packet";
    case "Tub":
      return "tub";
    case "NA":
      return "";
    default:
      return "";
  }
};

const normalizeMainDepartment = (data: any) => {
  const dept = cleanText(data?.department);
  const prod = cleanText(data?.production_department);
  const cat = cleanText(data?.category);
  const sub = cleanText(data?.sub_category);
  const family = cleanText(data?.product_family);
  const name = cleanText(data?.name);

  const combined = `${dept} ${prod} ${cat} ${sub} ${family} ${name}`;

  const isPackagingMaterial =
    dept.includes("packing material") ||
    prod.includes("3rd party") ||
    prod.includes("third party") ||
    cat.includes("packaging & decoration") ||
    sub.includes("packaging accessories") ||
    sub.includes("goldware") ||
    sub.includes("tray") ||
    sub.includes("trays") ||
    sub.includes("basket") ||
    sub.includes("baskets") ||
    combined.includes("packing material");

  if (isPackagingMaterial) {
    return "third_party_goods_store";
  }

  const isReadyPackOrGift =
    cat.includes("ready packs") ||
    cat.includes("premium gift") ||
    cat.includes("gifts & hampers") ||
    sub === "gifts" ||
    sub.includes("gift") ||
    sub.includes("hamper") ||
    name.includes("hamper") ||
    name.includes("gift");

  if (isReadyPackOrGift) {
    return "packing_assembly";
  }

  const isNonBulkPackagingAssembly =
    dept.includes("packaging assembly") &&
    !cat.includes("bulk sweets") &&
    !sub.includes("dates") &&
    !sub.includes("dragees") &&
    !sub.includes("baklawa") &&
    !sub.includes("fusion") &&
    !sub.includes("nuts") &&
    !sub.includes("chocolates");

  if (isNonBulkPackagingAssembly) {
    return "packing_assembly";
  }

  return "ready_goods_store";
};

const normalizeProductionDepartment = (data: any) => {
  const mainDepartment = normalizeMainDepartment(data);

  if (mainDepartment !== "ready_goods_store") {
    return "";
  }

  const dept = cleanText(data?.department);
  const prod = cleanText(data?.production_department);
  const cat = cleanText(data?.category);
  const sub = cleanText(data?.sub_category);
  const name = cleanText(data?.name);

  if (
    sub.includes("dragee") ||
    sub.includes("dragees") ||
    prod.includes("dragee") ||
    prod.includes("dragees") ||
    name.includes("dragee") ||
    name.includes("dragees")
  ) {
    return "dragees";
  }

  if (
    sub.includes("fusion ball") ||
    sub.includes("fusion bite") ||
    prod.includes("fusion sweets") ||
    dept.includes("fusion sweets") ||
    cat.includes("fusion") ||
    sub.includes("fusion")
  ) {
    return "fusion_sweets";
  }

  if (
    sub.includes("dates") ||
    sub.includes("date") ||
    name.includes("chocodate") ||
    name.includes("chocodates") ||
    name.includes("khajoor") ||
    name.includes("tamaar") ||
    name.includes("tamoor") ||
    name.includes("tammar")
  ) {
    return "chocolates_confectionery";
  }

  if (
    sub.includes("baklawa") ||
    sub.includes("kadayif") ||
    sub.includes("kunafa") ||
    dept.includes("arabic sweets") ||
    prod.includes("arabic sweets")
  ) {
    return "arabic_sweets";
  }

  if (
    dept.includes("nuts roasting") ||
    prod.includes("seasoned nuts") ||
    sub.includes("nuts") ||
    name.includes("nuts")
  ) {
    return "seasoned_nuts_mixes";
  }

  if (
    dept.includes("confectionery") ||
    dept.includes("chocolate") ||
    prod.includes("chocolate") ||
    sub.includes("chocolate") ||
    sub.includes("chocolates") ||
    name.includes("chocolate") ||
    name.includes("toffee")
  ) {
    return "chocolates_confectionery";
  }

  if (
    dept.includes("bakery") ||
    prod.includes("bakery") ||
    cat.includes("bakery") ||
    name.includes("cake") ||
    name.includes("cookie") ||
    name.includes("biscuit")
  ) {
    return "bakery";
  }

  return "";
};

const inferProductClass = (data: any) => {
  const text = [
    data?.product_family,
    data?.category,
    data?.sub_category,
    data?.name,
    data?.pack_size,
    data?.carton_type,
    data?.storage_type,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (text.includes("frozen") || text.includes("semi")) return "semi_prepared_frozen";
  if (text.includes("hamper") || text.includes("gift")) return "gift_hamper";
  if (text.includes("packaging & decoration")) return "packaging_decoration_material";
  if (text.includes("ready packs") || text.includes("pack")) return "ready_pack";

  return "bulk_loose_product";
};

const dbProductToForm = (data: any) => {
  const loaded = dbRowToProductForm(data, empty);
  const mainDepartment = loaded.main_department || normalizeMainDepartment(data);
  return {
    ...loaded,
    main_department: mainDepartment,
    production_department:
      mainDepartment === "ready_goods_store"
        ? loaded.production_department || normalizeProductionDepartment(data)
        : "",
    product_class: loaded.product_class || inferProductClass(data),
    bom_required: mainDepartment === "packing_assembly" ? true : !!loaded.bom_required,
  };
};

const formToProductRow = (form: any) => formToDbProductPayload(form);

const pickComplianceBaseline = (form: Record<string, unknown>) => {
  const baseline: Record<string, unknown> = {};
  for (const field of COMPLIANCE_SENSITIVE_FIELDS) {
    baseline[field] = form[field] ?? null;
  }
  return baseline;
};

const ProductEdit = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const duplicateFrom = searchParams.get("duplicateFrom");
  const isNew = !id || id === "new";
  const nav = useNavigate();
  const { roles } = useAuth();

  const canOverride = roles.includes("owner") || roles.includes("admin");
  const authContextContributor = roles.includes("catalogue_contributor");

  const [form, setForm] = useState<any>(empty);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [rpcContributorRole, setRpcContributorRole] = useState(false);
  const [languageTermsRefreshKey, setLanguageTermsRefreshKey] = useState(0);

  const tabKey = `oasis_product_edit_tab_${id ?? "new"}`;
  const [tab, setTab] = useState<string>(() => {
    try {
      return localStorage.getItem(tabKey) || "identity";
    } catch {
      return "identity";
    }
  });

  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [productMediaRows, setProductMediaRows] = useState<ProductMediaRow[]>([]);
  const [pricingRuleRows, setPricingRuleRows] = useState<PricingRuleRow[]>([]);
  const [moqRuleRows, setMoqRuleRows] = useState<MoqRuleRow[]>([]);
  const [channelPrices, setChannelPrices] = useState<ChannelPriceRecord[]>([]);
  const [channelMoqRules, setChannelMoqRules] = useState<ChannelMoqRule[]>([]);
  const [dirty, setDirty] = useState(false);
  const restored = useRef(false);
  const complianceBaselineRef = useRef<Record<string, unknown>>({});
  const [complianceMetaMap, setComplianceMetaMap] = useState<ComplianceFieldMetaMap>({});
  const draftKey = isNew
    ? "catalogue_product_form_draft_new"
    : `catalogue_product_form_draft_${id}`;

  const isContributorMode = authContextContributor || rpcContributorRole;

  const setComplianceField = (field: ComplianceSensitiveField, value: unknown) => {
    if (canApproveComplianceFields(roles)) {
      setComplianceMetaMap((prev) => ({ ...prev, [field]: createManualFieldMeta() }));
    } else {
      trackManualComplianceEdit(field, setComplianceMetaMap, () => {});
    }
    set(field, value);
  };

  const complianceMetaPending = useMemo(
    () =>
      Object.values(complianceMetaMap).some(
        (m) => m?.source === "ai_suggestion" && !m?.approved,
      ),
    [complianceMetaMap],
  );

  const complianceApproved = useMemo(
    () => isPersistedComplianceApproved(complianceMetaMap, complianceMetaPending),
    [complianceMetaMap, complianceMetaPending],
  );

  const primaryPackPreview = getPrimaryPackPreview(form);

  const primaryPackTypeNeedsUom =
    !!form.primary_pack_type &&
    form.primary_pack_type !== "NA" &&
    !form.primary_pack_uom;

  const qtyContentUomMissing =
    !!form.qty_per_pack && !form.qty_content_uom;

  const moqUomMismatch =
    !!form.moq_uom &&
    !!form.increment_uom &&
    form.moq_uom !== form.increment_uom;

  useEffect(() => {
    if (!isNew) return;
    setForm((f: any) => {
      const next = applyCreationBaselineDefaults(f);
      complianceBaselineRef.current = pickComplianceBaseline(next);
      return next;
    });
  }, [isNew]);

  useEffect(() => {
    if (!isNew || !duplicateFrom) return;

    void (async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", duplicateFrom)
        .single();

      if (error || !data) {
        toast.error("Could not load product to duplicate");
        return;
      }

      const loaded = dbProductToForm(data);
      const duplicated = {
        ...loaded,
        id: undefined,
        sku: null,
        sku_locked: false,
        product_name: `${loaded.product_name || loaded.name || "Product"} (copy)`.trim(),
        is_catalogue_ready: false,
        label_status: "draft",
        archived_at: null,
        archived_by: null,
      };
      complianceBaselineRef.current = pickComplianceBaseline(duplicated);
      setComplianceMetaMap({});
      setForm(duplicated);
      setDirty(true);
      toast.success("Duplicated — assign a new SKU before saving");
    })();
  }, [isNew, duplicateFrom]);

  useEffect(() => {
    let mounted = true;

    isCatalogueContributor()
      .then((value) => {
        if (mounted) setRpcContributorRole(!!value);
      })
      .catch((error) => {
        if (import.meta.env.DEV) {
          console.error("[ProductEdit] contributor role lookup failed:", error);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(tabKey, tab);
    } catch {}
  }, [tab, tabKey]);

  const readinessSnapshot = useMemo(() => {
    if (isNew || !id) return null;
    return buildProductReadinessSnapshot(
      { ...form, id },
      {
        productMediaRows,
        pricingRows: pricingRuleRows,
        moqRows: moqRuleRows,
      },
      { complianceApproved, complianceMetaPending },
    );
  }, [
    isNew,
    id,
    form,
    productMediaRows,
    pricingRuleRows,
    moqRuleRows,
    channelMoqRules,
    complianceApproved,
    complianceMetaPending,
  ]);

  const applyMediaAuthority = async (productId: string, rows: ProductMediaRow[]) => {
    let authoritative = rows;
    if (await canWriteProductsDirectly(roles)) {
      authoritative = await repairDirectMasterMediaRows(productId, rows);
      try {
        const synced = await syncProductMediaAuthority(productId, authoritative);
        setForm((f: Record<string, unknown>) => ({
          ...f,
          media_status: synced.media_status,
          hero_image_url: synced.hero_image_url,
          image_url: synced.hero_image_url,
        }));
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn("[ProductEdit] media authority sync failed:", err);
        }
      }
    }
    setProductMediaRows(authoritative);
  };

  const loadProductMedia = async (productId: string) => {
    const { data, error } = await supabase
      .from("product_media")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });
    if (error) {
      if (import.meta.env.DEV) {
        console.error("[ProductEdit] product_media load failed:", error.message);
      }
      return;
    }
    await applyMediaAuthority(productId, data ?? []);
  };

  const loadChannelAuthority = async (productId: string) => {
    const [pricingRes, moqRes] = await Promise.all([
      supabase.from("product_pricing_rules").select("*").eq("product_id", productId),
      supabase.from("product_moq_rules").select("*").eq("product_id", productId),
    ]);
    if (pricingRes.error && import.meta.env.DEV) {
      console.error("[ProductEdit] pricing rules load failed:", pricingRes.error.message);
    }
    if (moqRes.error && import.meta.env.DEV) {
      console.error("[ProductEdit] moq rules load failed:", moqRes.error.message);
    }
    setChannelPrices(mapPricingRules((pricingRes.data ?? []) as PricingRuleRow[]));
    setPricingRuleRows((pricingRes.data ?? []) as PricingRuleRow[]);
    setChannelMoqRules(mapMoqRules((moqRes.data ?? []) as MoqRuleRow[]));
    setMoqRuleRows((moqRes.data ?? []) as MoqRuleRow[]);
    if (await canWriteProductsDirectly(roles)) {
      const repair = await repairDirectMasterPricingRows(productId);
      if (repair.repaired > 0) {
        const { data: refreshed } = await supabase
          .from("product_pricing_rules")
          .select("*")
          .eq("product_id", productId);
        const rows = (refreshed ?? []) as PricingRuleRow[];
        setPricingRuleRows(rows);
        setChannelPrices(mapPricingRules(rows));
      }
    }
  };

  const reloadProductAuthority = async (productId: string) => {
    await Promise.all([loadProductMedia(productId), loadChannelAuthority(productId)]);
  };

  useEffect(() => {
    if (isNew || !id || loadedId === id) return;

    (supabase as any)
      .from("products")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data, error }: any) => {
        if (error) {
          toast.error(error.message);
          return;
        }

        if (data) {
          const loaded = dbProductToForm(data);
          complianceBaselineRef.current = pickComplianceBaseline(loaded);
          setComplianceMetaMap(buildComplianceMetaFromSavedProduct(loaded));
          setLoadedId(id);
          setForm(loaded);
          void reloadProductAuthority(id);
        }
      });
  }, [id, isNew, loadedId]);

  const set = (k: string, v: any) => {
    setDirty(true);
    setSubmitError(null);
    setForm((f: any) => ({ ...f, [k]: v }));
  };

  const patch = (p: any) => {
    setDirty(true);
    setSubmitError(null);
    setForm((f: any) => ({ ...f, ...p }));
  };

  useEffect(() => {
    if (restored.current) return;

    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const draft = JSON.parse(raw) as Record<string, unknown>;
        setForm((f: Record<string, unknown>) => mergeDraftOverAuthorityForm(f, draft));
      }
    } catch {}

    restored.current = true;
  }, [draftKey]);

  useEffect(() => {
    if (!restored.current) return;

    try {
      localStorage.setItem(draftKey, JSON.stringify(stripAuthorityFieldsFromDraft(form)));
    } catch {}
  }, [draftKey, form]);

  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [dirty]);

  useEffect(() => {
    if (form.main_department !== "packing_assembly") return;

    setForm((f: any) => {
      if (f.bom_required === true && !f.production_department) return f;

      return {
        ...f,
        bom_required: true,
        production_department: "",
      };
    });
  }, [form.main_department]);

  useEffect(() => {
    if (form.main_department !== "third_party_goods_store") return;

    setForm((f: any) => {
      if (!f.production_department) return f;
      return { ...f, production_department: "" };
    });
  }, [form.main_department]);

  useEffect(() => {
    if (!form.primary_pack_uom) return;

    setForm((f: any) => {
      const next = { ...f };
      let changed = false;

      if (!next.moq_uom) {
        next.moq_uom = form.primary_pack_uom;
        changed = true;
      }

      if (!next.increment_uom) {
        next.increment_uom = form.primary_pack_uom;
        changed = true;
      }

      return changed ? next : f;
    });
  }, [form.primary_pack_uom]);

  useEffect(() => {
    if (form.product_class === "gift_hamper") {
      setForm((f: any) => {
        const next = {
          ...f,
          main_department: "packing_assembly",
          bom_required: true,
          production_department: "",
        };

        if (
          f.main_department === next.main_department &&
          f.bom_required === next.bom_required &&
          f.production_department === next.production_department
        ) {
          return f;
        }

        return next;
      });
    }

    if (form.product_class === "packaging_decoration_material") {
      setForm((f: any) => {
        const next = {
          ...f,
          main_department: f.main_department || "third_party_goods_store",
          production_department: "",
          fixed_carton_required: true,
        };

        if (
          f.main_department === next.main_department &&
          f.production_department === next.production_department &&
          f.fixed_carton_required === next.fixed_carton_required
        ) {
          return f;
        }

        return next;
      });
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.product_class]);

  useEffect(() => {
    if (form.customization_allowed && !form.customization_caution) {
      set("customization_caution", DEFAULT_CAUTION);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.customization_allowed]);

  const cls = form.product_class;
  const isPackingAssembly = form.main_department === "packing_assembly";
  const profile = PRODUCT_TYPE_PROFILES[form.product_type || ""] || {};
  const showPrivateLabel = !!profile.showPrivateLabel || cls === "ready_pack";
  const showCustomization =
    !!profile.showCustomization ||
    cls === "gift_hamper" ||
    cls === "service_or_customization";
  const showDimensions =
    cls === "packaging_decoration_material" || form.fixed_carton_required;
  const showFrozen = cls === "semi_prepared_frozen";
  const canManageBom =
    roles.includes("owner") ||
    roles.includes("admin") ||
    roles.includes("product_manager");

  const bomRelevant =
    isPackingAssembly ||
    cls === "ready_pack" ||
    cls === "gift_hamper" ||
    cls === "packaging_decoration_material" ||
    !!form.bom_required;

  const showBom = bomRelevant || canManageBom;

  const expectedBomType =
    cls === "gift_hamper"
      ? "hamper_bom"
      : cls === "ready_pack" || isPackingAssembly
        ? "internal_bom"
        : null;

  const missing = useMemo(() => {
    const m: string[] = [];

    if (!form.product_name) m.push("Product name");
    if (!form.product_class) m.push("Product class");
    if (!form.product_type && !form.category) {
      m.push("Product type or category");
    }

    if (isContributorMode) return m;

    if (!form.sku) m.push("SKU");
    if (!form.main_department) m.push("Main department");
    if (form.main_department === "ready_goods_store" && !form.production_department) {
      m.push("Production department");
    }
    if (
      form.private_label_allowed &&
      (!form.private_label_moq || !form.private_label_cost_per_unit)
    ) {
      m.push("Private label MOQ & cost");
    }

    return m;
  }, [form, isContributorMode]);

  const save = async () => {
    setSubmitError(null);

    if (missing.length > 0) {
      const message =
        missing.length === 1 && missing[0] === "Product name"
          ? "Product name is required."
          : isContributorMode
            ? `Draft not submitted: missing ${missing.join(", ")}`
            : `Fix missing fields: ${missing.join(", ")}`;

      setSubmitError(message);
      toast.error(message);
      return;
    }

    setLoading(true);

    const payload: any = {
      ...form,
      bom_required: isPackingAssembly || !!form.bom_required,
      production_department:
        form.main_department === "ready_goods_store"
          ? form.production_department
          : null,
    };

    NUMERIC_FIELDS.forEach((k) => {
      payload[k] = payload[k] === "" || payload[k] == null ? null : Number(payload[k]);
    });

    Object.keys(payload).forEach((k) => {
      if (payload[k] === "") payload[k] = null;
    });

    [
      "is_active",
      "is_catalogue_ready",
      "sku_locked",
      "fixed_carton_required",
      "private_label_allowed",
      "customization_allowed",
      "bom_required",
    ].forEach((k) => {
      payload[k] = k === "bom_required" ? isPackingAssembly || !!form[k] : !!form[k];
    });

    const direct = await canWriteProductsDirectly(roles);
    const contributor = isContributorMode || (await isCatalogueContributor());

    if (direct) {
      const safePayload = stripUnapprovedComplianceFields(
        payload,
        roles,
        complianceBaselineRef.current,
        complianceMetaMap,
      );

      const skuGuard = assertStructuredSkuForSave(safePayload.sku);
      if (!skuGuard.ok) {
        setLoading(false);
        setSubmitError(skuGuard.reason);
        toast.error(skuGuard.reason);
        return;
      }

      const productRow = formToProductRow(safePayload);
      const validation = validateProductSavePayload(productRow, isNew ? "create" : "update");
      if (!validation.ok) {
        const message = productSaveValidationMessage(validation);
        setLoading(false);
        setSubmitError(message);
        toast.error(message);
        return;
      }

      const res = isNew
        ? await (supabase as any).from("products").insert(productRow).select().single()
        : await (supabase as any).from("products").update(productRow).eq("id", id).select().single();

      setLoading(false);

      if (res.error) {
        const message = formatProductSaveError(res.error);
        setSubmitError(message);
        toast.error(message);
        return;
      }

      const savedId = res.data.id as string;
      const pricingSync = await syncChannelPricingFromForm(safePayload, savedId, "direct");
      if (!pricingSync.ok && pricingSync.message) {
        toast.warning(`Product saved; channel pricing sync failed: ${pricingSync.message}`);
      } else if (pricingSync.count > 0) {
        await loadChannelAuthority(savedId);
      }

      const reloaded = dbProductToForm(res.data);
      complianceBaselineRef.current = pickComplianceBaseline(reloaded);
      setComplianceMetaMap(buildComplianceMetaFromSavedProduct(reloaded));

      try {
        localStorage.removeItem(draftKey);
      } catch {}

      setDirty(false);
      toast.success("Saved");
      nav(`/products/${res.data.id}`);
      return;
    }

    if (contributor) {
      const packPreview = getPrimaryPackPreview(payload);

      const optionalReviewFlags = {
        sku: true,
        pricing: true,
        compliance: true,
        nutrition: true,
        bom_mapping: true,
        main_department: !payload.main_department,
        production_department:
          payload.main_department === "ready_goods_store" && !payload.production_department,
        moq: !payload.moq_value,
        private_label_terms:
          !!payload.private_label_allowed &&
          (!payload.private_label_moq || !payload.private_label_cost_per_unit),
      };

      const groupedPayload = {
        identity: {
          product_name: payload.product_name,
          original_name: payload.short_name,
          product_class: payload.product_class,
          product_type: payload.product_type,
          category: payload.category,
          subcategory: payload.subcategory,
          description: payload.description,
          short_description: payload.short_description,
          main_department: payload.main_department,
          production_department: payload.production_department,
        },
        aliases: {
          suggested_aliases: [payload.product_name, payload.short_name].filter(Boolean),
        },
        sku_draft: {
          sku: payload.sku,
          division_code: payload.division_code,
          category_code: payload.category_code,
          subcategory_code: payload.subcategory_code,
          packaging_code: payload.packaging_code,
          note: "SKU will be generated/finalized by admin during approval.",
        },
        uom: {
          primary_uom: payload.primary_uom,
          b2b_uom: payload.b2b_uom,
          retail_uom: payload.retail_uom,
          approx_piece_weight_g: payload.approximate_piece_weight_g,
          pieces_per_kg: payload.approximate_piece_weight_g
            ? Number((1000 / Number(payload.approximate_piece_weight_g)).toFixed(2))
            : payload.pieces_per_kg,
          unit_conversion_note:
            payload.unit_conversion_note || "Manual conversion required",
        },
        packing: {
          primary_pack_type: payload.primary_pack_type || payload.packaging_code || "NA",
          pack_uom: payload.primary_pack_uom || payload.carton_uom,
          qty_per_pack: payload.qty_per_pack || payload.pcs_per_pack,
          qty_content_uom: payload.qty_content_uom,
          pack_preview: packPreview,
          pack_size: payload.pack_size,
          net_weight_g: payload.net_weight_g,
          gross_weight_g: payload.gross_weight_g,
          legacy_moq_note:
            payload.carton_logic || "Advanced carton logic will be finalized in Central App.",
        },
        moq: {
          b2b_moq: payload.moq_value,
          retail_moq: null,
          moq_rule_type: payload.moq_rule_type,
          moq_value: payload.moq_value,
          moq_uom: payload.moq_uom,
          increment_value: payload.increment_value,
          increment_uom: payload.increment_uom,
        },
        pricing: {
          hsn: payload.hsn_code,
          gst_rate: payload.gst_rate,
          currency: payload.currency,
          mrp: payload.mrp,
          bulk_price: payload.mrp
            ? Math.round((Number(payload.mrp) * 0.8) / 10) * 10
            : null,
          wholesale_price: payload.mrp
            ? Math.round((Number(payload.mrp) * 0.7) / 10) * 10
            : null,
          b2b_price: payload.b2b_price,
          export_price: payload.export_price ? Math.round(Number(payload.export_price)) : null,
        },
        compliance: {
          ingredients: payload.ingredients,
          allergen_information: payload.allergen_warnings || "Suggested — please review",
          nutritional_information:
            payload.nutritional_info || payload.nutrition_facts || "Draft placeholder only",
          shelf_life_days: payload.shelf_life_days,
          storage_instructions: payload.storage_instructions,
          manufactured_by: "TCF Chocolates and Gifts Pvt Ltd",
          production_unit: "10/62 Kirti Nagar Industrial Area, New Delhi 110015",
          customer_care: "Call +91-9999792959 | E-Mail: help@oasisbaklawa.com",
          complaint_text:
            "If dissatisfied, tell us why and send the packet(s) along with bill of purchase to the above-mentioned address.",
          label_disclaimer: "Draft label data — requires admin/compliance approval.",
        },
        private_label: {
          available: payload.private_label_allowed,
          moq: payload.private_label_moq,
          moq_uom: payload.private_label_moq_uom,
          cost_per_pc: payload.private_label_cost_per_unit,
          setup_cost: payload.private_label_upfront_cost,
        },
        customization: {
          available: payload.customization_allowed,
          types: payload.customization_types || [],
          note: payload.customization_note,
          caution: payload.customization_caution,
        },
        bom: {
          required: payload.bom_required,
          expected_type:
            payload.product_class === "gift_hamper"
              ? "hamper_bom"
              : payload.product_class === "ready_pack" || payload.main_department === "packing_assembly"
                ? "internal_bom"
                : null,
          internal_bom: payload.internal_bom || [],
          hamper_bom: payload.hamper_bom || [],
        },
        ops: {
          operational_notes: payload.operational_notes,
          pricing_notes: payload.pricing_notes,
          material_type: payload.material_type,
          dimensions: buildDimensionsText(payload),
        },
        selling_profile: form.product_type || form.product_class,
        auto_generated_flags: {
          aliases: true,
          descriptions: true,
          pricing_suggestions: true,
          compliance_suggestions: true,
        },
        needs_admin_review_flags: optionalReviewFlags,
      };

      const draftRes = await submitCatalogueDraft({
        draftType: "product",
        operation: isNew ? "create" : "update",
        payload: groupedPayload,
        targetRecordId: isNew ? null : (id as string),
      });

      setLoading(false);

      if (!draftRes.ok) {
        const message = `Draft submit failed: ${draftRes.message}`;
        setSubmitError(message);
        toast.error(message);
        return;
      }

      try {
        localStorage.removeItem(draftKey);
      } catch {}

      setDirty(false);
      toast.success(draftRes.message);
      nav("/products");
      return;
    }

    setLoading(false);
    toast.error("Read-only mode: you do not have permission to save products.");
  };

  return (
    <>
      <CatalogueWriteModeBanner />

      <PageHeader
        title={isNew ? "New Product" : form.product_name || "Edit Product"}
        subtitle="Master record · catalogue, label, and media-ready."
        actions={
          <>
            {!isNew && id && (
              <ProductActionsMenu
                product={{
                  id,
                  sku: form.sku,
                  product_name: form.product_name,
                  name: form.name,
                  archived_at: form.archived_at,
                }}
                onChanged={() => nav("/products")}
              />
            )}
            <Button
              variant="outline"
              onClick={() => {
                if (dirty && !window.confirm("You have unsaved changes. Leave this form?")) return;
                nav("/products");
              }}
            >
              Back
            </Button>
            <Button onClick={save} disabled={loading}>
              {loading ? "Saving…" : isContributorMode ? "Submit Draft" : "Save"}
            </Button>
          </>
        }
      />

      {submitError && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 mt-0.5" />
          <div>{submitError}</div>
        </div>
      )}

      {missing.length > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 mt-0.5 text-warning" />
          <div>
            <span className="font-medium">
              {isContributorMode ? "Draft needs:" : "Fix missing fields:"}
            </span>{" "}
            {missing.join(" · ")}
          </div>
        </div>
      )}

      {(dirty || isContributorMode) && (
        <div className="mb-4">
          <AuthorityStatusBadges
            show={{
              authority_draft: dirty || isContributorMode,
              not_synced_to_central: true,
              central_live_write_disabled: true,
            }}
          />
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6 min-w-0">
        <div className="lg:col-span-2 space-y-6 min-w-0">
          <Tabs
            value={tab}
            onValueChange={(value) => {
              startTransition(() => setTab(value));
            }}
          >
            <div className="-mx-3 sm:mx-0 overflow-x-auto border-b border-border/60 mb-4">
              <TabsList className="flex h-auto w-max min-w-full justify-start gap-1 bg-transparent px-3 sm:px-0 py-0">
                <TabsTrigger value="identity" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 py-2 luxe-sub data-[state=active]:text-foreground">
                  Identity
                </TabsTrigger>
                <TabsTrigger value="uom" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 py-2 luxe-sub data-[state=active]:text-foreground">
                  UOM / MOQ
                </TabsTrigger>
                {!isNew && (
                  <TabsTrigger value="media" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 py-2 luxe-sub data-[state=active]:text-foreground">
                    {isTestingMediaGovernance() ? "Hero image" : "Media"}
                  </TabsTrigger>
                )}
                {showPrivateLabel && (
                  <TabsTrigger value="private_label" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 py-2 luxe-sub data-[state=active]:text-foreground">
                    Private Label
                  </TabsTrigger>
                )}
                {showCustomization && (
                  <TabsTrigger value="customisation" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 py-2 luxe-sub data-[state=active]:text-foreground">
                    Customisation
                  </TabsTrigger>
                )}
                {showDimensions && (
                  <TabsTrigger value="dimensions" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 py-2 luxe-sub data-[state=active]:text-foreground">
                    Dimensions
                  </TabsTrigger>
                )}
                {showFrozen && (
                  <TabsTrigger value="frozen" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 py-2 luxe-sub data-[state=active]:text-foreground">
                    Frozen
                  </TabsTrigger>
                )}
                {showBom && (
                  <TabsTrigger value="bom" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 py-2 luxe-sub data-[state=active]:text-foreground">
                    BOM
                  </TabsTrigger>
                )}
                {!isNew && (
                  <TabsTrigger value="channels" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 py-2 luxe-sub data-[state=active]:text-foreground">
                    Business Rules
                  </TabsTrigger>
                )}
                <TabsTrigger value="compliance" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 py-2 luxe-sub data-[state=active]:text-foreground">
                  Compliance
                </TabsTrigger>
                <TabsTrigger value="ops" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 py-2 luxe-sub data-[state=active]:text-foreground">
                  Ops Notes
                </TabsTrigger>
                {!isNew && (
                  <TabsTrigger value="product_truth" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 py-2 luxe-sub data-[state=active]:text-foreground">
                    Product Truth
                  </TabsTrigger>
                )}
              </TabsList>
            </div>

            <TabsContent value="identity" className="space-y-6">
              <div className="card-elevated p-6 grid sm:grid-cols-2 gap-4">
                <Field label="Product Name *">
                  <Input value={form.product_name} onChange={(e) => set("product_name", e.target.value)} placeholder="Example: Cashew Pyramid Baklawa / Baklawa Acrylic Box 6 pcs" />
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

                <Field label={isContributorMode ? "Main Department" : "Main Department *"} hint={isContributorMode ? "Optional for draft. Admin can finalize during approval." : "Order first routes to RGS, Packing & Assembly, or Third Party Goods Store."}>
                  <Select value={form.main_department} onChange={(v: string) => set("main_department", v)} options={MAIN_DEPARTMENTS} />
                </Field>

                {form.main_department === "ready_goods_store" && (
                  <Field label={isContributorMode ? "Production Department" : "Production Department *"}>
                    <Select value={form.production_department} onChange={(v: string) => set("production_department", v)} options={PRODUCTION_DEPARTMENTS} />
                  </Field>
                )}

                <div className="sm:col-span-2">
                  <Field label="Short description">
                    <Input value={form.short_description ?? ""} onChange={(e) => set("short_description", e.target.value)} placeholder="Example: Premium pyramid-shaped baklawa filled with roasted cashews." />
                  </Field>
                </div>

                <div className="sm:col-span-2">
                  <Field label="Description">
                    <Textarea rows={4} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} />
                  </Field>
                </div>
              </div>

              <SkuBuilder value={form} canOverride={canOverride} onChange={patch} />

              {isContributorMode && (
                <div className="rounded-md border border-accent/30 bg-accent-soft/30 p-3 text-xs text-muted-foreground">
                  SKU will be generated/finalized by admin during approval.
                </div>
              )}

              {!isNew && (
                <AliasManager
                  id="product-language-terms"
                  productId={id!}
                  productName={form.product_name ?? ""}
                  onAliasesChange={() => setLanguageTermsRefreshKey((n) => n + 1)}
                />
              )}
            </TabsContent>

            <TabsContent value="uom" className="space-y-6">
              <div className="card-elevated p-6 space-y-5">
                <div>
                  <h3 className="font-display text-xl mb-1">Unit of measure</h3>
                  <p className="text-xs text-muted-foreground">Define the base selling and pricing unit before packing and MOQ.</p>
                </div>

                <div className="grid sm:grid-cols-3 gap-4">
                  <Field label="Primary UOM">
                    <Select value={form.primary_uom} onChange={(v: string) => set("primary_uom", v)} options={UOM_OPTIONS} />
                  </Field>
                  <Field label="B2B UOM">
                    <Select value={form.b2b_uom} onChange={(v: string) => set("b2b_uom", v)} options={UOM_OPTIONS} />
                  </Field>
                  <Field label="Retail UOM">
                    <Select value={form.retail_uom} onChange={(v: string) => set("retail_uom", v)} options={UOM_OPTIONS} />
                  </Field>
                  <Field label="Price basis">
                    <Input value={form.price_basis ?? ""} onChange={(e) => set("price_basis", e.target.value)} placeholder="per kg / per pc / per 100g" />
                  </Field>
                  <Field label="B2B price basis">
                    <Input value={form.b2b_price_basis ?? ""} onChange={(e) => set("b2b_price_basis", e.target.value)} placeholder="per kg" />
                  </Field>
                  <Field label="Retail price basis">
                    <Input value={form.retail_price_basis ?? ""} onChange={(e) => set("retail_price_basis", e.target.value)} placeholder="per pc / per 100g" />
                  </Field>

                  <div className="sm:col-span-3">
                    <Field label="Unit conversion note">
                      <Textarea rows={2} value={form.unit_conversion_note ?? ""} onChange={(e) => set("unit_conversion_note", e.target.value)} placeholder="Example: Approx. 55–60 pcs per kg; retail sold by piece." />
                    </Field>
                  </div>

                  <Field label="Pieces per kg">
                    <Input type="number" value={form.pieces_per_kg ?? ""} onChange={(e) => set("pieces_per_kg", e.target.value)} placeholder="55" />
                  </Field>
                  <Field label="Approx. piece weight (g)">
                    <Input type="number" value={form.approximate_piece_weight_g ?? ""} onChange={(e) => set("approximate_piece_weight_g", e.target.value)} placeholder="18" />
                  </Field>
                </div>
              </div>

              <div className="card-elevated p-6 space-y-5">
                <div>
                  <h3 className="font-display text-xl mb-1">Primary Packing</h3>
                  <p className="text-xs text-muted-foreground">
                    Defines what one primary pack contains before MOQ is calculated.
                  </p>
                </div>

                <div className="grid sm:grid-cols-4 gap-4">
                  <Field label="Primary Pack Type">
                    <Select
                      value={form.primary_pack_type}
                      onChange={(v: string) => {
                        const mappedUom = primaryPackTypeToUom(v);

                        if (v === "NA") {
                          patch({
                            primary_pack_type: v,
                            primary_pack_uom: "",
                            qty_per_pack: "",
                            qty_content_uom: "",
                            pcs_per_pack: "",
                          });
                          return;
                        }

                        patch({
                          primary_pack_type: v,
                          primary_pack_uom: mappedUom,
                          moq_uom: form.moq_uom || mappedUom,
                          increment_uom: form.increment_uom || mappedUom,
                        });
                      }}
                      options={PRIMARY_PACK_TYPES}
                    />
                  </Field>

                  <Field label="Pack UOM">
                    <Select
                      value={form.primary_pack_uom}
                      onChange={(v: string) => set("primary_pack_uom", v)}
                      options={PACK_UOM_OPTIONS}
                    />
                  </Field>

                  <Field label="Qty per Pack">
                    <Input
                      type="number"
                      value={form.qty_per_pack ?? ""}
                      onChange={(e) => {
                        set("qty_per_pack", e.target.value);
                        set("pcs_per_pack", e.target.value);
                      }}
                      placeholder="6"
                    />
                  </Field>

                  <Field label="Qty Content UOM">
                    <Select
                      value={form.qty_content_uom}
                      onChange={(v: string) => set("qty_content_uom", v)}
                      options={CONTENT_UOM_OPTIONS}
                    />
                  </Field>
                </div>

                <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                  {primaryPackPreview ? (
                    <>
                      Primary Pack:{" "}
                      <span className="font-medium text-foreground">{primaryPackPreview}</span>
                    </>
                  ) : (
                    <>
                      Example: <span className="font-medium text-foreground">1 box = 6 pcs</span>,{" "}
                      <span className="font-medium text-foreground">1 jar = 500 grams</span>,{" "}
                      <span className="font-medium text-foreground">1 tray = 24 pcs</span>
                    </>
                  )}
                </div>

                {primaryPackTypeNeedsUom && (
                  <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs flex gap-2 items-start">
                    <AlertTriangle className="h-4 w-4 mt-0.5 text-warning" />
                    <div>Pack UOM is required for Primary Packing.</div>
                  </div>
                )}

                {qtyContentUomMissing && (
                  <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs flex gap-2 items-start">
                    <AlertTriangle className="h-4 w-4 mt-0.5 text-warning" />
                    <div>Qty Content UOM is required to complete Primary Packing.</div>
                  </div>
                )}

                {cls === "ready_pack" && (
                  <div className="rounded-md border border-accent/30 bg-accent-soft/30 p-3 text-xs text-muted-foreground">
                    Ready packs use Internal BOM: food material + box/jar/tray/cavity/label/ribbon.
                  </div>
                )}

                {cls === "bulk_loose_product" && (
                  <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                    For loose bulk products, Primary Packing can remain NA unless the item is sold in a fixed pack.
                  </div>
                )}
              </div>

              <div className="card-elevated p-6 space-y-5">
                <div>
                  <h3 className="font-display text-xl mb-1">MOQ & increment</h3>
                  <p className="text-xs text-muted-foreground">
                    MOQ must be based on the sellable pack unit after Primary Packing is defined.
                  </p>
                </div>

                {primaryPackPreview && (
                  <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                    {primaryPackPreview}. Example: MOQ 6 {form.primary_pack_uom}s means minimum 6 primary packs.
                  </div>
                )}

                {moqUomMismatch && (
                  <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs flex gap-2 items-start">
                    <AlertTriangle className="h-4 w-4 mt-0.5 text-warning" />
                    <div>
                      MOQ UOM and Increment UOM should normally match unless a conversion rule is defined.
                    </div>
                  </div>
                )}

                <div className="grid sm:grid-cols-3 gap-4">
                  <Field label="MOQ rule type">
                    <Select value={form.moq_rule_type} onChange={(v: string) => set("moq_rule_type", v)} options={MOQ_RULE_TYPES} />
                  </Field>
                  <Field label="MOQ value">
                    <Input type="number" value={form.moq_value ?? ""} onChange={(e) => set("moq_value", e.target.value)} placeholder="1" />
                  </Field>
                  <Field label="MOQ UOM">
                    <Select value={form.moq_uom} onChange={(v: string) => set("moq_uom", v)} options={PACK_UOM_OPTIONS} />
                  </Field>
                  <Field label="Increment value">
                    <Input type="number" value={form.increment_value ?? ""} onChange={(e) => set("increment_value", e.target.value)} placeholder="1" />
                  </Field>
                  <Field label="Increment UOM">
                    <Select value={form.increment_uom} onChange={(v: string) => set("increment_uom", v)} options={PACK_UOM_OPTIONS} />
                  </Field>
                  <Field label="Legacy MOQ note">
                    <Input value={form.moq_text ?? ""} onChange={(e) => set("moq_text", e.target.value)} placeholder="Free text fallback" />
                  </Field>
                </div>
              </div>

              <div className="card-elevated p-6 space-y-5">
                <div>
                  <h3 className="font-display text-xl mb-1">Carton / Master Carton logic</h3>
                  <p className="text-xs text-muted-foreground">
                    Carton logic belongs to master packing / Central App. Keep it as a simple reference here.
                  </p>
                </div>

                {!isContributorMode && (
                  <>
                    <div className="flex items-center justify-between">
                      <Label>Fixed carton required</Label>
                      <Switch checked={!!form.fixed_carton_required} onCheckedChange={(v) => set("fixed_carton_required", v)} />
                    </div>

                    <div className="grid sm:grid-cols-3 gap-4">
                      <Field label="Carton qty">
                        <Input type="number" value={form.carton_qty ?? ""} onChange={(e) => set("carton_qty", e.target.value)} placeholder="50" />
                      </Field>
                      <Field label="Carton UOM">
                        <Select value={form.carton_uom} onChange={(v: string) => set("carton_uom", v)} options={PACK_UOM_OPTIONS} />
                      </Field>
                      <Field label="Master carton qty">
                        <Input type="number" value={form.master_carton_qty ?? ""} onChange={(e) => set("master_carton_qty", e.target.value)} placeholder="6" />
                      </Field>
                      <Field label="Master carton UOM">
                        <Select value={form.master_carton_uom} onChange={(v: string) => set("master_carton_uom", v)} options={PACK_UOM_OPTIONS} />
                      </Field>
                      <div className="sm:col-span-3">
                        <Field label="Carton logic note">
                          <Input value={form.carton_logic ?? ""} onChange={(e) => set("carton_logic", e.target.value)} placeholder="Example: Sold only in closed carton of 50 pcs." />
                        </Field>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </TabsContent>

            {!isNew && (
              <TabsContent value="media" className="space-y-6">
                <ProductMediaUploader
                  productId={id!}
                  productSku={form.sku}
                  variant={isTestingMediaGovernance() ? "hero-only" : "full"}
                  currentHero={resolveProductHeroUrl({
                    hero_image_url: form.hero_image_url,
                    image_url: form.image_url,
                  })}
                  onHeroChange={(url) => {
                    set("hero_image_url", url);
                    set("image_url", url);
                  }}
                  onMediaChange={() => {
                    if (id) void loadProductMedia(id);
                  }}
                />
              </TabsContent>
            )}

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
                      <Field label="Private label MOQ">
                        <Input type="number" value={form.private_label_moq ?? ""} onChange={(e) => set("private_label_moq", e.target.value)} placeholder="500" />
                      </Field>
                      <Field label="Private label MOQ UOM">
                        <Select value={form.private_label_moq_uom} onChange={(v: string) => set("private_label_moq_uom", v)} options={PACK_UOM_OPTIONS} />
                      </Field>
                      <Field label="Cost per unit (₹)">
                        <Input type="number" value={form.private_label_cost_per_unit ?? ""} onChange={(e) => set("private_label_cost_per_unit", e.target.value)} placeholder="10" />
                      </Field>
                      <Field label="Upfront cost (₹)">
                        <Input type="number" value={form.private_label_upfront_cost ?? ""} onChange={(e) => set("private_label_upfront_cost", e.target.value)} placeholder="5000" />
                      </Field>
                    </div>
                  )}
                </div>
              </TabsContent>
            )}

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

                  {cls === "gift_hamper" && (
                    <div className="rounded-md border border-accent/30 bg-accent-soft/30 p-3 text-xs text-muted-foreground">
                      Hampers use Hamper BOM: ready packs + loose products + packaging/accessories.
                    </div>
                  )}

                  {form.customization_allowed && (
                    <>
                      <Field label="Customization type (multi-select)" hint="Suggested — please review">
                        <div className="flex flex-wrap gap-2">
                          {CUSTOMIZATION_TYPES.map((t) => {
                            const selected = (form.customization_types || []).includes(t);

                            return (
                              <button
                                key={t}
                                type="button"
                                className={`rounded-full border px-3 py-1 text-xs ${
                                  selected ? "bg-accent text-accent-foreground" : "bg-background"
                                }`}
                                onClick={() => {
                                  const next = selected
                                    ? (form.customization_types || []).filter((x: string) => x !== t)
                                    : [...(form.customization_types || []), t];

                                  set("customization_types", next);
                                }}
                              >
                                {t}
                              </button>
                            );
                          })}
                        </div>
                      </Field>

                      <Field label="Customisation note">
                        <Textarea rows={3} value={form.customization_note ?? ""} onChange={(e) => set("customization_note", e.target.value)} placeholder="Example: Logo sticker, ribbon color, greeting card message, client branding." />
                      </Field>

                      <Field label="Customisation caution">
                        <Textarea rows={3} value={form.customization_caution ?? ""} onChange={(e) => set("customization_caution", e.target.value)} className="bg-warning/10 underline decoration-warning underline-offset-2 font-medium" />
                      </Field>
                    </>
                  )}
                </div>
              </TabsContent>
            )}

            {showDimensions && (
              <TabsContent value="dimensions" className="space-y-6">
                <div className="card-elevated p-6 space-y-4">
                  <div>
                    <h3 className="font-display text-xl mb-1">Dimensions & material</h3>
                    <p className="text-xs text-muted-foreground">Example: L 22 cm × W 18 cm × H 6 cm.</p>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-4">
                    <Field label="Length (cm)">
                      <Input type="number" value={form.dimension_l_cm ?? ""} onChange={(e) => set("dimension_l_cm", e.target.value)} placeholder="22" />
                    </Field>
                    <Field label="Width (cm)">
                      <Input type="number" value={form.dimension_w_cm ?? ""} onChange={(e) => set("dimension_w_cm", e.target.value)} placeholder="18" />
                    </Field>
                    <Field label="Height (cm)">
                      <Input type="number" value={form.dimension_h_cm ?? ""} onChange={(e) => set("dimension_h_cm", e.target.value)} placeholder="6" />
                    </Field>
                    <Field label="Material type">
                      <Input value={form.material_type ?? ""} onChange={(e) => set("material_type", e.target.value)} placeholder="Acrylic / Kraft / Velvet" />
                    </Field>
                    <div className="sm:col-span-2">
                      <Field label="Colour / finish notes">
                        <Input value={form.color_finish_notes ?? ""} onChange={(e) => set("color_finish_notes", e.target.value)} placeholder="Matte gold, transparent lid" />
                      </Field>
                    </div>
                  </div>
                </div>
              </TabsContent>
            )}

            {showFrozen && (
              <TabsContent value="frozen" className="space-y-6">
                <div className="card-elevated p-6 space-y-4">
                  <div>
                    <h3 className="font-display text-xl mb-1">Frozen / semi-prepared</h3>
                    <p className="text-xs text-muted-foreground">Example: Store at -18°C. Use within 48 hours after thawing.</p>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Frozen shelf life (days)">
                      <Input type="number" value={form.frozen_shelf_life_days ?? ""} onChange={(e) => set("frozen_shelf_life_days", e.target.value)} placeholder="180" />
                    </Field>
                    <Field label="Post-processing shelf life (days)">
                      <Input type="number" value={form.post_processing_shelf_life_days ?? ""} onChange={(e) => set("post_processing_shelf_life_days", e.target.value)} placeholder="2" />
                    </Field>
                    <Field label="Temperature requirement">
                      <Input value={form.temperature_requirement ?? ""} onChange={(e) => set("temperature_requirement", e.target.value)} placeholder="-18°C" />
                    </Field>
                    <Field label="Thawing instruction">
                      <Input value={form.thawing_instruction ?? ""} onChange={(e) => set("thawing_instruction", e.target.value)} placeholder="Thaw at 4°C overnight" />
                    </Field>
                  </div>
                </div>
              </TabsContent>
            )}

            {showBom && (
              <TabsContent value="bom" className="space-y-6">
                {expectedBomType && (
                  <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                    Expected BOM type:{" "}
                    <span className="font-medium text-foreground">
                      {expectedBomType === "hamper_bom" ? "Hamper BOM" : "Internal BOM"}
                    </span>
                  </div>
                )}

                {isNew ? (
                  <div className="card-elevated p-6">
                    <h3 className="font-display text-xl mb-2">BOM will be added after save</h3>
                    <p className="text-sm text-muted-foreground">
                      Save this product first, then add Internal BOM / Hamper BOM.
                    </p>
                  </div>
                ) : (
                  <BomBuilder
                    parentId={id!}
                    productClass={form.product_class}
                    bomRequired={isPackingAssembly || !!form.bom_required}
                  />
                )}
              </TabsContent>
            )}

            {!isNew && (
              <TabsContent value="channels" className="space-y-6">
                <ChannelMoqRules
                  productId={id!}
                  product={form}
                  onRulesChange={() => {
                    if (id) void loadChannelAuthority(id);
                  }}
                />
                <ChannelPricingRules
                  productId={id!}
                  product={form}
                  onRulesChange={() => {
                    if (id) void loadChannelAuthority(id);
                  }}
                />
              </TabsContent>
            )}

            <TabsContent value="compliance" className="space-y-6">
              <ComplianceAiPanel
                form={form}
                set={set}
                roles={roles}
                metaMap={complianceMetaMap}
                setMetaMap={setComplianceMetaMap}
                onManualEdit={(field) => {
                  if (canApproveComplianceFields(roles)) {
                    setComplianceMetaMap((prev) => ({ ...prev, [field]: createManualFieldMeta() }));
                  }
                }}
              />

              <div className="card-elevated p-6">
                <h3 className="font-display text-xl mb-4">Pack & shelf</h3>

                <div className="grid sm:grid-cols-3 gap-4">
                  <Field label="Pack size">
                    <Input value={form.pack_size ?? ""} onChange={(e) => set("pack_size", e.target.value)} placeholder="500g jar / 6 pcs box" />
                  </Field>
                  <Field label="Net weight (g)">
                    <Input type="number" value={form.net_weight_g ?? ""} onChange={(e) => set("net_weight_g", e.target.value)} />
                  </Field>
                  <Field label="Gross weight (g)">
                    <Input type="number" value={form.gross_weight_g ?? ""} onChange={(e) => set("gross_weight_g", e.target.value)} />
                  </Field>
                  <Field label="Shelf life (days)">
                    <Input type="number" value={form.shelf_life_days ?? ""} onChange={(e) => setComplianceField("shelf_life_days", e.target.value)} />
                  </Field>

                  <div className="sm:col-span-3">
                    <Field label="Storage instructions">
                      <Textarea rows={2} value={form.storage_instructions ?? ""} onChange={(e) => setComplianceField("storage_instructions", e.target.value)} placeholder="Example: Store in cool, dry place away from sunlight." />
                    </Field>
                  </div>

                  <div className="sm:col-span-3">
                    <Field label="Ingredients">
                      <Textarea rows={2} value={form.ingredients ?? ""} onChange={(e) => setComplianceField("ingredients", e.target.value)} placeholder="Example: Cashew, sugar, clarified butter, filo pastry." />
                    </Field>
                  </div>

                  <div className="sm:col-span-3">
                    <Field label="Allergen warnings">
                      <Textarea rows={2} value={form.allergen_warnings ?? ""} onChange={(e) => setComplianceField("allergen_warnings", e.target.value)} placeholder="Example: Contains nuts, gluten, dairy." />
                    </Field>
                  </div>

                  <div className="sm:col-span-3">
                    <Field label="Nutritional information">
                      <Textarea
                        rows={3}
                        value={
                          typeof form.nutritional_info === "string"
                            ? form.nutritional_info
                            : JSON.stringify(form.nutritional_info ?? "", null, 2)
                        }
                        onChange={(e) => setComplianceField("nutritional_info", e.target.value)}
                      />
                    </Field>
                  </div>
                </div>
              </div>

              <div className="card-elevated p-6">
                <h3 className="font-display text-xl mb-4">Tax & pricing (legacy)</h3>
                <p className="text-xs text-muted-foreground mb-3">Channel-wise pricing comes in the next batch. These fields stay for backward compatibility.</p>

                <div className="grid sm:grid-cols-3 gap-4">
                  <Field label="HSN">
                    <Input value={form.hsn_code ?? ""} onChange={(e) => setComplianceField("hsn_code", e.target.value)} />
                  </Field>
                  <Field label="GST %">
                    <Input type="number" value={form.gst_rate ?? ""} onChange={(e) => setComplianceField("gst_rate", e.target.value)} />
                  </Field>
                  <Field label="Currency">
                    <Input value={form.currency ?? "INR"} onChange={(e) => set("currency", e.target.value)} />
                  </Field>
                  <Field label="MRP">
                    <Input type="number" value={form.mrp ?? ""} onChange={(e) => set("mrp", e.target.value)} />
                  </Field>
                  <Field label="B2B price">
                    <Input type="number" value={form.b2b_price ?? ""} onChange={(e) => set("b2b_price", e.target.value)} />
                  </Field>
                  <Field label="Export price">
                    <Input type="number" value={form.export_price ?? ""} onChange={(e) => set("export_price", e.target.value)} />
                  </Field>
                </div>
              </div>
            </TabsContent>

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
                    <div className="text-[11px] text-muted-foreground">
                      Auto-on for Packing & Assembly and gift hampers. Use the BOM tab to add components after saving.
                    </div>
                  </div>
                  <Switch
                    checked={isPackingAssembly || !!form.bom_required}
                    disabled={isPackingAssembly}
                    onCheckedChange={(v) => set("bom_required", v)}
                  />
                </div>
              </div>
            </TabsContent>

            {!isNew && (
              <TabsContent value="product_truth" className="space-y-6">
                <Suspense fallback={<ProductTruthTabSkeleton />}>
                  <ProductTruthAdminSection
                    form={readinessSnapshot?.authorityForm ?? form}
                    productId={id}
                    productName={form.product_name ?? ""}
                    productMediaRows={productMediaRows}
                    prices={channelPrices}
                    moqRules={channelMoqRules}
                    languageTermsRefreshKey={languageTermsRefreshKey}
                    onOpenAliasManager={() => {
                      startTransition(() => setTab("identity"));
                      requestAnimationFrame(() => {
                        document.getElementById("product-language-terms")?.scrollIntoView({ behavior: "smooth" });
                      });
                    }}
                    complianceApproved={complianceApproved}
                    complianceMetaPending={complianceMetaPending}
                    onMoqRulesChange={() => {
                      if (id) void loadChannelAuthority(id);
                    }}
                  />
                </Suspense>
              </TabsContent>
            )}
          </Tabs>
        </div>

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

            <div className="text-xs text-muted-foreground border-t pt-3 space-y-1">
              <div>{labelStatusInfoLine(String(form.label_status ?? "draft"))}</div>
              <div>
                Media:{" "}
                <span className="font-medium text-foreground">
                  {mediaGovernanceStatusLine({
                    complete: readinessSnapshot
                      ? readinessSnapshot.readiness.dimensions.find(
                          (d) => d.dimension === "media_status",
                        )?.complete
                      : false,
                    heroUrl:
                      readinessSnapshot?.derivedHeroUrl ??
                      resolveProductHeroUrl({
                        hero_image_url: form.hero_image_url,
                        image_url: form.image_url,
                      }),
                    derivedStatus: readinessSnapshot?.derivedMediaStatus ?? form.media_status,
                  })}
                </span>
              </div>
              {readinessSnapshot && (
                <div>
                  Product Truth:{" "}
                  <span className="font-medium text-foreground">
                    {readinessSnapshot.readiness.score}/{readinessSnapshot.readiness.maxScore}
                    {readinessSnapshot.readiness.readyForCentralSync ? " · ready" : ""}
                  </span>
                </div>
              )}
            </div>
          </div>

          {!isNew && isTestingMediaGovernance() && (
            <ProductMediaUploader
              productId={id!}
              productSku={form.sku}
              variant="hero-only"
              currentHero={resolveProductHeroUrl({
                hero_image_url: form.hero_image_url,
                image_url: form.image_url,
              })}
              onHeroChange={(url) => {
                set("hero_image_url", url);
                set("image_url", url);
              }}
              onMediaChange={() => {
                if (id) void loadProductMedia(id);
              }}
            />
          )}

          <div className="card-elevated p-6 bg-accent-soft/40">
            <div className="text-xs uppercase tracking-wider text-accent-foreground/80 mb-2">
              API integration note
            </div>
            <p className="text-sm">
              SKU is the permanent system identity used by Oasis Central, B2B Portal, label & barcode tools, and all future APIs.
              Aliases are search helpers only — never use alias text as an external reference.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default ProductEdit;
