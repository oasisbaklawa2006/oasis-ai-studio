import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Search,
  Loader2,
  AlertTriangle,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Copy,
  FileText,
  Save,
  History,
  ShieldCheck,
  Ban,
  Wand2,
  UserRound,
  Info,
  PencilLine,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import {
  computeCatalogueProductReadiness,
  type ReadinessCategory,
  type ReadinessResult,
  type ReadinessState,
} from "@/features/catalogueAiStudio/catalogueProductReadiness";
import {
  DRAFT_BLOCK_META,
  IMAGE_PROMPT_BLOCK_META,
  buildExportBundlePreview,
  generateCatalogueDraftContent,
  generateCatalogueImagePrompts,
  type DraftProductInput,
} from "@/features/catalogueAiStudio/catalogueContentGenerators";
import type {
  CatalogueDraftAuditRow,
  CatalogueDraftContent,
  CatalogueDraftPrompts,
  CatalogueDraftRow,
  CatalogueDraftStatus,
} from "@/features/catalogueAiStudio/catalogueDraftTypes";
import {
  approveDraft,
  fetchDraftAuditLog,
  fetchLatestDraft,
  rejectDraft,
  saveDraft,
  submitDraftForReview,
} from "@/features/catalogueAiStudio/catalogueDraftRepository";
import {
  STATUS_LABEL,
  canApprove,
  canReject,
  canSubmitForReview,
} from "@/features/catalogueAiStudio/catalogueDraftWorkflow";
import { fetchActorLabels } from "@/features/catalogueAiStudio/catalogueActorDisplay";

type CatalogueProductStudioProduct = DraftProductInput & {
  id: string;
  hero_image_url?: string | null;
  is_active: boolean | null;
  is_catalogue_ready: boolean | null;
};

const PRODUCT_SELECT =
  "id, product_name, sku, category, subcategory, description, short_description, hero_image_url, mrp, b2b_price, b2b_uom, pack_size, net_weight_g, carton_qty, master_carton_qty, pcs_per_carton, carton_dimensions_cm, moq_text, moq_value, moq_uom, shelf_life_days, storage_instructions, temperature_requirement, hsn_code, gst_rate, is_active, is_catalogue_ready";

interface EditorState {
  productId: string;
  content: CatalogueDraftContent;
  prompts: CatalogueDraftPrompts;
}

function generateEditorState(product: CatalogueProductStudioProduct): EditorState {
  return {
    productId: product.id,
    content: generateCatalogueDraftContent(product),
    prompts: generateCatalogueImagePrompts(product),
  };
}

function mapRowToEditor(row: CatalogueDraftRow): { content: CatalogueDraftContent; prompts: CatalogueDraftPrompts } {
  return {
    content: {
      catalogue_title: row.catalogue_title,
      short_description: row.short_description,
      long_description: row.long_description,
      b2b_sales_copy: row.b2b_sales_copy,
      export_catalogue_copy: row.export_catalogue_copy,
      whatsapp_product_message: row.whatsapp_product_message,
      hindi_description: row.hindi_description,
      storage_shelf_life_copy: row.storage_shelf_life_copy,
    },
    prompts: {
      hero_image_prompt: row.hero_image_prompt,
      square_image_prompt: row.square_image_prompt,
      closeup_image_prompt: row.closeup_image_prompt,
      packaging_image_prompt: row.packaging_image_prompt,
      lifestyle_image_prompt: row.lifestyle_image_prompt,
    },
  };
}

function buildSourceSnapshot(product: CatalogueProductStudioProduct): Record<string, unknown> {
  return {
    product_name: product.product_name ?? null,
    sku: product.sku ?? null,
    category: product.category ?? null,
    mrp: product.mrp ?? null,
    b2b_price: product.b2b_price ?? null,
    is_active: product.is_active ?? null,
    is_catalogue_ready: product.is_catalogue_ready ?? null,
    snapshotted_at: new Date().toISOString(),
  };
}

/** Reads a known string field out of an audit row's jsonb `metadata` — never throws on shape drift. */
function auditMetadataString(entry: CatalogueDraftAuditRow, key: string): string | null {
  const metadata = entry.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value : null;
}

const DRAFT_STATUS_BADGE_CLASS: Record<CatalogueDraftStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground border-border",
  UNDER_REVIEW: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-400/40",
  APPROVED: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-400/40",
  REJECTED: "bg-destructive/10 text-destructive border-destructive/40",
};

const STATE_TEXT_COLOR: Record<ReadinessState, string> = {
  pass: "text-emerald-600",
  warn: "text-amber-600",
  missing: "text-destructive",
};

const STATE_BADGE_CLASS: Record<ReadinessState, string> = {
  pass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-400/40",
  warn: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-400/40",
  missing: "bg-destructive/10 text-destructive border-destructive/40",
};

const STATE_ICON: Record<ReadinessState, typeof CheckCircle2> = {
  pass: CheckCircle2,
  warn: AlertCircle,
  missing: XCircle,
};

const STATE_LABEL: Record<ReadinessState, string> = {
  pass: "Ready",
  warn: "Needs attention",
  missing: "Missing",
};

const OVERALL_BADGE_CLASS: Record<ReadinessResult["overallLabel"], string> = {
  "Catalogue-ready": STATE_BADGE_CLASS.pass,
  "Needs attention": STATE_BADGE_CLASS.warn,
  "Not ready": STATE_BADGE_CLASS.missing,
};

function ReadinessRow({ category }: { category: ReadinessCategory }) {
  const Icon = STATE_ICON[category.state];
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border p-3">
      <Icon size={16} className={`${STATE_TEXT_COLOR[category.state]} mt-0.5 shrink-0`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-foreground">{category.label}</span>
          <Badge variant="outline" className={`text-[9px] uppercase ${STATE_BADGE_CLASS[category.state]}`}>
            {STATE_LABEL[category.state]}
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">{category.detail}</p>
        {category.nextAction && (
          <p className="text-[11px] text-foreground mt-1">
            <span className="font-semibold">Next: </span>
            {category.nextAction}
          </p>
        )}
      </div>
    </div>
  );
}

export default function CatalogueProductStudio() {
  const { user } = useAuth();
  const [products, setProducts] = useState<CatalogueProductStudioProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchProducts() {
      setLoading(true);
      setError(null);
      const { data, error: queryError } = await supabase
        .from("products")
        .select(PRODUCT_SELECT)
        .order("product_name", { ascending: true });
      if (cancelled) return;
      if (queryError) {
        setProducts([]);
        setError(queryError.message);
        setLoading(false);
        return;
      }
      setProducts((data as CatalogueProductStudioProduct[]) || []);
      setLoading(false);
    }
    fetchProducts();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        (p.product_name || "").toLowerCase().includes(q) ||
        (p.sku || "").toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q),
    );
  }, [products, search]);

  const selected = useMemo(() => products.find((p) => p.id === selectedId) || null, [products, selectedId]);
  const readiness: ReadinessResult | null = useMemo(
    () => (selected ? computeCatalogueProductReadiness(selected) : null),
    [selected],
  );
  const packagingCategories = useMemo(
    () => readiness?.categories.filter((c) => c.group === "packaging") ?? [],
    [readiness],
  );

  // Editor state lives only in local component state until explicitly saved. Keyed by productId so a
  // product switch can never render or copy the previous product's drafts.
  const [editorState, setEditorState] = useState<EditorState | null>(null);

  const editor: EditorState | null = useMemo(() => {
    if (!selected) return null;
    if (editorState && editorState.productId === selected.id) return editorState;
    return generateEditorState(selected);
  }, [selected, editorState]);

  const exportPreview = useMemo(() => {
    if (!selected || !editor) return "";
    return buildExportBundlePreview(selected, editor.content);
  }, [selected, editor]);

  const resetFromProduct = () => {
    if (!canResetDraft || !selected) return;
    setEditorState(generateEditorState(selected));
    toast.success("Draft reset from current product data.");
  };

  const updateContentBlock = (key: keyof CatalogueDraftContent, value: string) => {
    if (!selected) return;
    setEditorState((prev) => {
      const base = prev && prev.productId === selected.id ? prev : generateEditorState(selected);
      return { ...base, content: { ...base.content, [key]: value } };
    });
  };

  const updatePromptBlock = (key: keyof CatalogueDraftPrompts, value: string) => {
    if (!selected) return;
    setEditorState((prev) => {
      const base = prev && prev.productId === selected.id ? prev : generateEditorState(selected);
      return { ...base, prompts: { ...base.prompts, [key]: value } };
    });
  };

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied.`);
    } catch {
      toast.error("Could not copy — your browser blocked clipboard access.");
    }
  };

  // Persisted draft governance.
  const [persistedDraft, setPersistedDraft] = useState<CatalogueDraftRow | null>(null);
  const [auditLog, setAuditLog] = useState<CatalogueDraftAuditRow[]>([]);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftBusy, setDraftBusy] = useState(false);
  const [rejectReasonOpen, setRejectReasonOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  // Human-readable labels for created_by/reviewed_by/audit actor_id — without this the governance
  // workflow and audit trail only ever show opaque UUIDs. Keyed by user id; a lookup failure or an
  // id with no resolvable profile just falls back to a short id (see catalogueActorDisplay.ts).
  const [actorLabels, setActorLabels] = useState<Record<string, string>>({});

  // Always holds the product id actually on screen right now, read synchronously by every in-flight
  // async handler/effect below — never the stale product id closed over when that async call started.
  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    selectedIdRef.current = selected?.id ?? null;
  }, [selected]);

  // One product-switch effect owns the entire transition: clears the previous product's persisted
  // draft/audit/reject state and seeds a fresh generated draft immediately, then hydrates the real
  // saved draft (if any). No separate effect is left that could apply stale state out of order.
  useEffect(() => {
    let cancelled = false;
    if (!selected) {
      setPersistedDraft(null);
      setAuditLog([]);
      setRejectReasonOpen(false);
      setRejectReason("");
      setEditorState(null);
      setDraftLoading(false);
      setActorLabels({});
      return;
    }
    const productId = selected.id;
    setPersistedDraft(null);
    setAuditLog([]);
    setRejectReasonOpen(false);
    setRejectReason("");
    setActorLabels({});
    setEditorState(generateEditorState(selected));
    setDraftLoading(true);

    fetchLatestDraft(productId)
      .then(async (row) => {
        if (cancelled || selectedIdRef.current !== productId) return;
        setPersistedDraft(row);
        if (row) {
          setEditorState({ productId, ...mapRowToEditor(row) });
          const log = await fetchDraftAuditLog(row.id);
          if (!cancelled && selectedIdRef.current === productId) setAuditLog(log);
        }
      })
      .catch((err) => {
        if (!cancelled && selectedIdRef.current === productId) {
          toast.error(err instanceof Error ? err.message : "Could not load saved draft.");
        }
      })
      .finally(() => {
        if (!cancelled) setDraftLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  // Resolves every actor id currently visible (draft creator/reviewer, every audit row's actor) into
  // a display label in one batched lookup. Runs whenever the persisted draft or audit log changes;
  // guarded by selectedIdRef so a slow lookup started before a product switch never paints labels for
  // the wrong product.
  useEffect(() => {
    const productId = selected?.id ?? null;
    if (!productId || (!persistedDraft && auditLog.length === 0)) return;
    let cancelled = false;
    const ids = [
      persistedDraft?.created_by,
      persistedDraft?.reviewed_by,
      ...auditLog.map((entry) => entry.actor_id),
    ];
    fetchActorLabels(ids).then((labels) => {
      if (!cancelled && selectedIdRef.current === productId) {
        setActorLabels((prev) => ({ ...prev, ...labels }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selected?.id, persistedDraft, auditLog]);

  // Guarded by the expected product id so a refresh kicked off before a product switch can never
  // overwrite the new product's audit history with the previous draft's events.
  const refreshAuditLog = async (draftId: string, expectedProductId: string) => {
    try {
      const log = await fetchDraftAuditLog(draftId);
      if (selectedIdRef.current === expectedProductId) setAuditLog(log);
    } catch {
      // History is a convenience view — a refresh failure here should not block the workflow action.
    }
  };

  // The single source of truth every badge/button/handler below reads: persistedDraft is only ever
  // treated as "the current draft" when it, the hydrated editor state, AND the selected product all
  // agree on the same product id. Any mismatch (a stale fetch mid-switch, a race on the ref) collapses
  // this to null, which disables every workflow action rather than risk acting on the wrong draft.
  const currentPersistedDraft: CatalogueDraftRow | null =
    persistedDraft && selected && editor &&
    persistedDraft.product_id === selected.id &&
    editor.productId === selected.id
      ? persistedDraft
      : null;

  // Locked only while UNDER_REVIEW: a reviewer must approve/reject before content can change again.
  const textLocked = currentPersistedDraft?.status === "UNDER_REVIEW";
  // While the persisted draft is still being fetched/hydrated, no workflow action or edit may occur.
  const workflowDisabled = draftBusy || draftLoading;
  // Reset must never fire while a save/submit/approve/reject is in flight, while the saved draft is
  // still loading, while the draft is UNDER_REVIEW (locked), or with no product selected — same
  // guards as every other draft-mutating action on this page.
  const canResetDraft = !draftLoading && !workflowDisabled && !textLocked && !draftBusy && !!selected;

  // True when the editor's current content/prompts differ from the last saved draft — the operator
  // has no other way to tell whether "Save Draft" would actually change anything right now. Only
  // meaningful once a saved draft exists; a freshly generated (never-saved) draft is always "unsaved"
  // by definition and isn't flagged here to avoid a permanently-on indicator with nothing to compare.
  const hasUnsavedChanges = useMemo(() => {
    if (!currentPersistedDraft || !editor) return false;
    const saved = mapRowToEditor(currentPersistedDraft);
    return (
      JSON.stringify(editor.content) !== JSON.stringify(saved.content) ||
      JSON.stringify(editor.prompts) !== JSON.stringify(saved.prompts)
    );
  }, [currentPersistedDraft, editor]);

  const handleSaveDraft = async () => {
    if (!selected || !editor) return;
    const productId = selected.id;
    setDraftBusy(true);
    try {
      const row = await saveDraft({
        productId,
        content: {
          ...editor.content,
          ...editor.prompts,
          export_bundle_preview: buildExportBundlePreview(selected, editor.content),
          source_snapshot: buildSourceSnapshot(selected),
        },
        actorId: user?.id ?? null,
      });
      if (selectedIdRef.current !== productId) return;
      setPersistedDraft(row);
      setEditorState({ productId, ...mapRowToEditor(row) });
      await refreshAuditLog(row.id, productId);
      toast.success(`Draft saved — v${row.version_number} (${STATUS_LABEL[row.status as CatalogueDraftStatus]}).`);
    } catch (err) {
      if (selectedIdRef.current === productId) toast.error(err instanceof Error ? err.message : "Could not save draft.");
    } finally {
      setDraftBusy(false);
    }
  };

  const handleLoadLatestDraft = async () => {
    if (!selected) return;
    const productId = selected.id;
    setDraftBusy(true);
    try {
      const row = await fetchLatestDraft(productId);
      if (selectedIdRef.current !== productId) return;
      if (!row) {
        toast.error("No saved draft yet for this product.");
        return;
      }
      setPersistedDraft(row);
      setEditorState({ productId, ...mapRowToEditor(row) });
      await refreshAuditLog(row.id, productId);
      toast.success(`Loaded v${row.version_number} (${STATUS_LABEL[row.status as CatalogueDraftStatus]}).`);
    } catch (err) {
      if (selectedIdRef.current === productId) toast.error(err instanceof Error ? err.message : "Could not load draft.");
    } finally {
      setDraftBusy(false);
    }
  };

  // Always persists exactly what is currently visible in the editor into the DRAFT row first, then
  // transitions that same saved row to UNDER_REVIEW — never submits stale database content, and never
  // acts against a product the operator has since navigated away from.
  const handleSubmitForReview = async () => {
    if (!selected || !editor) return;
    if (!currentPersistedDraft || draftLoading) {
      toast.error("Draft is still loading. Please wait.");
      return;
    }
    const productId = selected.id;
    setDraftBusy(true);
    try {
      const saved = await saveDraft({
        productId,
        content: {
          ...editor.content,
          ...editor.prompts,
          export_bundle_preview: buildExportBundlePreview(selected, editor.content),
          source_snapshot: buildSourceSnapshot(selected),
        },
        actorId: user?.id ?? null,
      });
      if (selectedIdRef.current !== productId) return;
      const row = await submitDraftForReview(saved.id, user?.id ?? null);
      if (selectedIdRef.current !== productId) return;
      setPersistedDraft(row);
      setEditorState({ productId, ...mapRowToEditor(row) });
      await refreshAuditLog(row.id, productId);
      toast.success("Submitted for review.");
    } catch (err) {
      if (selectedIdRef.current === productId) toast.error(err instanceof Error ? err.message : "Could not submit for review.");
    } finally {
      setDraftBusy(false);
    }
  };

  const handleApprove = async () => {
    if (!selected) return;
    if (!currentPersistedDraft || draftLoading) {
      toast.error("Draft is still loading. Please wait.");
      return;
    }
    const productId = selected.id;
    const draftId = currentPersistedDraft.id;
    setDraftBusy(true);
    try {
      const row = await approveDraft(draftId, user?.id ?? null);
      if (selectedIdRef.current !== productId) return;
      setPersistedDraft(row);
      setEditorState({ productId, ...mapRowToEditor(row) });
      await refreshAuditLog(row.id, productId);
      toast.success("Draft approved.");
    } catch (err) {
      if (selectedIdRef.current === productId) toast.error(err instanceof Error ? err.message : "Could not approve draft.");
    } finally {
      setDraftBusy(false);
    }
  };

  const handleReject = async () => {
    if (!selected || !rejectReason.trim()) return;
    if (!currentPersistedDraft || draftLoading) {
      toast.error("Draft is still loading. Please wait.");
      return;
    }
    const productId = selected.id;
    const draftId = currentPersistedDraft.id;
    setDraftBusy(true);
    try {
      const row = await rejectDraft(draftId, user?.id ?? null, rejectReason.trim());
      if (selectedIdRef.current !== productId) return;
      setPersistedDraft(row);
      setEditorState({ productId, ...mapRowToEditor(row) });
      await refreshAuditLog(row.id, productId);
      setRejectReasonOpen(false);
      setRejectReason("");
      toast.success("Draft rejected.");
    } catch (err) {
      if (selectedIdRef.current === productId) toast.error(err instanceof Error ? err.message : "Could not reject draft.");
    } finally {
      setDraftBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Catalogue Product AI Studio"
        subtitle="Select a product to draft, review, and approve catalogue copy and image prompts."
      />

      <div className="flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-500/10 p-3 text-xs font-semibold text-amber-800 dark:text-amber-300">
        <AlertTriangle size={14} className="shrink-0" />
        Catalogue Product AI Studio writes drafts only. Live product master changes are not performed here.
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3 text-[11px] text-muted-foreground">
        <Info size={14} className="shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="text-foreground font-semibold">How this fits together</p>
          <p>1. This app creates and governs the draft (save → submit → approve/reject) shown below.</p>
          <p>2. oasis-supabase-core owns the draft/audit schema this app reads and writes.</p>
          <p>3. Oasis-Baklawa-Central is meant to consume only an <em>approved, final</em> snapshot — never a raw in-progress draft.</p>
          <p>4. oasis-trace should only ever receive final product identity via Central's product master, never directly from this app.</p>
          <p className="text-foreground">
            Note: steps 3 and 4 describe the intended design. There is currently no automated connector
            publishing an approved draft from here into Central — an approved draft stays a governed
            record in this app until that connector exists.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Search size={14} /> Select a product
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Search by name, SKU, or category…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin text-muted-foreground" size={20} />
              </div>
            ) : error ? (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                <AlertTriangle size={14} /> {error}
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                {products.length === 0 ? "No products in the catalogue yet." : "No products match your search."}
              </p>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto space-y-1">
                {filtered.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                      selectedId === p.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <div className="font-semibold text-foreground truncate">{p.product_name || "Untitled product"}</div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {p.sku || "No SKU"} · {p.category || "No category"}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-5">
          {!selected ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Select a product from the list to see its catalogue summary and readiness score.
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">{selected.product_name || "Untitled product"}</CardTitle>
                  <CardDescription className="text-[11px]">
                    Product summary is read-only here. Make master data changes in Products.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    <div>
                      <p className="text-[9px] font-semibold text-muted-foreground uppercase">SKU</p>
                      <p className="font-medium text-foreground">{selected.sku || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold text-muted-foreground uppercase">Category</p>
                      <p className="font-medium text-foreground">{selected.category || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold text-muted-foreground uppercase">Pack Size</p>
                      <p className="font-medium text-foreground">{selected.pack_size || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold text-muted-foreground uppercase">Hero Image</p>
                      <p className="font-medium text-foreground flex items-center gap-1">
                        <ImageIcon
                          size={12}
                          className={selected.hero_image_url ? "text-emerald-600" : "text-muted-foreground/40"}
                        />
                        {selected.hero_image_url ? "Present" : "Not set"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold text-muted-foreground uppercase">MRP</p>
                      <p className="font-medium text-foreground">{selected.mrp ? `₹${selected.mrp}` : "—"}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold text-muted-foreground uppercase">B2B Price</p>
                      <p className="font-medium text-foreground">{selected.b2b_price ? `₹${selected.b2b_price}` : "—"}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold text-muted-foreground uppercase">Active</p>
                      <p className="font-medium text-foreground">{(selected.is_active ?? true) ? "Yes" : "No"}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold text-muted-foreground uppercase">Catalogue Ready</p>
                      <p className="font-medium text-foreground">{selected.is_catalogue_ready ? "Yes" : "No"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {readiness && (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <CardTitle className="text-sm">Catalogue readiness</CardTitle>
                      <Badge className={OVERALL_BADGE_CLASS[readiness.overallLabel]}>
                        {readiness.overallLabel} · {readiness.score}%
                      </Badge>
                    </div>
                    <CardDescription className="text-[11px]">
                      Calculated only from the fields shown on this page — no AI review, no approval decision.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {readiness.categories.map((c) => (
                      <ReadinessRow key={c.key} category={c} />
                    ))}
                  </CardContent>
                </Card>
              )}

              {editor && (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Wand2 size={14} /> Governance workflow
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {hasUnsavedChanges && (
                          <Badge variant="outline" className="text-[9px] uppercase bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-400/40">
                            <PencilLine size={10} className="mr-1" /> Unsaved changes
                          </Badge>
                        )}
                        {currentPersistedDraft && (
                          <Badge variant="outline" className={`text-[9px] uppercase ${DRAFT_STATUS_BADGE_CLASS[currentPersistedDraft.status as CatalogueDraftStatus]}`}>
                            {STATUS_LABEL[currentPersistedDraft.status as CatalogueDraftStatus]} · v{currentPersistedDraft.version_number}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <CardDescription className="text-[11px]">
                      Workflow actions always act on the currently displayed saved draft for this product.
                    </CardDescription>

                    {currentPersistedDraft && (currentPersistedDraft.status === "APPROVED" || currentPersistedDraft.status === "REJECTED") && currentPersistedDraft.reviewed_at && (
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <UserRound size={12} />
                        {STATUS_LABEL[currentPersistedDraft.status as CatalogueDraftStatus]} by{" "}
                        {currentPersistedDraft.reviewed_by ? (actorLabels[currentPersistedDraft.reviewed_by] ?? "…") : "unknown"} on{" "}
                        {new Date(currentPersistedDraft.reviewed_at).toLocaleString()}
                      </p>
                    )}

                    {currentPersistedDraft?.status === "REJECTED" && currentPersistedDraft.rejection_reason && (
                      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-2.5 text-[11px] text-foreground">
                        <span className="font-semibold text-destructive">Rejection reason: </span>
                        {currentPersistedDraft.rejection_reason}
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button type="button" size="sm" disabled={workflowDisabled || textLocked} onClick={handleSaveDraft}>
                        <Save size={12} className="mr-1.5" /> Save Draft
                      </Button>
                      <Button type="button" size="sm" variant="outline" disabled={workflowDisabled} onClick={handleLoadLatestDraft}>
                        <History size={12} className="mr-1.5" /> Load Latest Draft
                      </Button>
                      <Button type="button" size="sm" variant="outline" disabled={!canResetDraft} onClick={resetFromProduct}>
                        Reset draft from product data
                      </Button>
                      {currentPersistedDraft && canSubmitForReview(currentPersistedDraft.status as CatalogueDraftStatus) && (
                        <Button type="button" size="sm" variant="outline" disabled={workflowDisabled} onClick={handleSubmitForReview}>
                          Submit for Review
                        </Button>
                      )}
                      {currentPersistedDraft && canApprove(currentPersistedDraft.status as CatalogueDraftStatus) && (
                        <Button type="button" size="sm" variant="outline" disabled={workflowDisabled} onClick={handleApprove}>
                          <ShieldCheck size={12} className="mr-1.5" /> Approve
                        </Button>
                      )}
                      {currentPersistedDraft && canReject(currentPersistedDraft.status as CatalogueDraftStatus) && !rejectReasonOpen && (
                        <Button type="button" size="sm" variant="outline" disabled={workflowDisabled} onClick={() => setRejectReasonOpen(true)}>
                          <Ban size={12} className="mr-1.5" /> Reject
                        </Button>
                      )}
                      {draftLoading && (
                        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <Loader2 size={12} className="animate-spin" /> Loading saved draft…
                        </span>
                      )}
                    </div>

                    {rejectReasonOpen && (
                      <div className="mt-2 space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                        <label className="text-[11px] font-semibold text-foreground">Rejection reason</label>
                        <Textarea
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          rows={2}
                          className="text-xs"
                          placeholder="Explain what needs to change before resubmission…"
                        />
                        <div className="flex items-center gap-2">
                          <Button type="button" size="sm" variant="destructive" disabled={workflowDisabled || !rejectReason.trim()} onClick={handleReject}>
                            Confirm Reject
                          </Button>
                          <Button type="button" size="sm" variant="ghost" disabled={workflowDisabled} onClick={() => { setRejectReasonOpen(false); setRejectReason(""); }}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                    {textLocked && (
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        Under review — approve or reject before editing again.
                      </p>
                    )}
                  </CardHeader>

                  {currentPersistedDraft && (
                    <CardContent>
                      <div className="flex items-center gap-2 mb-1">
                        <History size={14} className="text-muted-foreground" />
                        <span className="text-xs font-semibold text-foreground">
                          History / audit — v{currentPersistedDraft.version_number}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mb-2">
                        Scoped to this version only. Reasons from a prior rejected version, if any, carry forward
                        into the "CREATE_NEW_VERSION" entry below.
                      </p>
                      {auditLog.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">No actions recorded yet.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {auditLog.map((entry) => {
                            const reason =
                              auditMetadataString(entry, "rejection_reason") ??
                              auditMetadataString(entry, "previous_version_rejection_reason");
                            return (
                              <div key={entry.id} className="rounded-lg border border-border px-3 py-2 text-[11px] space-y-1">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-semibold text-foreground">{entry.action}</span>
                                  <span className="text-muted-foreground">
                                    {entry.from_status ?? "—"} → {entry.to_status ?? "—"}
                                  </span>
                                  <span className="text-muted-foreground">{new Date(entry.created_at).toLocaleString()}</span>
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-2 text-muted-foreground">
                                  <span>{entry.actor_id ? (actorLabels[entry.actor_id] ?? "…") : "—"}</span>
                                  {reason && <span className="text-foreground">Reason: {reason}</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              )}

              {editor && (
                <Card>
                  <CardContent className="pt-6">
                    <Tabs defaultValue="content">
                      <TabsList className="flex-wrap h-auto">
                        <TabsTrigger value="content">Content Draft Studio</TabsTrigger>
                        <TabsTrigger value="media">Media / Hero Image Prompts</TabsTrigger>
                        <TabsTrigger value="packaging">Packaging + Variant Readiness</TabsTrigger>
                        <TabsTrigger value="export">Export / Copy Bundle Preview</TabsTrigger>
                      </TabsList>

                      <TabsContent value="content" className="space-y-4 pt-4">
                        <p className="text-[11px] text-muted-foreground">
                          Generated locally from this product's current fields — no external AI call in this studio.
                        </p>
                        {DRAFT_BLOCK_META.map((block) => (
                          <div key={block.key} className="space-y-1.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <label className="text-xs font-semibold text-foreground">{block.label}</label>
                                <p className="text-[10px] text-muted-foreground">{block.hint}</p>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={draftLoading}
                                onClick={() => copyText(editor.content[block.key], block.label)}
                              >
                                <Copy size={12} className="mr-1.5" /> Copy
                              </Button>
                            </div>
                            <Textarea
                              value={editor.content[block.key]}
                              onChange={(e) => updateContentBlock(block.key, e.target.value)}
                              rows={block.key === "long_description" ? 4 : 2}
                              className="text-xs"
                              disabled={textLocked || draftLoading}
                            />
                          </div>
                        ))}
                      </TabsContent>

                      <TabsContent value="media" className="space-y-4 pt-4">
                        <p className="text-[11px] text-muted-foreground">
                          Prompt text only — this studio does not generate images.
                        </p>
                        {IMAGE_PROMPT_BLOCK_META.map((block) => (
                          <div key={block.key} className="space-y-1.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <label className="text-xs font-semibold text-foreground">{block.label}</label>
                                <p className="text-[10px] text-muted-foreground">{block.hint}</p>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={draftLoading}
                                onClick={() => copyText(editor.prompts[block.key], block.label)}
                              >
                                <Copy size={12} className="mr-1.5" /> Copy
                              </Button>
                            </div>
                            <Textarea
                              value={editor.prompts[block.key]}
                              onChange={(e) => updatePromptBlock(block.key, e.target.value)}
                              rows={2}
                              className="text-xs"
                              disabled={textLocked || draftLoading}
                            />
                          </div>
                        ))}
                      </TabsContent>

                      <TabsContent value="packaging" className="space-y-2 pt-4">
                        <p className="text-[11px] text-muted-foreground">
                          Read-only checklist derived from product fields — nothing here is editable or saved.
                        </p>
                        {packagingCategories.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2">No packaging data available.</p>
                        ) : (
                          packagingCategories.map((c) => <ReadinessRow key={c.key} category={c} />)
                        )}
                      </TabsContent>

                      <TabsContent value="export" className="space-y-3 pt-4">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                            <FileText size={14} /> Export / copy bundle preview
                          </div>
                          <Button type="button" size="sm" variant="outline" onClick={() => copyText(exportPreview, "Export bundle")}>
                            <Copy size={12} className="mr-1.5" /> Copy bundle
                          </Button>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Text preview only — no PDF is generated in this studio.
                        </p>
                        <Textarea value={exportPreview} readOnly rows={16} className="text-xs font-mono" />
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
