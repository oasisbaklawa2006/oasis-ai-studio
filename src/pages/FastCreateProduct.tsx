import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { BuildMeterBar } from "@/components/BuildMeterBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CatalogueWriteModeBanner } from "@/components/CatalogueWriteModeBanner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Sparkles, Zap, ImagePlus, ArrowRight, Trash2, Plus } from "lucide-react";
import {
  FAST_CREATE_CATEGORIES,
  type FastCreateCategoryKey,
} from "@/features/productDefaults/categoryDefaults";
import {
  buildHeuristicSuggestions,
  enrichSuggestionsWithAi,
  type FastCreateSuggestions,
} from "@/features/fastCreate/fastCreateSuggestions";
import { sanitizeAiFragments } from "@/features/fastCreate/aiOutputSanitizer";
import { uploadFastCreateHero } from "@/features/fastCreate/uploadFastCreateHero";
import {
  FAST_CREATE_SKU_BLOCK_MESSAGE,
  requireFastCreateSku,
  saveFastCreateProduct,
} from "@/features/fastCreate/saveFastCreateProduct";
import { deriveShortSku } from "@/features/fastCreate/shortSku";
import {
  clearFastCreateDraft,
  emptyFastCreateDraft,
  fastCreateFormPatchFromDraft,
  fastCreateReadinessCategories,
  fastCreateReadinessScore,
  heroPreviewFromDraft,
  loadFastCreateDraft,
  saveFastCreateDraft,
  type FastCreateDraftSnapshot,
} from "@/features/fastCreate/fastCreateDraft";
import { SALE_TYPES, getSaleTypeRequirements, type SaleType } from "@/features/productAuthority/saleType";
import { getBuildMeterStatus } from "@/features/productAuthority/buildMeter";
import { fetchActiveSkuCodeRules, type SkuCodeRule } from "@/lib/skuCodeRules";
import { probeProductMediaBucket, MEDIA_BUCKET_OWNER_ACTION } from "@/features/productAuthority/mediaReadiness";
import { CATEGORY_PREFEED_DISCLAIMER } from "@/features/productDefaults/categoryPrefeed";

/** Sentinel for "the correct packaging is not in the taxonomy yet" — never a real code. */
const PACKAGING_MISSING_SENTINEL = "__missing__";

const FastCreateProduct = () => {
  const nav = useNavigate();
  const { roles } = useAuth();
  const [draft, setDraft] = useState<FastCreateDraftSnapshot>(emptyFastCreateDraft());
  const [heroPreview, setHeroPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [skuError, setSkuError] = useState<string | null>(null);
  const [bucketStatus, setBucketStatus] = useState<string | null>(null);
  const [pendingNavPath, setPendingNavPath] = useState<string | null>(null);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [restoredFromDraft, setRestoredFromDraft] = useState(false);
  const [packagingRules, setPackagingRules] = useState<SkuCodeRule[]>([]);
  const [packagingRulesError, setPackagingRulesError] = useState<string | null>(null);
  const [addOptionOpen, setAddOptionOpen] = useState(false);
  const [newOptionCode, setNewOptionCode] = useState("");
  const [newOptionLabel, setNewOptionLabel] = useState("");
  const [addingOption, setAddingOption] = useState(false);

  const patchDraft = (patch: Partial<FastCreateDraftSnapshot>) =>
    setDraft((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    probeProductMediaBucket().then((r) => {
      if (r.status !== "available") setBucketStatus(r.message);
    });
  }, []);

  const loadPackagingOptions = async () => {
    const { rules, error } = await fetchActiveSkuCodeRules();
    setPackagingRules(rules.filter((r) => r.code_type === "packaging"));
    setPackagingRulesError(error);
  };

  useEffect(() => {
    void loadPackagingOptions();
  }, []);

  // Restore a preserved Fast Create draft (e.g. after an accidental navigation) once on mount.
  useEffect(() => {
    const stored = loadFastCreateDraft();
    if (!stored) return;
    setDraft(stored);
    setHeroPreview(heroPreviewFromDraft(stored));
    setRestoredFromDraft(true);
  }, []);

  const hasUnsavedWork = !!draft.productName.trim() || !!draft.suggestions || !!draft.heroUrl;

  // Keep the session draft in sync while the user works, so accidental navigation never loses it.
  useEffect(() => {
    if (!hasUnsavedWork) return;
    saveFastCreateDraft(draft);
  }, [draft, hasUnsavedWork]);

  const requirements = useMemo(
    () => getSaleTypeRequirements(draft.saleType, { b2bEnabled: draft.b2bEnabled }),
    [draft.saleType, draft.b2bEnabled],
  );

  const readinessCategories = useMemo(() => fastCreateReadinessCategories(draft), [draft]);
  const readinessScore = useMemo(() => fastCreateReadinessScore(readinessCategories), [readinessCategories]);
  const meterStatus = getBuildMeterStatus(readinessScore);

  const categoryLabel = useMemo(
    () => FAST_CREATE_CATEGORIES.find((c) => c.key === draft.categoryKey)?.label ?? draft.categoryKey,
    [draft.categoryKey],
  );

  const shortSku = useMemo(() => (draft.resolvedSku ? deriveShortSku(draft.resolvedSku) : null), [draft.resolvedSku]);

  const packagingBlocked = requirements.requiresPackaging && !draft.packagingCode;

  const requestNavigation = (path: string) => {
    if (hasUnsavedWork) {
      setPendingNavPath(path);
      return;
    }
    nav(path);
  };

  const discardDraft = () => {
    clearFastCreateDraft();
    setDraft(emptyFastCreateDraft());
    setHeroPreview(null);
    setSkuError(null);
    setDiscardConfirmOpen(false);
    toast.success("Draft cleared.");
  };

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
      patchDraft({ heroUrl: url });
      toast.success("Image uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Image upload failed");
    } finally {
      setUploading(false);
    }
  };

  const resolveSkuPreview = async () => {
    setSkuError(null);
    if (packagingBlocked) {
      setSkuError("SKU blocked — select a valid packaging type first.");
      patchDraft({ resolvedSku: null });
      return null;
    }
    try {
      const result = await requireFastCreateSku(draft.categoryKey, draft.resolvedSku, draft.packagingCode);
      patchDraft({ resolvedSku: result.sku });
      return result.sku;
    } catch (e) {
      const msg = e instanceof Error ? e.message : FAST_CREATE_SKU_BLOCK_MESSAGE;
      setSkuError(msg);
      patchDraft({ resolvedSku: null });
      return null;
    }
  };

  const generate = async () => {
    if (!draft.productName.trim()) {
      toast.error("Enter a product name first.");
      return;
    }
    setGenerating(true);
    try {
      const base = buildHeuristicSuggestions(draft.productName.trim(), draft.categoryKey);
      const enriched = await enrichSuggestionsWithAi(
        base,
        draft.productName.trim(),
        String(base.formPatch.category ?? categoryLabel),
      );
      patchDraft({
        suggestions: enriched,
        editedDescription: null,
        editedAliases: null,
        editedWhatsappKeywords: null,
      });
      await resolveSkuPreview();
      toast.success("Suggestions ready — review, edit, and create.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate suggestions");
    } finally {
      setGenerating(false);
    }
  };

  /** Applies operator edits over the generated suggestions before save/handoff. */
  const effectiveSuggestions = (): FastCreateSuggestions | null => {
    if (!draft.suggestions) return null;
    const next: FastCreateSuggestions = {
      ...draft.suggestions,
      formPatch: { ...draft.suggestions.formPatch },
    };
    if (draft.editedDescription != null && draft.editedDescription.trim()) {
      next.formPatch.description = draft.editedDescription.trim();
    }
    if (draft.editedAliases != null) {
      const parsed = sanitizeAiFragments(draft.editedAliases.split(/[,\n]/));
      next.aliases = parsed.map((alias) => ({ alias, alias_type: "search_term" }));
    }
    if (draft.editedWhatsappKeywords != null) {
      next.whatsappKeywords = sanitizeAiFragments(draft.editedWhatsappKeywords.split(/[,\n]/));
    }
    return next;
  };

  const missingRequired = readinessCategories.filter((c) => c.state === "missing").map((c) => c.label);
  const readyToCreate = missingRequired.length === 0 && !skuError && !packagingBlocked;

  const create = async () => {
    if (!readyToCreate) {
      toast.error(`Cannot create yet. Missing: ${missingRequired.join(", ")}`);
      return;
    }
    setSaving(true);
    try {
      const skuResult = await requireFastCreateSku(draft.categoryKey, draft.resolvedSku, draft.packagingCode);
      patchDraft({ resolvedSku: skuResult.sku });

      const payload =
        effectiveSuggestions() ?? buildHeuristicSuggestions(draft.productName.trim(), draft.categoryKey);
      const result = await saveFastCreateProduct({
        suggestions: payload,
        heroUrl: draft.heroUrl,
        roles,
        categoryKey: draft.categoryKey,
        resolvedSku: skuResult.sku,
        extraFormPatch: fastCreateFormPatchFromDraft(draft),
        saleType: draft.saleType,
      });

      clearFastCreateDraft();

      if ("draft" in result) {
        toast.success("Product draft submitted for approval.");
        nav("/approvals");
        return;
      }

      toast.success(`Product draft created (${result.sku}) — opening full editor.`);
      nav(`/products/${result.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setSaving(false);
    }
  };

  const addPackagingOption = async () => {
    const code = newOptionCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    const label = newOptionLabel.trim();
    if (!code || !label) {
      toast.error("Both code and label are required.");
      return;
    }
    setAddingOption(true);
    try {
      const { error } = await supabase.from("sku_code_rules").insert({
        code_type: "packaging",
        code,
        label,
        is_active: true,
      });
      if (error) throw new Error(error.message);
      toast.success(`Packaging option "${label}" added.`);
      setAddOptionOpen(false);
      setNewOptionCode("");
      setNewOptionLabel("");
      await loadPackagingOptions();
      patchDraft({ packagingCode: code, packagingLabel: label, resolvedSku: null });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add option");
    } finally {
      setAddingOption(false);
    }
  };

  const suggestions = draft.suggestions;
  const aliasesText =
    draft.editedAliases ?? (suggestions ? suggestions.aliases.map((a) => a.alias).join(", ") : "");
  const keywordsText =
    draft.editedWhatsappKeywords ?? (suggestions ? suggestions.whatsappKeywords.join(", ") : "");
  const descriptionText =
    draft.editedDescription ?? String(suggestions?.formPatch.description ?? "");

  return (
    <>
      <CatalogueWriteModeBanner />
      {bucketStatus && (
        <div className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          <strong>Media bucket:</strong> {bucketStatus}
          <div className="text-xs mt-1 text-muted-foreground">{MEDIA_BUCKET_OWNER_ACTION}</div>
        </div>
      )}
      {restoredFromDraft && (
        <div className="mb-4 rounded-md border border-accent/40 bg-accent/10 px-4 py-2 text-xs text-foreground">
          Restored your unsaved draft from this session.
        </div>
      )}
      <PageHeader
        title="Fast Create"
        subtitle="Fast draft inputs — the system fills compliance, search, and packaging defaults; you review and create a draft."
        actions={
          <div className="flex gap-2">
            {hasUnsavedWork && (
              <Button variant="ghost" onClick={() => setDiscardConfirmOpen(true)}>
                <Trash2 className="h-4 w-4 mr-1" /> Clear
              </Button>
            )}
            <Button variant="outline" onClick={() => requestNavigation("/products/new")}>
              Full editor
            </Button>
            <Button variant="outline" onClick={() => requestNavigation("/admin/import/category-1")}>
              Category 1 import
            </Button>
          </div>
        }
      />

      <div className="mb-4">
        <BuildMeterBar score={readinessScore} categories={readinessCategories} />
        <p className="mt-1 text-[11px] text-muted-foreground">
          {meterStatus.meetsThreshold
            ? "Ready for catalogue draft review after create."
            : "Draft only — complete the missing fields for catalogue draft review."}
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card-elevated p-6 space-y-5">
          <div className="flex items-center gap-2 text-accent">
            <Zap className="h-5 w-5" />
            <h2 className="font-display text-xl">Fast draft inputs</h2>
          </div>

          <div className="space-y-2">
            <Label>Sale type / product use</Label>
            <select
              className="w-full h-10 px-3 rounded-md border bg-background text-sm"
              value={draft.saleType}
              onChange={(e) => patchDraft({ saleType: e.target.value as SaleType, resolvedSku: null })}
            >
              {SALE_TYPES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
            {draft.saleType === "retail_ready_pack" && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={draft.b2bEnabled}
                  onChange={(e) => patchDraft({ b2bEnabled: e.target.checked })}
                />
                Also sold B2B (requires B2B price)
              </label>
            )}
          </div>

          <div className="space-y-2">
            <Label>Product name</Label>
            <Input
              value={draft.productName}
              onChange={(e) => patchDraft({ productName: e.target.value, suggestions: null })}
              placeholder="Misr 15 / Cashew Pyramid Gift Box"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <select
              className="w-full h-10 px-3 rounded-md border bg-background text-sm"
              value={draft.categoryKey}
              onChange={(e) =>
                patchDraft({
                  categoryKey: e.target.value as FastCreateCategoryKey,
                  suggestions: null,
                  resolvedSku: null,
                })
              }
            >
              {FAST_CREATE_CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {requirements.requiresPackaging && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Packaging type</Label>
                <Button type="button" size="sm" variant="ghost" onClick={() => setAddOptionOpen(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add option
                </Button>
              </div>
              <select
                className="w-full h-10 px-3 rounded-md border bg-background text-sm"
                value={draft.packagingCode ?? (packagingRules.length ? "" : PACKAGING_MISSING_SENTINEL)}
                onChange={(e) => {
                  const code = e.target.value;
                  if (code === PACKAGING_MISSING_SENTINEL || !code) {
                    patchDraft({ packagingCode: null, packagingLabel: null, resolvedSku: null });
                    return;
                  }
                  const rule = packagingRules.find((r) => r.code === code);
                  patchDraft({ packagingCode: code, packagingLabel: rule?.label ?? code, resolvedSku: null });
                }}
              >
                <option value="">Select packaging…</option>
                {packagingRules.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.label} ({r.code})
                  </option>
                ))}
                <option value={PACKAGING_MISSING_SENTINEL}>Packaging option missing — needs taxonomy update</option>
              </select>
              {packagingRulesError && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  Packaging options loaded with a warning: {packagingRulesError}
                </p>
              )}
              {packagingBlocked && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  No packaging selected — SKU generation and create are blocked until packaging is chosen or a
                  missing option is added to the taxonomy.
                </p>
              )}
            </div>
          )}

          {requirements.requiresQtyPerPack && (
            <div className="space-y-2">
              <Label>Qty per pack (pcs)</Label>
              <Input
                type="number"
                min="1"
                value={draft.qtyPerPack}
                onChange={(e) => patchDraft({ qtyPerPack: e.target.value })}
                placeholder="6"
              />
            </div>
          )}

          {(requirements.requiresMrp || requirements.requiresB2bPrice) && (
            <div className="grid grid-cols-2 gap-3">
              {requirements.requiresMrp && (
                <div className="space-y-2">
                  <Label>MRP (₹)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={draft.mrp}
                    onChange={(e) => patchDraft({ mrp: e.target.value })}
                    placeholder="450"
                  />
                </div>
              )}
              {requirements.requiresB2bPrice && (
                <div className="space-y-2">
                  <Label>B2B price (₹)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={draft.b2bPrice}
                    onChange={(e) => patchDraft({ b2bPrice: e.target.value })}
                    placeholder="380"
                  />
                </div>
              )}
            </div>
          )}
          {(requirements.requiresMrp || requirements.requiresB2bPrice) && (
            <p className="text-[10px] text-muted-foreground">
              Prices entered here carry into Full Editor and readiness checks — final channel pricing approval
              still happens in Sales Pricing Rules.
            </p>
          )}

          {requirements.requiresHeroImage && (
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
          )}

          {requirements.requiresExportFields && (
            <p className="text-[11px] text-muted-foreground rounded-md border border-dashed p-2">
              Export details (export price, carton dimensions, CBM, country labels) — complete in Full Editor
              after creating the draft.
            </p>
          )}

          <div className="rounded-md border border-dashed p-3 text-sm space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Structured SKU (before save)</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={resolveSkuPreview}
                disabled={generating || packagingBlocked}
              >
                Refresh SKU
              </Button>
            </div>
            {draft.resolvedSku ? (
              <>
                <div className="font-mono font-medium text-foreground">{draft.resolvedSku}</div>
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-dashed">
                  <span className="text-muted-foreground text-xs">Short SKU (staff/search)</span>
                  <span className="font-mono text-xs font-medium text-foreground">{shortSku}</span>
                </div>
                {draft.packagingLabel && (
                  <p className="text-[10px] text-muted-foreground">
                    Packaging segment: {draft.packagingLabel} ({draft.packagingCode})
                  </p>
                )}
              </>
            ) : skuError ? (
              <p className="text-destructive text-xs">{skuError}</p>
            ) : packagingBlocked ? (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                SKU invalid — fix packaging/category before approval.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Generate suggestions or click Refresh to resolve via RPC.</p>
            )}
          </div>

          <p className="text-xs text-muted-foreground">{CATEGORY_PREFEED_DISCLAIMER}</p>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              disabled={generating || !draft.productName.trim()}
              onClick={generate}
            >
              {generating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
              Generate suggestions
            </Button>
            <Button
              type="button"
              disabled={!readyToCreate || saving}
              onClick={create}
              title={readyToCreate ? undefined : `Missing: ${missingRequired.join(", ")}`}
            >
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ArrowRight className="h-4 w-4 mr-1" />}
              Create Product Draft
            </Button>
          </div>
          {!readyToCreate && missingRequired.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              Complete to create: {missingRequired.join(", ")}. Your input is kept as a session draft meanwhile.
            </p>
          )}
        </div>

        <div className="card-elevated p-6 space-y-4">
          <h2 className="font-display text-xl">System suggestions (editable)</h2>
          {!suggestions ? (
            <p className="text-sm text-muted-foreground">
              Pick a category to preview defaults, then click <strong>Generate suggestions</strong> for
              descriptions, aliases, WhatsApp keywords, and compliance fields — all editable before create.
            </p>
          ) : (
            <div className="space-y-4 text-sm">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Description</div>
                <Textarea
                  rows={3}
                  className="text-xs"
                  value={descriptionText}
                  onChange={(e) => patchDraft({ editedDescription: e.target.value })}
                />
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
              <p className="text-[10px] text-amber-700 dark:text-amber-400">
                Suggested default only — requires compliance review.
              </p>

              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                  Aliases (comma-separated, editable)
                </div>
                <Textarea
                  rows={2}
                  className="text-xs"
                  value={aliasesText}
                  onChange={(e) => patchDraft({ editedAliases: e.target.value })}
                />
              </div>

              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                  WhatsApp keywords (comma-separated, editable)
                </div>
                <Textarea
                  rows={2}
                  className="text-xs"
                  value={keywordsText}
                  onChange={(e) => patchDraft({ editedWhatsappKeywords: e.target.value })}
                />
              </div>

              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Label starter</div>
                <p className="text-muted-foreground">
                  {draft.qtyPerPack && Number(draft.qtyPerPack) > 0
                    ? `${draft.qtyPerPack} pcs ${String(suggestions.formPatch.primary_uom ?? "box")}${draft.packagingLabel ? ` · ${draft.packagingLabel}` : ""}`
                    : suggestions.labelStarter.net_weight_hint}
                </p>
              </div>
            </div>
          )}

          {!suggestions && (
            <div className="rounded-md border p-3 text-sm bg-muted/30 space-y-2">
              <div className="font-medium">Category preview: {categoryLabel}</div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {(["hsn_code", "gst_rate", "shelf_life_days", "primary_uom", "main_department"] as const).map(
                  (k) => {
                    const d = FAST_CREATE_CATEGORIES.find((c) => c.key === draft.categoryKey)?.defaults;
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

      <Dialog open={!!pendingNavPath} onOpenChange={(open) => !open && setPendingNavPath(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save draft and continue?</DialogTitle>
            <DialogDescription>
              You have unsaved Fast Create input. Save it as a draft for this session before leaving? Saved
              drafts also pre-fill the Full Editor.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setPendingNavPath(null)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                if (pendingNavPath) {
                  const path = pendingNavPath;
                  clearFastCreateDraft();
                  setPendingNavPath(null);
                  nav(path);
                }
              }}
            >
              Continue without saving
            </Button>
            <Button
              onClick={() => {
                saveFastCreateDraft(draft);
                if (pendingNavPath) {
                  const path = pendingNavPath;
                  setPendingNavPath(null);
                  nav(path);
                }
              }}
            >
              Save & continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={discardConfirmOpen} onOpenChange={setDiscardConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear this draft?</DialogTitle>
            <DialogDescription>
              This clears the product name, category, packaging, prices, image, and generated suggestions from
              this session. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscardConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={discardDraft}>
              Clear draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOptionOpen} onOpenChange={setAddOptionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add packaging option</DialogTitle>
            <DialogDescription>
              Adds a new packaging option to the shared SKU taxonomy (sku_code_rules). Options used by existing
              products are never deleted — they can only be disabled later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Code (A–Z, 0–9)</Label>
              <Input
                value={newOptionCode}
                onChange={(e) => setNewOptionCode(e.target.value)}
                placeholder="PREMBOX"
              />
            </div>
            <div className="space-y-1">
              <Label>Label</Label>
              <Input
                value={newOptionLabel}
                onChange={(e) => setNewOptionLabel(e.target.value)}
                placeholder="Branded Premium Box"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOptionOpen(false)}>
              Cancel
            </Button>
            <Button onClick={addPackagingOption} disabled={addingOption}>
              {addingOption ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Add option
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FastCreateProduct;
