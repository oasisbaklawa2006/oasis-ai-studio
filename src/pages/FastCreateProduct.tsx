import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CatalogueWriteModeBanner } from "@/components/CatalogueWriteModeBanner";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, Sparkles, Zap, ImagePlus, ArrowRight } from "lucide-react";
import {
  FAST_CREATE_CATEGORIES,
  type FastCreateCategoryKey,
} from "@/features/productDefaults/categoryDefaults";
import {
  buildHeuristicSuggestions,
  enrichSuggestionsWithAi,
  type FastCreateSuggestions,
} from "@/features/fastCreate/fastCreateSuggestions";
import { uploadFastCreateHero } from "@/features/fastCreate/uploadFastCreateHero";
import {
  FAST_CREATE_SKU_BLOCK_MESSAGE,
  requireFastCreateSku,
  saveFastCreateProduct,
} from "@/features/fastCreate/saveFastCreateProduct";
import { probeProductMediaBucket, MEDIA_BUCKET_OWNER_ACTION } from "@/features/productAuthority/mediaReadiness";
import { CATEGORY_PREFEED_DISCLAIMER } from "@/features/productDefaults/categoryPrefeed";

const FastCreateProduct = () => {
  const nav = useNavigate();
  const { roles } = useAuth();
  const [productName, setProductName] = useState("");
  const [categoryKey, setCategoryKey] = useState<FastCreateCategoryKey>("baklawa");
  const [heroUrl, setHeroUrl] = useState<string | null>(null);
  const [heroPreview, setHeroPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<FastCreateSuggestions | null>(null);
  const [resolvedSku, setResolvedSku] = useState<string | null>(null);
  const [skuError, setSkuError] = useState<string | null>(null);
  const [bucketStatus, setBucketStatus] = useState<string | null>(null);

  useEffect(() => {
    probeProductMediaBucket().then((r) => {
      if (r.status !== "available") {
        setBucketStatus(r.message);
      }
    });
  }, []);

  const categoryLabel = useMemo(
    () => FAST_CREATE_CATEGORIES.find((c) => c.key === categoryKey)?.label ?? categoryKey,
    [categoryKey],
  );

  useEffect(() => {
    return () => {
      if (heroPreview?.startsWith("blob:")) URL.revokeObjectURL(heroPreview);
    };
  }, [heroPreview]);

  const onPickImage = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      if (heroPreview?.startsWith("blob:")) URL.revokeObjectURL(heroPreview);
      setHeroPreview(URL.createObjectURL(file));
      const url = await uploadFastCreateHero(file);
      setHeroUrl(url);
      toast.success("Image uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Image upload failed");
    } finally {
      setUploading(false);
    }
  };

  const resolveSkuPreview = async () => {
    setSkuError(null);
    try {
      const sku = await requireFastCreateSku(resolvedSku);
      setResolvedSku(sku);
      return sku;
    } catch (e) {
      const msg = e instanceof Error ? e.message : FAST_CREATE_SKU_BLOCK_MESSAGE;
      setSkuError(msg);
      setResolvedSku(null);
      return null;
    }
  };

  const generate = async () => {
    if (!productName.trim()) {
      toast.error("Enter a product name first.");
      return;
    }
    setGenerating(true);
    try {
      const base = buildHeuristicSuggestions(productName.trim(), categoryKey);
      const enriched = await enrichSuggestionsWithAi(
        base,
        productName.trim(),
        String(base.formPatch.category ?? categoryLabel),
      );
      setSuggestions(enriched);
      await resolveSkuPreview();
      toast.success("Suggestions ready — review SKU and create.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate suggestions");
    } finally {
      setGenerating(false);
    }
  };

  const create = async () => {
    if (!productName.trim()) {
      toast.error("Product name is required.");
      return;
    }
    if (!heroUrl) {
      toast.error("Upload a product image.");
      return;
    }

    setSaving(true);
    try {
      const sku = await requireFastCreateSku(resolvedSku);
      setResolvedSku(sku);

      const payload =
        suggestions ?? buildHeuristicSuggestions(productName.trim(), categoryKey);
      const result = await saveFastCreateProduct({
        suggestions: payload,
        heroUrl,
        roles,
        resolvedSku: sku,
      });

      if ("draft" in result) {
        toast.success("Product draft submitted for approval.");
        nav("/approvals");
        return;
      }

      toast.success(`Product created (${result.sku}) — opening full editor.`);
      nav(`/products/${result.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setSaving(false);
    }
  };

  const readyToCreate = !!productName.trim() && !!heroUrl && !skuError;

  return (
    <>
      <CatalogueWriteModeBanner />
      {bucketStatus && (
        <div className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          <strong>Media bucket:</strong> {bucketStatus}
          <div className="text-xs mt-1 text-muted-foreground">{MEDIA_BUCKET_OWNER_ACTION}</div>
        </div>
      )}
      <PageHeader
        title="Fast Create"
        subtitle="Name · category · image — system fills compliance, search, and packaging defaults."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/products/new">Full editor</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/admin/import/category-1">Category 1 import</Link>
            </Button>
          </div>
        }
      />

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card-elevated p-6 space-y-5">
          <div className="flex items-center gap-2 text-accent">
            <Zap className="h-5 w-5" />
            <h2 className="font-display text-xl">3 required inputs</h2>
          </div>

          <div className="space-y-2">
            <Label>Product name</Label>
            <Input
              value={productName}
              onChange={(e) => {
                setProductName(e.target.value);
                setSuggestions(null);
              }}
              placeholder="Cashew Pyramid Baklawa / 6 pcs Gift Box"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <select
              className="w-full h-10 px-3 rounded-md border bg-background text-sm"
              value={categoryKey}
              onChange={(e) => {
                setCategoryKey(e.target.value as FastCreateCategoryKey);
                setSuggestions(null);
              }}
            >
              {FAST_CREATE_CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Product image</Label>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-md border cursor-pointer hover:bg-muted/50 text-sm">
                <ImagePlus className="h-4 w-4" />
                {uploading ? "Uploading…" : "Upload hero"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => onPickImage(e.target.files?.[0] ?? null)}
                />
              </label>
              {heroPreview && (
                <img src={heroPreview} alt="" className="h-16 w-16 rounded object-cover border" />
              )}
            </div>
          </div>

          <div className="rounded-md border border-dashed p-3 text-sm space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Structured SKU (before save)</span>
              <Button type="button" size="sm" variant="outline" onClick={resolveSkuPreview} disabled={generating}>
                Refresh SKU
              </Button>
            </div>
            {resolvedSku ? (
              <div className="font-mono font-medium text-foreground">{resolvedSku}</div>
            ) : skuError ? (
              <p className="text-destructive text-xs">{skuError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Generate suggestions or click Refresh to resolve via RPC.</p>
            )}
          </div>

          <p className="text-xs text-muted-foreground">{CATEGORY_PREFEED_DISCLAIMER}</p>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="button" variant="secondary" disabled={generating || !productName.trim()} onClick={generate}>
              {generating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
              Generate suggestions
            </Button>
            <Button type="button" disabled={!readyToCreate || saving} onClick={create}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ArrowRight className="h-4 w-4 mr-1" />}
              Create product
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Target: under 60 seconds · ~3 fields · auto HSN/GST/UOM/shelf life · optional AI enrichment
          </p>
        </div>

        <div className="card-elevated p-6 space-y-4">
          <h2 className="font-display text-xl">System suggestions</h2>
          {!suggestions ? (
            <p className="text-sm text-muted-foreground">
              Pick a category to preview defaults, then click <strong>Generate suggestions</strong> for
              descriptions, aliases, WhatsApp keywords, and compliance fields.
            </p>
          ) : (
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap gap-1">
                {suggestions.sources.defaults && <Badge variant="secondary">Category defaults</Badge>}
                {suggestions.sources.heuristicAliases && <Badge variant="secondary">Alias seeds</Badge>}
                {suggestions.sources.aiCompliance && <Badge variant="secondary">AI compliance</Badge>}
                {suggestions.sources.aiAliases && <Badge variant="secondary">AI aliases</Badge>}
              </div>

              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Description</div>
                <p>{String(suggestions.formPatch.description ?? "—")}</p>
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">HSN</div>
                  <div className="font-medium">{String(suggestions.formPatch.hsn_code ?? "—")}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">GST</div>
                  <div className="font-medium">{String(suggestions.formPatch.gst_rate ?? "—")}%</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Shelf life</div>
                  <div className="font-medium">{String(suggestions.formPatch.shelf_life_days ?? "—")} days</div>
                </div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Aliases</div>
                <div className="flex flex-wrap gap-1">
                  {suggestions.aliases.map((a) => (
                    <Badge key={a.alias} variant="outline">
                      {a.alias}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">WhatsApp keywords</div>
                <div className="flex flex-wrap gap-1">
                  {suggestions.whatsappKeywords.map((k) => (
                    <Badge key={k} variant="outline">
                      {k}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Label starter</div>
                <p className="text-muted-foreground">{suggestions.labelStarter.net_weight_hint}</p>
              </div>
            </div>
          )}

          {!suggestions && (
            <div className="rounded-md border p-3 text-sm bg-muted/30 space-y-2">
              <div className="font-medium">Category preview: {categoryLabel}</div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {(["hsn_code", "gst_rate", "shelf_life_days", "primary_uom", "main_department"] as const).map(
                  (k) => {
                    const d = FAST_CREATE_CATEGORIES.find((c) => c.key === categoryKey)?.defaults;
                    return (
                      <div key={k}>
                        <span className="text-muted-foreground">{k}: </span>
                        <span>{String((d as Record<string, unknown>)?.[k] ?? "—")}</span>
                      </div>
                    );
                  },
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default FastCreateProduct;
