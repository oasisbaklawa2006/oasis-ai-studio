import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  RefreshCw,
  Languages,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { BuildMeterBar } from "@/components/BuildMeterBar";
import { ProductMediaUploader } from "@/components/ProductMediaUploader";
import { isTestingMediaGovernance } from "@/features/mediaReadiness/mediaGovernanceDisplay";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  composeCatalogueImagePrompt,
  generateCatalogueDraftContent,
  generateCatalogueImagePrompts,
  type DraftProductInput,
} from "@/features/catalogueAiStudio/catalogueContentGenerators";
import type {
  CatalogueDraftAuditRow,
  CatalogueDraftContent,
  CatalogueDraftContentKey,
  CatalogueDraftPromptKey,
  CatalogueDraftPrompts,
  CatalogueDraftRow,
  CatalogueDraftStatus,
} from "@/features/catalogueAiStudio/catalogueDraftTypes";
import {
  approveDraft,
  fetchDraftAuditLog,
  fetchLatestDraft,
  fetchLatestDraftStatuses,
  rejectDraft,
  saveDraft,
  submitDraftForReview,
} from "@/features/catalogueAiStudio/catalogueDraftRepository";
import {
  STATUS_LABEL,
  canApprove,
  canReject,
  canSubmitForReview,
  isExportBundleDistributable,
} from "@/features/catalogueAiStudio/catalogueDraftWorkflow";
import { fetchActorLabels } from "@/features/catalogueAiStudio/catalogueActorDisplay";
import { isMissingFieldOnlyMessage } from "@/features/catalogueAiStudio/missingFieldMessage";
import { fullEditorDeepLink, fullEditorTabForCategory } from "@/features/catalogueAiStudio/catalogueStudioNavigation";
import { isFieldEdited } from "@/features/catalogueAiStudio/catalogueFieldEditedState";
import { summarizeCatalogueMedia, type CatalogueMediaRow } from "@/features/catalogueAiStudio/catalogueMediaSummary";
import {
  getCachedProductMediaAuthority,
  subscribeToProductMediaAuthority,
} from "@/features/productAuthority/productMediaMutationAuthority";
import { deriveShortSku } from "@/features/fastCreate/shortSku";
import { saleTypeLabelFromForm } from "@/features/catalogueAiStudio/catalogueSaleTypeLabel";
import {
  INITIAL_MEDIA_LOAD_STATE,
  mediaLoadFailed,
  mediaLoadStarted,
  mediaLoadSucceeded,
  type MediaLoadState,
} from "@/features/catalogueAiStudio/catalogueMediaLoadState";
import { isLanguageMessagingField } from "@/features/catalogueAiStudio/catalogueLanguageFields";
import {
  isInvalidCatalogueStudioTab,
  resolveCatalogueStudioTab,
  withSelectedProduct,
  withStudioTab,
} from "@/features/catalogueAiStudio/catalogueStudioUrlState";
import {
  classifyWorkQueueStatus,
  WORK_QUEUE_STATUS_LABEL,
  WORK_QUEUE_STATUSES,
  type WorkQueueStatus,
} from "@/features/catalogueAiStudio/catalogueWorkQueueStatus";
import {
  CATALOGUE_AI_TONES,
  generateCatalogueContentDraft,
  type CatalogueAiSourceFacts,
  type CatalogueAiTone,
} from "@/features/catalogueAiStudio/catalogueAiGateway";
import {
  advanceAiFieldTracking,
  buildAiGenerationProvenance,
  isAiGenerationBlockedByIdentity,
  mergeAiGeneratedContent,
  readPersistedAiGenerationProvenance,
  restoreAiGenerationState,
  type AiFieldTracking,
} from "@/features/catalogueAiStudio/catalogueAiGenerationMerge";
import { Sparkles } from "lucide-react";
import {
  lastOpenedProduct,
  parseRecentProductEntries,
  recordRecentProduct,
  type RecentProductEntry,
} from "@/features/catalogueAiStudio/catalogueRecentProducts";
import { ChevronDown, ChevronUp, Clock } from "lucide-react";

type CatalogueProductStudioProduct = DraftProductInput & {
  id: string;
  hero_image_url?: string | null;
  media_status?: string | null;
  is_active: boolean | null;
  is_catalogue_ready: boolean | null;
  product_class?: string | null;
  main_department?: string | null;
  packaging_code?: string | null;
};

// carton_dimensions_cm is not present on production's products table (schema drift from the
// AI-Studio reference implementation) and is optional everywhere it's consumed, so it's safely
// omitted from the select. b2b_price is NOT a real column either (see PR #77-79's pricing-authority
// findings) — the real column is price_b2b, selected below and mapped onto the b2b_price field
// name at the query boundary only (mapRowsFromSupabase), so every downstream consumer of
// DraftProductInput/ReadinessProductInput keeps using the one field name they already expect.
// image_url is likewise not a real column in the generated products Row type (same class of gap,
// already documented in the audit SQL) — hero_image_url alone is selected.
// price_b2b (and, like image_url above, the whole point of this array) is missing from the
// generated types too, even though it's the real production column. Kept as an array joined at
// the call site — same established pattern as DataCorrection.tsx — because a literal select
// string lets Supabase's generated types statically reject any column absent from types.ts, and
// that check has no way to know types.ts itself is stale.
const PRODUCT_SELECT = [
  "id", "product_name", "sku", "category", "subcategory", "description", "short_description",
  "hero_image_url", "media_status", "mrp", "price_b2b", "b2b_uom", "pack_size", "net_weight_g",
  "carton_qty", "master_carton_qty", "pcs_per_carton", "moq_text", "moq_value", "moq_uom",
  "shelf_life_days", "storage_instructions", "temperature_requirement", "hsn_code", "gst_rate",
  "is_active", "is_catalogue_ready", "product_class", "main_department", "packaging_code",
].join(", ");

/** Maps the raw price_b2b column onto the shared b2b_price field name every readiness/draft-generator consumer expects. */
function mapRowFromSupabase(row: Record<string, unknown>): CatalogueProductStudioProduct {
  const { price_b2b, ...rest } = row;
  return { ...rest, b2b_price: (price_b2b as number | null) ?? null } as CatalogueProductStudioProduct;
}

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

function buildSourceSnapshot(
  product: CatalogueProductStudioProduct,
  aiGeneration: Record<string, unknown> | null = null,
): Record<string, unknown> {
  return {
    product_name: product.product_name ?? null,
    sku: product.sku ?? null,
    category: product.category ?? null,
    mrp: product.mrp ?? null,
    b2b_price: product.b2b_price ?? null,
    is_active: product.is_active ?? null,
    is_catalogue_ready: product.is_catalogue_ready ?? null,
    snapshotted_at: new Date().toISOString(),
    ai_generation: aiGeneration,
  };
}

/**
 * A3 AI safety/provenance wrapper: resolves the AI baseline/applied-fields state into the pure
 * `buildAiGenerationProvenance` (catalogueAiGenerationMerge.ts, unit-tested). When no fresh AI
 * generation happened this session (no in-memory baseline — e.g. the studio was just reopened),
 * falls back to re-reading whatever provenance the previous save already recorded rather than
 * overwriting it with null, which would silently erase that history (Bugbot regression).
 */
function resolveAiGenerationProvenance(
  editor: EditorState,
  aiGeneratedBaseline: EditorState | null,
  aiFieldTracking: AiFieldTracking | null,
  tone: CatalogueAiTone | null,
  previouslyPersistedSourceSnapshot: unknown,
): Record<string, unknown> | null {
  if (aiGeneratedBaseline && aiGeneratedBaseline.productId === editor.productId && aiFieldTracking) {
    return {
      ...buildAiGenerationProvenance(editor.content, aiGeneratedBaseline.content, aiFieldTracking, tone),
    };
  }
  const persisted = readPersistedAiGenerationProvenance(previouslyPersistedSourceSnapshot);
  return persisted ? { ...persisted } : null;
}

/** Reads a known string field out of an audit row's jsonb `metadata` — never throws on shape drift. */
function auditMetadataString(entry: CatalogueDraftAuditRow, key: string): string | null {
  const metadata = entry.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value : null;
}

const RECENT_PRODUCTS_STORAGE_KEY = "oasis_catalogue_studio_recent_products";

const QUEUE_FILTER_OPTIONS: { key: WorkQueueStatus | "all" | "recent"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "recent", label: "Recently Worked On" },
  ...WORK_QUEUE_STATUSES.map((s) => ({ key: s, label: WORK_QUEUE_STATUS_LABEL[s] })),
];

const WORK_QUEUE_STATUS_BADGE_CLASS: Record<WorkQueueStatus, string> = {
  needs_truth: "bg-destructive/10 text-destructive border-destructive/40",
  ready_for_generation: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-400/40",
  draft: "bg-muted text-muted-foreground border-border",
  under_review: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-400/40",
  rejected: "bg-destructive/10 text-destructive border-destructive/40",
  approved: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-400/40",
};

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

function ReadinessRow({ category, productId, onGoToFullEditor }: {
  category: ReadinessCategory;
  productId?: string;
  onGoToFullEditor?: (categoryKey: string) => void;
}) {
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
        {productId && category.state !== "pass" && onGoToFullEditor && (
          <Button
            type="button"
            size="sm"
            variant="link"
            className="h-auto p-0 mt-1 text-[11px]"
            onClick={() => onGoToFullEditor(category.key)}
          >
            Fix in Full Editor ({fullEditorTabForCategory(category.key)}) →
          </Button>
        )}
      </div>
    </div>
  );
}

export default function CatalogueProductStudio() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [products, setProducts] = useState<CatalogueProductStudioProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<WorkQueueStatus | "all" | "recent">("all");
  const [queueExpanded, setQueueExpanded] = useState(true);
  const [governanceExpanded, setGovernanceExpanded] = useState(false);
  const [auditExpanded, setAuditExpanded] = useState(false);
  const [anchorDetailsExpanded, setAnchorDetailsExpanded] = useState(false);

  // "Recently Worked On" / "Continue Last Product" — client-side only (localStorage), no schema
  // change. Read once on mount; every product selection updates and persists it.
  const [recentProducts, setRecentProducts] = useState<RecentProductEntry[]>([]);
  useEffect(() => {
    try {
      setRecentProducts(parseRecentProductEntries(localStorage.getItem(RECENT_PRODUCTS_STORAGE_KEY)));
    } catch {
      setRecentProducts([]);
    }
  }, []);
  const recordProductOpened = (productId: string) => {
    setRecentProducts((prev) => {
      const next = recordRecentProduct(prev, productId);
      try {
        localStorage.setItem(RECENT_PRODUCTS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // localStorage unavailable (private browsing, quota) — recency tracking degrades to
        // session-only state, never a hard failure.
      }
      return next;
    });
  };

  // Every product's latest draft status, for the work queue (not just the selected product's) —
  // read-only, additive query against the existing catalogue_ai_studio_drafts table.
  const [draftStatuses, setDraftStatuses] = useState<Map<string, CatalogueDraftStatus>>(new Map());

  // URL-authoritative: the selected product and active studio tab live only in the URL (?product=,
  // ?tab=), never in a separate useState — so there is exactly one source of truth. This makes
  // browser Back/Forward, page reload, and a second/repeat navigation to the same deep link all
  // restore correctly, instead of silently doing nothing because a local useState never noticed the
  // URL changed underneath it (the owner-reported smoke-test failures this closes). The decision
  // logic itself lives in catalogueStudioUrlState.ts (pure, unit-tested); this only wires it to
  // useSearchParams().
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("product");
  const selectProduct = (productId: string) => {
    setSearchParams((prev) => withSelectedProduct(prev, productId), { replace: false });
    recordProductOpened(productId);
    setQueueExpanded(false);
  };

  const rawStudioTab = searchParams.get("tab");
  const studioTab = resolveCatalogueStudioTab(rawStudioTab);
  const selectStudioTab = (tab: string) => {
    setSearchParams((prev) => withStudioTab(prev, tab), { replace: false });
  };
  // A stale/invalid ?tab= (e.g. an old bookmark) must fall back safely rather than ever crash the
  // Tabs component — correct the URL itself via replace so it doesn't linger, without adding an
  // extra Back/Forward history entry for a correction the operator didn't ask for.
  useEffect(() => {
    if (isInvalidCatalogueStudioTab(rawStudioTab)) {
      setSearchParams((prev) => withStudioTab(prev, "content"), { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawStudioTab]);

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
      setProducts(((data as unknown as Record<string, unknown>[]) || []).map(mapRowFromSupabase));
      setLoading(false);
    }
    fetchProducts();
    return () => {
      cancelled = true;
    };
  }, []);

  // Bugbot-caught: save/submit/approve/reject only ever updated the SELECTED product's own
  // `persistedDraft` state, never the bulk `draftStatuses` map the work queue reads — so a queue
  // badge/filter could show a stale status (e.g. "Ready for Generation" for a product that now has
  // a draft) until a full page reload. Every handler below patches this map with the server's own
  // returned row status immediately after a successful mutation.
  const patchDraftStatus = (productId: string, status: CatalogueDraftStatus | null) => {
    setDraftStatuses((prev) => {
      const next = new Map(prev);
      if (status) next.set(productId, status);
      else next.delete(productId);
      return next;
    });
  };

  useEffect(() => {
    if (products.length === 0) {
      setDraftStatuses(new Map());
      return;
    }
    let cancelled = false;
    fetchLatestDraftStatuses(products.map((p) => p.id))
      .then((statuses) => {
        if (!cancelled) setDraftStatuses(statuses);
      })
      .catch(() => {
        // Non-critical for the work queue — statuses just show as unknown (readiness-only
        // classification) rather than blocking the whole page.
        if (!cancelled) setDraftStatuses(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [products]);

  // Bugbot-caught: work-queue readiness/completion% used the raw hero_image_url column only, while
  // the selected product's own readiness/sticky-bar/Build Meter resolve hero via the media authority
  // (product_media rows win once any exist). A bulk, hero-only read (same table, filtered to just
  // the one type this affects) lets every queue row use the identical summarizeCatalogueMedia()
  // resolution, so queue metrics can never disagree with what the operator sees after selecting the
  // same product.
  const [bulkHeroMedia, setBulkHeroMedia] = useState<Map<string, CatalogueMediaRow[]>>(new Map());
  useEffect(() => {
    if (products.length === 0) {
      setBulkHeroMedia(new Map());
      return;
    }
    let cancelled = false;
    Promise.resolve(
      supabase
        .from("product_media")
        .select("id, product_id, type, file_url, status, created_at")
        .eq("type", "hero_image")
        .in("product_id", products.map((p) => p.id)),
    )
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setBulkHeroMedia(new Map());
          return;
        }
        const grouped = new Map<string, CatalogueMediaRow[]>();
        for (const row of data as (CatalogueMediaRow & { product_id: string })[]) {
          const list = grouped.get(row.product_id) ?? [];
          list.push(row);
          grouped.set(row.product_id, list);
        }
        setBulkHeroMedia(grouped);
      })
      .catch(() => {
        if (!cancelled) setBulkHeroMedia(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [products]);

  // Per-product work-queue classification for every loaded product (not just the selected one) —
  // readiness itself only reads fields already in the bulk `products` fetch, so this is cheap.
  const productWorkQueueInfo = useMemo(() => {
    const map = new Map<string, { readiness: ReadinessResult; status: WorkQueueStatus }>();
    for (const p of products) {
      const resolvedHeroUrl = summarizeCatalogueMedia(p, bulkHeroMedia.get(p.id) ?? []).heroUrl;
      const readiness = computeCatalogueProductReadiness({ ...p, hero_image_url: resolvedHeroUrl });
      const status = classifyWorkQueueStatus({
        readinessOverallLabel: readiness.overallLabel,
        draftStatus: draftStatuses.get(p.id) ?? null,
      });
      map.set(p.id, { readiness, status });
    }
    return map;
  }, [products, draftStatuses, bulkHeroMedia]);

  const recentProductIds = useMemo(() => new Set(recentProducts.map((r) => r.productId)), [recentProducts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = products;
    if (statusFilter === "recent") {
      list = list.filter((p) => recentProductIds.has(p.id));
    } else if (statusFilter !== "all") {
      list = list.filter((p) => productWorkQueueInfo.get(p.id)?.status === statusFilter);
    }
    if (!q) return list;
    return list.filter(
      (p) =>
        (p.product_name || "").toLowerCase().includes(q) ||
        (p.sku || "").toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q),
    );
  }, [products, search, statusFilter, recentProductIds, productWorkQueueInfo]);

  const selected = useMemo(() => products.find((p) => p.id === selectedId) || null, [products, selectedId]);
  // readiness/packagingCategories are computed further down, once mediaSummary (below) is
  // available — the hero-image readiness check must agree with the same media authority the
  // anchor and Media tab use (Bugbot-caught: computeCatalogueProductReadiness() previously only
  // ever saw the raw hero_image_url column, so a product could show "Hero image Present" in the
  // anchor while readiness/Build Meter still flagged hero as missing).

  // Editor state lives only in local component state until explicitly saved. Keyed by productId so a
  // product switch can never render or copy the previous product's drafts.
  const [editorState, setEditorState] = useState<EditorState | null>(null);

  const editor: EditorState | null = useMemo(() => {
    if (!selected) return null;
    if (editorState && editorState.productId === selected.id) return editorState;
    return generateEditorState(selected);
  }, [selected, editorState]);

  // Fresh-generated baseline for the "Edited" badge — always the pure output of the content
  // generator for the current product, independent of editorState, so a field is marked edited
  // the moment the operator's text diverges from what was originally generated (never from what
  // was last saved).
  const generatedBaseline: EditorState | null = useMemo(
    () => (selected ? generateEditorState(selected) : null),
    [selected],
  );

  const shortSku = useMemo(() => (selected?.sku ? deriveShortSku(selected.sku) : null), [selected?.sku]);
  // Bugbot-caught: this used to render saleTypeFromForm()'s raw internal slug (e.g. "b2b_horeca")
  // directly — always resolve it to a human label instead (see catalogueSaleTypeLabel.ts).
  const saleTypeLabel = useMemo(
    () => (selected ? saleTypeLabelFromForm(selected as unknown as Record<string, unknown>) : null),
    [selected],
  );

  const exportPreview = useMemo(() => {
    if (!selected || !editor) return "";
    return buildExportBundlePreview(selected, editor.content);
  }, [selected, editor]);

  const resetFromProduct = () => {
    if (!canResetDraft || !selected) return;
    setEditorState(generateEditorState(selected));
    // Bugbot-caught: this reload back to the local template used to leave the AI baseline/fields/
    // tone from a prior generation in place, so `activeBaseline` kept comparing against stale AI
    // content — clear it here too, exactly like the product-switch effect does.
    clearAiGeneration();
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

  // A4: ephemeral per-slot operator instruction for prompt composition — never persisted on its
  // own (only the composed text it produces is saved, into the same existing prompt column), so no
  // schema change. Reset on product switch so an instruction never leaks onto a different product.
  const [promptInstructions, setPromptInstructions] = useState<Partial<Record<CatalogueDraftPromptKey, string>>>({});
  useEffect(() => {
    setPromptInstructions({});
  }, [selected?.id]);

  const composePromptBlock = (key: CatalogueDraftPromptKey) => {
    if (!selected) return;
    const composed = composeCatalogueImagePrompt(selected, key, promptInstructions[key]);
    updatePromptBlock(key, composed);
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
        patchDraftStatus(productId, (row?.status as CatalogueDraftStatus | undefined) ?? null);
        if (row) {
          const mapped = mapRowToEditor(row);
          setEditorState({ productId, ...mapped });
          // Bugbot-caught: without this, reopening a previously AI-generated draft showed every
          // AI-filled field as falsely "Edited" (compared against the raw template instead of what
          // was actually loaded) and the next save would silently erase the saved provenance.
          const restored = restoreAiGenerationState(productId, mapped.content, mapped.prompts, row.source_snapshot);
          setAiGeneratedBaseline(restored?.baseline ?? null);
          setAiFieldTracking(restored?.tracking ?? null);
          setAiGeneratedTone(restored?.tone ?? null);
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

  // Read-only product_media lookup for the Media tab's hero/approved-media preview. A separate,
  // independent data source from the draft workflow above — same selectedIdRef guard so a slow
  // fetch started before a product switch can never paint media for the wrong product.
  //
  // mediaLoadState distinguishes loading / error / loaded (with isMediaResultEmpty() further
  // splitting "loaded" into has-media vs. a genuine empty result) — a Supabase failure can never
  // be silently presented as "no media" (Bugbot-adjacent correction requested by the owner).
  const [mediaLoadState, setMediaLoadState] = useState<MediaLoadState>(INITIAL_MEDIA_LOAD_STATE);
  // Bumped by the Retry button to re-run the fetch effect without duplicating its logic.
  const [mediaRetryToken, setMediaRetryToken] = useState(0);
  // Bugbot-caught: "Remove as hero" publishes { heroUrl: null, rows: unchanged } — it deliberately
  // leaves the still-approved hero_image row in product_media untouched (removeAsHero's own
  // comment: "the image stays in the gallery"), so re-deriving heroUrl from rows alone (as
  // mediaSummary below does) would immediately resurrect the cleared hero. Track the latest
  // *published* heroUrl for the current product separately and let it take precedence over the
  // rows-derived value, mirroring how ProductEdit.tsx applies result.heroUrl directly instead of
  // re-deriving it. Reset is implicit: gated on productId match, so switching products (or a fresh
  // page load that hasn't published anything yet) naturally falls back to the rows-derived value.
  const [publishedHeroOverride, setPublishedHeroOverride] = useState<{
    productId: string;
    heroUrl: string | null;
  } | null>(null);
  // Bugbot-caught: the useEffect below resets mediaLoadState on product switch, but effects run
  // after the render commits — for one painted frame, mediaSummary/anchor hero/readiness/required
  // slots would still read the PREVIOUS product's loaded rows against the newly selected product.
  // Resetting synchronously during render (React's documented pattern for keying derived state to
  // a changing value) means no stale frame is ever painted; the effect below still owns the actual
  // async fetch.
  const mediaLoadProductIdRef = useRef<string | null>(null);
  if (mediaLoadProductIdRef.current !== (selected?.id ?? null)) {
    mediaLoadProductIdRef.current = selected?.id ?? null;
    setMediaLoadState(mediaLoadStarted());
    // Bugbot-caught: publishedHeroOverride was previously only ever set by a LIVE
    // subscribeToProductMediaAuthority event received while this page was already mounted — a hero
    // change made earlier this session (e.g. via Full Editor's "Remove as hero", or an earlier visit
    // to a different product) was never consulted, so selecting that product here could still derive
    // a stale hero from rows alone. Seed synchronously (same render-time-reset pattern as
    // mediaLoadState above) from the same authorityByProduct cache getCachedProductMediaAuthority
    // already maintains and ProductMediaUploader's own passive-fetch effect already reads — no new
    // read path invented. Explicitly resets to null when nothing is cached for the new product, so a
    // previous product's override can never leak across a switch.
    const cachedAuthority = selected ? getCachedProductMediaAuthority(selected.id) : null;
    setPublishedHeroOverride(
      cachedAuthority ? { productId: cachedAuthority.productId, heroUrl: cachedAuthority.heroUrl } : null,
    );
  }
  useEffect(() => {
    const productId = selected?.id ?? null;
    // Reset immediately on every switch/retry (not just when no product is selected) — otherwise
    // the anchor/media-tab hero summary would briefly reflect the previous product's media (or a
    // stale error) while this fetch is in flight.
    setMediaLoadState(mediaLoadStarted());
    if (!productId) {
      return;
    }
    let cancelled = false;
    // Supabase's query builder returns a PromiseLike, not a full Promise (no .finally) — wrap it
    // so the state resolves on both the success and error paths without duplicating the guard.
    Promise.resolve(
      supabase.from("product_media").select("id, type, file_url, status, created_at").eq("product_id", productId),
    ).then(({ data, error: mediaError }) => {
      if (cancelled || selectedIdRef.current !== productId) return;
      if (mediaError) {
        // Never expose the raw backend error to the operator — log it for diagnosis only.
        if (import.meta.env.DEV) console.warn("[catalogue-studio-media]", mediaError.message);
        setMediaLoadState(mediaLoadFailed());
      } else {
        setMediaLoadState(mediaLoadSucceeded((data as CatalogueMediaRow[]) ?? []));
      }
    })
      // Bugbot-caught: the Supabase `{ error }` branch above only covers a resolved response —
      // an actual promise rejection (network abort, unexpected runtime failure) left mediaLoadState
      // stuck on "loading" forever with no error panel or retry path.
      .catch((err: unknown) => {
        if (cancelled || selectedIdRef.current !== productId) return;
        if (import.meta.env.DEV) console.warn("[catalogue-studio-media]", err);
        setMediaLoadState(mediaLoadFailed());
      });
    return () => {
      cancelled = true;
    };
  }, [selected?.id, mediaRetryToken]);

  const mediaRows = mediaLoadState.rows;
  const retryMediaLoad = () => setMediaRetryToken((n) => n + 1);

  // Root-cause architectural fix (replacing the mount-guard/callback-suppression patches from
  // earlier rounds): reconciliation of a committed product-media mutation must never depend on
  // ProductMediaUploader's own mount state — a closed Media tab does not retroactively invalidate
  // a write that already committed. This page subscribes to the ONE shared authority
  // (productMediaMutationAuthority.ts) for its own lifetime (not the uploader's), and applies a
  // published result directly to this page's own media state only when it matches whatever product
  // is currently selected — no retryMediaLoad()/refetch round trip needed, since the authority
  // module's reconciliation already re-read the fresh rows itself.
  useEffect(() => {
    return subscribeToProductMediaAuthority((result) => {
      if (result.productId !== selectedIdRef.current) return;
      setMediaLoadState(mediaLoadSucceeded(result.rows));
      // Bugbot-caught: this subscriber previously only applied result.rows, silently discarding
      // result.heroUrl — so a cleared hero (rows unchanged by design) never reached the sticky
      // bar/readiness/embedded uploader here, unlike ProductEdit.tsx which already applies both.
      setPublishedHeroOverride({ productId: result.productId, heroUrl: result.heroUrl });
    });
  }, []);

  // Bugbot-caught: while media is loading or a fetch failed, mediaRows is deliberately [] — passing
  // the raw `selected` product through unconditionally let summarizeCatalogueMedia's zero-rows
  // legacy-hero fallback fire during that window, so the anchor/Build Meter could show a hero as
  // "present" from the legacy column, then flip to "missing" once the real product_media rows load
  // and reveal no approved hero — contradicting the Media tab's own loading/error state. Hero is
  // only ever resolved (fallback included) once a load has genuinely completed.
  const mediaSummary = useMemo(() => {
    const base = summarizeCatalogueMedia(mediaLoadState.status === "loaded" ? selected : null, mediaRows);
    // Bugbot-caught: apply the latest published heroUrl (e.g. an explicit "Remove as hero" clear)
    // over the rows-derived value whenever it's for the currently selected product — see
    // publishedHeroOverride's declaration above for why rows alone can't be trusted for this.
    if (selected && publishedHeroOverride && publishedHeroOverride.productId === selected.id) {
      const heroUrl = publishedHeroOverride.heroUrl;
      return { ...base, heroUrl, approvedCount: base.approvedMedia.length + (heroUrl ? 1 : 0) };
    }
    return base;
  }, [selected, mediaRows, mediaLoadState.status, publishedHeroOverride]);


  // computeCatalogueProductReadiness()'s own hero check (buildHeroImage) is intentionally
  // untouched — it just needs an accurate hero_image_url to check. mediaSummary.heroUrl (the same
  // media-authority resolution the anchor/Media tab use) is fed in in place of the raw column, so
  // readiness/Build Meter can never disagree with what the operator sees elsewhere on this page.
  // Bugbot-caught: a `?? selected.hero_image_url` fallback here used to re-leak the legacy column
  // whenever mediaSummary.heroUrl was null — but that null is now a deliberate "no approved hero"
  // result (see catalogueMediaSummary.ts) whenever product_media rows exist, not a signal to fall
  // further back. mediaSummary.heroUrl already applies its own legacy fallback when there are zero
  // rows, so passing it through directly is correct in every case.
  const readiness: ReadinessResult | null = useMemo(
    () =>
      selected
        ? computeCatalogueProductReadiness({
            ...selected,
            hero_image_url: mediaSummary.heroUrl,
          })
        : null,
    [selected, mediaSummary.heroUrl],
  );
  const packagingCategories = useMemo(
    () => readiness?.categories.filter((c) => c.group === "packaging") ?? [],
    [readiness],
  );

  // Single "next action" for the sticky command bar — the highest-priority unmet readiness
  // category's own guidance, or a truthful all-clear once every category passes.
  const nextActionText = useMemo(() => {
    if (!readiness) return null;
    const blocker = readiness.categories.find((c) => c.state !== "pass");
    if (blocker) return blocker.nextAction ?? `Address: ${blocker.label}`;
    return "Product Truth complete — review content, media, and language, then submit for review.";
  }, [readiness]);

  // A3: once AI generation succeeds for this product, the "Edited" badge compares against the
  // AI-generated content instead of the local template — otherwise every AI-filled field would
  // immediately show as "Edited" just for differing from the template it replaced. Reset on
  // product switch so a stale AI baseline from a previous product is never possible.
  const [aiGeneratedBaseline, setAiGeneratedBaseline] = useState<EditorState | null>(null);
  const [aiFieldTracking, setAiFieldTracking] = useState<AiFieldTracking | null>(null);
  const [aiGeneratedTone, setAiGeneratedTone] = useState<CatalogueAiTone | null>(null);
  const [aiGenerationState, setAiGenerationState] = useState<"idle" | "generating" | "success" | "error">("idle");
  const [aiGenerationError, setAiGenerationError] = useState<string | null>(null);
  const [aiTone, setAiTone] = useState<CatalogueAiTone>("Informational");
  // Bugbot-caught: resetFromProduct cleared the AI baseline state, but an in-flight
  // generateCatalogueContentDraft() call from BEFORE the reset would still resolve and merge its
  // result afterward, undoing the reset. Every clearAiGeneration() call bumps this so
  // handleGenerateAiDraft can recognize its own request is no longer current and bail out instead
  // of applying a stale response.
  const aiGenerationRequestIdRef = useRef(0);
  const clearAiGeneration = () => {
    aiGenerationRequestIdRef.current += 1;
    setAiGeneratedBaseline(null);
    setAiFieldTracking(null);
    setAiGeneratedTone(null);
    setAiGenerationState("idle");
    setAiGenerationError(null);
  };
  useEffect(() => {
    clearAiGeneration();
  }, [selected?.id]);
  const activeBaseline: EditorState | null =
    aiGeneratedBaseline && selected && aiGeneratedBaseline.productId === selected.id
      ? aiGeneratedBaseline
      : generatedBaseline;

  const aiGenerationBlocked = isAiGenerationBlockedByIdentity(readiness);

  const handleGenerateAiDraft = async () => {
    if (!selected || !editor || aiGenerationBlocked) return;
    const productId = selected.id;
    const requestId = ++aiGenerationRequestIdRef.current;
    setAiGenerationState("generating");
    setAiGenerationError(null);
    const facts: CatalogueAiSourceFacts = {
      productName: selected.product_name || "Untitled product",
      category: selected.category,
      subcategory: selected.subcategory,
      packSize: selected.pack_size,
      saleTypeLabel,
      storageInstructions: selected.storage_instructions,
      shelfLifeDays: selected.shelf_life_days,
    };
    const result = await generateCatalogueContentDraft(facts, aiTone);
    if (selectedIdRef.current !== productId || aiGenerationRequestIdRef.current !== requestId) return;
    if (result.ok === false) {
      setAiGenerationState("error");
      setAiGenerationError(result.reason);
      return;
    }
    // Bugbot-caught: this used to merge into `editor.content` captured by closure at click time.
    // Fields stay editable while the request is in flight, so typing done during the await was
    // silently discarded by that stale snapshot. A functional update reads the *current* state at
    // merge time instead — including any edits made while waiting — and the `prev.productId`
    // check ignores a stale response if the operator has since switched products (belt-and-braces
    // alongside the `selectedIdRef` check above, which only catches the common case). The actual
    // field-by-field merge is the pure, unit-tested `mergeAiGeneratedContent`.
    //
    // Bugbot-caught: fields already known human-edited/preserved from a prior session (restored via
    // restoreAiGenerationState) must never be silently overwritten by a fresh regeneration just
    // because their loaded value happens to match the restored baseline — `lockedFields` excludes
    // them from `mergeAiGeneratedContent` unconditionally, regardless of that diff.
    const lockedFields = new Set([
      ...(aiFieldTracking?.lockedHumanEditedFields ?? []),
      ...(aiFieldTracking?.lockedPreservedFields ?? []),
    ]);
    let appliedFields: CatalogueDraftContentKey[] = [];
    let preservedCount = 0;
    let mergedState: EditorState | null = null;
    setEditorState((prev) => {
      if (!prev || prev.productId !== productId) return prev;
      const merge = mergeAiGeneratedContent(prev.content, result.content, activeBaseline?.content ?? null, lockedFields);
      appliedFields = merge.appliedFields;
      preservedCount = merge.preservedCount;
      mergedState = { productId, content: merge.content, prompts: prev.prompts };
      return mergedState;
    });
    if (!mergedState) {
      // Bugbot-caught: this branch is only reachable if the editor state moved out from under this
      // request between the guard above and this functional update — leaving aiGenerationState
      // stuck at "generating" forever would disable the button with no way to recover short of a
      // reset or product switch.
      setAiGenerationState("idle");
      return;
    }
    // Bugbot-caught: the baseline used to store the raw AI result for every key, including ones
    // preserved above because the operator had already edited them — comparing the final editor
    // against that raw baseline made preserved fields look "human-edited after generation" (as if
    // AI had written them first). Storing the merged state instead means a preserved field's
    // baseline exactly matches its current value. `advanceAiFieldTracking` folds this round's newly
    // applied fields into the watched set and graduates any newly-diverged watched field into the
    // locked human-edited set, so a field's history survives across generations, not just one round.
    setAiGeneratedBaseline(mergedState);
    setAiFieldTracking(advanceAiFieldTracking(aiFieldTracking, appliedFields));
    setAiGeneratedTone(aiTone);
    setAiGenerationState("success");
    if (preservedCount > 0) {
      toast.info(`AI draft applied — ${preservedCount} field(s) you'd already edited were left unchanged.`);
    } else {
      toast.success("AI draft generated. Review before saving.");
    }
  };

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

  // Owner-smoke-test finding: Export tab's "Copy bundle" must never hand out a rejected/incomplete
  // draft's buyer-facing text unguarded — only an APPROVED draft with no remaining missing-field
  // placeholder anywhere in its content is safe to copy externally. Read from `editor.content` (not
  // the raw persisted row) so this reacts to in-progress edits too, not just the last save.
  const exportBundleDistributable = useMemo(
    () =>
      editor
        ? isExportBundleDistributable(
            (currentPersistedDraft?.status as CatalogueDraftStatus | undefined) ?? null,
            editor.content,
          )
        : false,
    [editor, currentPersistedDraft?.status],
  );

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
          source_snapshot: buildSourceSnapshot(
            selected,
            resolveAiGenerationProvenance(
              editor,
              aiGeneratedBaseline,
              aiFieldTracking,
              aiGeneratedTone,
              currentPersistedDraft?.source_snapshot ?? null,
            ),
          ),
        },
        actorId: user?.id ?? null,
      });
      if (selectedIdRef.current !== productId) return;
      setPersistedDraft(row);
      patchDraftStatus(productId, row.status as CatalogueDraftStatus);
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
      patchDraftStatus(productId, row.status as CatalogueDraftStatus);
      const mapped = mapRowToEditor(row);
      setEditorState({ productId, ...mapped });
      const restored = restoreAiGenerationState(productId, mapped.content, mapped.prompts, row.source_snapshot);
      setAiGeneratedBaseline(restored?.baseline ?? null);
      setAiFieldTracking(restored?.tracking ?? null);
      setAiGeneratedTone(restored?.tone ?? null);
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
          source_snapshot: buildSourceSnapshot(
            selected,
            resolveAiGenerationProvenance(
              editor,
              aiGeneratedBaseline,
              aiFieldTracking,
              aiGeneratedTone,
              currentPersistedDraft?.source_snapshot ?? null,
            ),
          ),
        },
        actorId: user?.id ?? null,
      });
      if (selectedIdRef.current !== productId) return;
      const row = await submitDraftForReview(saved.id, user?.id ?? null);
      if (selectedIdRef.current !== productId) return;
      setPersistedDraft(row);
      patchDraftStatus(productId, row.status as CatalogueDraftStatus);
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
      patchDraftStatus(productId, row.status as CatalogueDraftStatus);
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
      patchDraftStatus(productId, row.status as CatalogueDraftStatus);
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

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-[11px] font-medium text-muted-foreground">
        <span className="flex items-center gap-1.5 text-foreground">
          <ShieldCheck size={13} className="shrink-0" />
          Governed draft workspace · Product Master is never changed here
        </span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-auto px-2 py-1 text-[11px]"
          onClick={() => setGovernanceExpanded((v) => !v)}
        >
          {governanceExpanded ? "Hide details" : "Learn more"}
        </Button>
      </div>

      {governanceExpanded && (
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
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">
        {selected && !queueExpanded ? (
          <Card>
            <CardContent className="pt-6 space-y-2">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Working on</p>
              <p className="text-xs font-semibold text-foreground truncate">{selected.product_name || "Untitled product"}</p>
              <p className="text-[10px] text-muted-foreground truncate">{selected.sku || "No SKU"}</p>
              <Button type="button" size="sm" variant="outline" className="w-full" onClick={() => setQueueExpanded(true)}>
                Change product
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Search size={14} /> Product work queue
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Search by name, SKU, or category…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="flex flex-wrap gap-1.5">
                {QUEUE_FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setStatusFilter(opt.key)}
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors ${
                      statusFilter === opt.key
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {recentProducts.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full justify-start gap-1.5 text-[11px]"
                  onClick={() => {
                    const last = lastOpenedProduct(recentProducts);
                    if (last) selectProduct(last.productId);
                  }}
                >
                  <Clock size={12} /> Continue Last Product
                </Button>
              )}
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
                  {products.length === 0 ? "No products in the catalogue yet." : "No products match this filter/search."}
                </p>
              ) : (
                <div className="max-h-[60vh] overflow-y-auto space-y-1">
                  {filtered.map((p) => {
                    const info = productWorkQueueInfo.get(p.id);
                    const blockerCount = info?.readiness.categories.filter((c) => c.state !== "pass").length ?? 0;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => selectProduct(p.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                          selectedId === p.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-semibold text-foreground truncate">{p.product_name || "Untitled product"}</div>
                          {info && (
                            <Badge variant="outline" className={`shrink-0 text-[8px] uppercase ${WORK_QUEUE_STATUS_BADGE_CLASS[info.status]}`}>
                              {WORK_QUEUE_STATUS_LABEL[info.status]}
                            </Badge>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {p.sku || "No SKU"} · {p.category || "No category"}
                        </div>
                        {info && (
                          <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span>{info.readiness.score}% complete</span>
                            {blockerCount > 0 && <span>· {blockerCount} blocker{blockerCount === 1 ? "" : "s"}</span>}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="space-y-5">
          {!selected ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Select a product from the list to see its catalogue summary and readiness score.
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Sticky product command bar. Product switching clears/reloads everything below it
                  (see the product-switch effect) — this bar itself never mixes fields from two
                  products because it only ever reads from `selected`. */}
              <div className="sticky top-2 z-20">
                <Card className="border-primary/30 shadow-sm">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex flex-wrap items-center gap-3">
                      {mediaSummary.heroUrl ? (
                        <img
                          src={mediaSummary.heroUrl}
                          alt=""
                          className="h-10 w-10 rounded-md object-cover border border-border shrink-0"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-md border border-dashed border-border flex items-center justify-center shrink-0">
                          <ImageIcon size={14} className="text-muted-foreground/40" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-semibold text-foreground truncate">
                            {selected.product_name || "Untitled product"}
                          </span>
                          {shortSku && <span className="text-[10px] text-muted-foreground">{shortSku}</span>}
                          {hasUnsavedChanges && (
                            <Badge variant="outline" className="text-[9px] uppercase bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-400/40">
                              <PencilLine size={10} className="mr-1" /> Unsaved
                            </Badge>
                          )}
                          {currentPersistedDraft && (
                            <Badge variant="outline" className={`text-[9px] uppercase ${DRAFT_STATUS_BADGE_CLASS[currentPersistedDraft.status as CatalogueDraftStatus]}`}>
                              {STATUS_LABEL[currentPersistedDraft.status as CatalogueDraftStatus]} · v{currentPersistedDraft.version_number}
                            </Badge>
                          )}
                          {readiness && (
                            <Badge className={OVERALL_BADGE_CLASS[readiness.overallLabel]}>{readiness.score}% complete</Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {selected.packaging_code || "No packaging"} · {saleTypeLabel ?? "No sale type"}
                        </p>
                        {nextActionText && (
                          <p className="text-[11px] text-foreground mt-0.5 truncate">
                            <span className="font-semibold">Next: </span>
                            {nextActionText}
                          </p>
                        )}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setAnchorDetailsExpanded((v) => !v)}
                        aria-label={anchorDetailsExpanded ? "Hide product details" : "Show product details"}
                      >
                        {anchorDetailsExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {anchorDetailsExpanded && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Product details</CardTitle>
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
                      <p className="text-[9px] font-semibold text-muted-foreground uppercase">Short SKU</p>
                      <p className="font-medium text-foreground">{shortSku || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold text-muted-foreground uppercase">Sale Type</p>
                      <p className="font-medium text-foreground">{saleTypeLabel ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold text-muted-foreground uppercase">Category</p>
                      <p className="font-medium text-foreground">{selected.category || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold text-muted-foreground uppercase">Packaging</p>
                      <p className="font-medium text-foreground">{selected.packaging_code || "—"}</p>
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
                          className={mediaSummary.heroUrl ? "text-emerald-600" : "text-muted-foreground/40"}
                        />
                        {mediaSummary.heroUrl ? "Present" : "Not set"}
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
                  <div className="mt-3">
                    <Button type="button" size="sm" variant="outline" onClick={() => nav(`/products/${selected.id}`)}>
                      Edit master data in Full Editor
                    </Button>
                  </div>
                </CardContent>
              </Card>
              )}

              {readiness && (
                <BuildMeterBar
                  score={readiness.score}
                  categories={readiness.categories}
                  onChipClick={(categoryKey) => nav(fullEditorDeepLink(selected.id, categoryKey))}
                />
              )}

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
                      <ReadinessRow
                        key={c.key}
                        category={c}
                        productId={selected.id}
                        onGoToFullEditor={(categoryKey) => nav(fullEditorDeepLink(selected.id, categoryKey))}
                      />
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
                      <button
                        type="button"
                        onClick={() => setAuditExpanded((v) => !v)}
                        className="flex w-full items-center justify-between gap-2 mb-1"
                      >
                        <span className="flex items-center gap-2">
                          <History size={14} className="text-muted-foreground" />
                          <span className="text-xs font-semibold text-foreground">
                            History / audit — v{currentPersistedDraft.version_number}
                            {auditLog.length > 0 && ` (${auditLog.length})`}
                          </span>
                        </span>
                        {auditExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      {auditExpanded && (
                      <>
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
                      </>
                      )}
                    </CardContent>
                  )}
                </Card>
              )}

              {editor && (
                <Card>
                  <CardContent className="pt-6">
                    {/* Five predictable stages (A2): the underlying tab values/content are unchanged
                        from the prior single-purpose tabs — only the sequence and step labeling are
                        new, so nothing about draft persistence or per-tab logic is touched here. */}
                    <Tabs value={studioTab} onValueChange={selectStudioTab}>
                      <TabsList className="flex-wrap h-auto">
                        <TabsTrigger value="packaging">1. Complete Truth</TabsTrigger>
                        <TabsTrigger value="content">2. Content</TabsTrigger>
                        <TabsTrigger value="language">
                          <Languages size={12} className="mr-1.5" /> 3. Languages &amp; Channels
                        </TabsTrigger>
                        <TabsTrigger value="media">4. Media</TabsTrigger>
                        <TabsTrigger value="export">5. Preview &amp; Approval</TabsTrigger>
                      </TabsList>

                      <TabsContent value="content" className="space-y-4 pt-4">
                        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[11px] text-muted-foreground">
                              Content below starts as a local template generated from this product's current
                              fields. "Generate Complete Catalogue Draft" instead drafts every content and
                              language field in one governed call to the AI service, based strictly on this
                              product's saved facts — it never invents price, ingredients, allergens, nutrition,
                              or compliance claims, and never overwrites fields you've already edited.
                            </p>
                            {/* Bugbot-caught (authenticated mobile smoke test): this row was a non-wrapping
                                flex container holding a fixed-width Select plus a long-label Button (Button's
                                own base styling is whitespace-nowrap, so the label itself never shrinks) —
                                on a narrow phone viewport neither item could give way, so the Button overflowed
                                past the right edge, its label clipped, and introduced horizontal page scroll.
                                flex-wrap plus full-width-until-sm sizing lets the tone selector and Generate
                                button stack cleanly on mobile while reverting to the original fixed-width,
                                side-by-side desktop/tablet layout at the sm breakpoint (640px+) unchanged. */}
                            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                              <Select
                                value={aiTone}
                                onValueChange={(v) => setAiTone(v as CatalogueAiTone)}
                                disabled={aiGenerationState === "generating"}
                              >
                                <SelectTrigger className="h-8 w-full sm:w-[140px] text-[11px]">
                                  <SelectValue placeholder="Tone" />
                                </SelectTrigger>
                                <SelectContent>
                                  {CATALOGUE_AI_TONES.map((tone) => (
                                    <SelectItem key={tone} value={tone} className="text-[11px]">
                                      {tone}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                type="button"
                                size="sm"
                                className="w-full sm:w-auto"
                                disabled={aiGenerationBlocked || aiGenerationState === "generating" || textLocked || draftLoading}
                                onClick={handleGenerateAiDraft}
                              >
                                {aiGenerationState === "generating" ? (
                                  <Loader2 size={12} className="mr-1.5 animate-spin" />
                                ) : (
                                  <Sparkles size={12} className="mr-1.5" />
                                )}
                                Generate Complete Catalogue Draft
                              </Button>
                            </div>
                          </div>
                          {aiGenerationBlocked && (
                            <p className="text-[10px] text-amber-700 dark:text-amber-400">
                              Complete Step 1 (Complete Truth) first — core product identity is missing.
                            </p>
                          )}
                          {aiGenerationState === "error" && aiGenerationError && (
                            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-[11px] text-destructive">
                              <AlertTriangle size={12} className="shrink-0" /> {aiGenerationError}
                            </div>
                          )}
                          {aiGenerationState === "success" && (
                            <p className="text-[10px] text-emerald-700 dark:text-emerald-400">
                              AI draft generated — review each field below before saving.
                            </p>
                          )}
                        </div>
                        {DRAFT_BLOCK_META.filter((block) => !isLanguageMessagingField(block.key)).map((block) => {
                          const blockIsMissing = isMissingFieldOnlyMessage(editor.content[block.key]);
                          const blockIsEdited =
                            !blockIsMissing &&
                            !!activeBaseline &&
                            isFieldEdited(editor.content[block.key], activeBaseline.content[block.key]);
                          return (
                            <div key={block.key} className="space-y-1.5">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                    {block.label}
                                    {blockIsEdited && (
                                      <Badge variant="outline" className="text-[9px] uppercase bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-400/40">
                                        Edited
                                      </Badge>
                                    )}
                                  </label>
                                  <p className="text-[10px] text-muted-foreground">
                                    {block.key === "whatsapp_product_message"
                                      ? "Draft message text only — approval workflow not active, this studio never sends WhatsApp messages."
                                      : block.hint}
                                  </p>
                                </div>
                                {!blockIsMissing && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    disabled={draftLoading}
                                    onClick={() => copyText(editor.content[block.key], block.label)}
                                  >
                                    <Copy size={12} className="mr-1.5" /> Copy
                                  </Button>
                                )}
                              </div>
                              <Textarea
                                value={editor.content[block.key]}
                                onChange={(e) => updateContentBlock(block.key, e.target.value)}
                                rows={block.key === "long_description" ? 4 : 2}
                                className={`text-xs ${blockIsMissing ? "border-amber-400/60 bg-amber-500/5 text-amber-800 dark:text-amber-300" : ""}`}
                                disabled={textLocked || draftLoading}
                              />
                            </div>
                          );
                        })}
                      </TabsContent>

                      <TabsContent value="language" className="space-y-4 pt-4">
                        <p className="text-[11px] text-muted-foreground">
                          Language content here (Hindi description, WhatsApp draft message) is informational only —
                          it never blocks catalogue readiness or Central Sync. WhatsApp approval workflow is not
                          active; this studio never sends WhatsApp messages. "Generate Complete Catalogue Draft" on
                          the Content step also fills these fields — the Hindi description is a genuine translation
                          drafted by the AI service, not a machine transliteration; review it before saving.
                        </p>
                        {(() => {
                          const languageBlocks = DRAFT_BLOCK_META.filter((block) => isLanguageMessagingField(block.key));
                          if (languageBlocks.length === 0) {
                            return (
                              <p className="text-xs text-muted-foreground py-2">
                                No language/messaging fields available for this product.
                              </p>
                            );
                          }
                          return languageBlocks.map((block) => {
                            const blockIsMissing = isMissingFieldOnlyMessage(editor.content[block.key]);
                            const blockIsEdited =
                              !blockIsMissing &&
                              !!activeBaseline &&
                              isFieldEdited(editor.content[block.key], activeBaseline.content[block.key]);
                            return (
                              <div key={block.key} className="space-y-1.5">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div>
                                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                      {block.label}
                                      {blockIsEdited && (
                                        <Badge variant="outline" className="text-[9px] uppercase bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-400/40">
                                          Edited
                                        </Badge>
                                      )}
                                    </label>
                                    <p className="text-[10px] text-muted-foreground">
                                      {block.key === "whatsapp_product_message"
                                        ? "Draft message text only — approval workflow not active, this studio never sends WhatsApp messages."
                                        : block.hint}
                                    </p>
                                  </div>
                                  {!blockIsMissing && (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      disabled={draftLoading}
                                      onClick={() => copyText(editor.content[block.key], block.label)}
                                    >
                                      <Copy size={12} className="mr-1.5" /> Copy
                                    </Button>
                                  )}
                                </div>
                                <Textarea
                                  value={editor.content[block.key]}
                                  onChange={(e) => updateContentBlock(block.key, e.target.value)}
                                  rows={2}
                                  className={`text-xs ${blockIsMissing ? "border-amber-400/60 bg-amber-500/5 text-amber-800 dark:text-amber-300" : ""}`}
                                  disabled={textLocked || draftLoading}
                                />
                              </div>
                            );
                          });
                        })()}
                      </TabsContent>

                      <TabsContent value="media" className="space-y-4 pt-4">
                        {mediaLoadState.status === "error" && (
                          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 space-y-2">
                            <p className="text-[11px] text-destructive">
                              {mediaLoadState.errorMessage} Readiness/Build Meter may be showing stale media status
                              until this is retried — the uploader below still reflects live data.
                            </p>
                            <Button type="button" size="sm" variant="outline" onClick={retryMediaLoad}>
                              <RefreshCw size={12} className="mr-1.5" /> Retry
                            </Button>
                          </div>
                        )}

                        {/* A4: the real, already-governed uploader (gallery/camera/URL, hero designation,
                            approval workflow) replaces the former read-only summary + deep-link-out to the
                            Full Editor. Same component Full Editor uses — same role-gated write mode
                            (direct write vs. submit-for-approval vs. read-only), same required-slot rules
                            (VITE_MEDIA_GOVERNANCE_MODE), same product_media/storage authority. Reconciliation
                            after a mutation now flows through the shared productMediaMutationAuthority
                            subscription set up above — not through callback props on this component — so it
                            stays correct regardless of this component's own mount state.

                            Bugbot-caught: currentHero is deliberately null while mediaLoadState.status is
                            "loading" (see mediaSummary above — hero is only ever resolved once this page's
                            own fetch has genuinely completed, to avoid a different, earlier flicker). If the
                            uploader mounted during that window, it could finish its own faster fetch first
                            and still receive currentHero={null}, so its auto-hero-on-upload path (which
                            treats a falsy currentHero as "no hero yet") could wrongly promote a fresh upload
                            over an approved hero that genuinely exists but this page hasn't confirmed yet.
                            Deferring the uploader's mount until loading is no longer in flight closes that
                            window; the existing error-state behavior (uploader still usable, with the
                            warning banner above) is intentionally left unchanged. */}
                        {mediaLoadState.status === "loading" ? (
                          <div className="rounded-lg border border-border bg-muted/20 p-4 text-[11px] text-muted-foreground flex items-center gap-2">
                            <Loader2 size={12} className="animate-spin" /> Loading media…
                          </div>
                        ) : (
                          <ProductMediaUploader
                            productId={selected.id}
                            productSku={selected.sku}
                            currentHero={mediaSummary.heroUrl}
                            variant={isTestingMediaGovernance() ? "hero-only" : "full"}
                          />
                        )}

                        <div className="rounded-lg border border-border bg-muted/30 p-2.5 text-[11px] text-muted-foreground">
                          AI image generation, enhancement, background removal, and vision-based product
                          analysis are not available in this studio — no such service is configured or wired
                          up (confirmed by inspection, not assumed). The prompts below are composed locally
                          from this product's own facts plus your optional instruction — text only, for use
                          with an external tool or a future governed generation connector; nothing here
                          generates, enhances, or auto-approves an image.
                        </div>

                        {IMAGE_PROMPT_BLOCK_META.map((block) => {
                          const blockIsMissing = isMissingFieldOnlyMessage(editor.prompts[block.key]);
                          const blockIsEdited =
                            !blockIsMissing &&
                            !!generatedBaseline &&
                            isFieldEdited(editor.prompts[block.key], generatedBaseline.prompts[block.key]);
                          return (
                            <div key={block.key} className="space-y-1.5">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                    {block.label}
                                    {blockIsEdited && (
                                      <Badge variant="outline" className="text-[9px] uppercase bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-400/40">
                                        Edited
                                      </Badge>
                                    )}
                                  </label>
                                  <p className="text-[10px] text-muted-foreground">{block.hint}</p>
                                </div>
                                {!blockIsMissing && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    disabled={draftLoading}
                                    onClick={() => copyText(editor.prompts[block.key], block.label)}
                                  >
                                    <Copy size={12} className="mr-1.5" /> Copy
                                  </Button>
                                )}
                              </div>
                              <Textarea
                                value={editor.prompts[block.key]}
                                onChange={(e) => updatePromptBlock(block.key, e.target.value)}
                                rows={2}
                                className={`text-xs ${blockIsMissing ? "border-amber-400/60 bg-amber-500/5 text-amber-800 dark:text-amber-300" : ""}`}
                                disabled={textLocked || draftLoading}
                              />
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Input
                                  value={promptInstructions[block.key] ?? ""}
                                  onChange={(e) =>
                                    setPromptInstructions((prev) => ({ ...prev, [block.key]: e.target.value }))
                                  }
                                  placeholder={'Optional instruction, e.g. "darker background"'}
                                  className="h-7 text-[11px] flex-1 min-w-[160px]"
                                  disabled={textLocked || draftLoading}
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[11px]"
                                  disabled={textLocked || draftLoading}
                                  onClick={() => composePromptBlock(block.key)}
                                >
                                  <Wand2 size={11} className="mr-1" /> Compose from Product Truth
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </TabsContent>

                      <TabsContent value="packaging" className="space-y-2 pt-4">
                        <p className="text-[11px] text-muted-foreground">
                          Read-only checklist derived from product fields — nothing here is editable or saved.
                        </p>
                        {packagingCategories.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2">No packaging data available.</p>
                        ) : (
                          packagingCategories.map((c) => (
                            <ReadinessRow
                              key={c.key}
                              category={c}
                              productId={selected.id}
                              onGoToFullEditor={(categoryKey) => nav(fullEditorDeepLink(selected.id, categoryKey))}
                            />
                          ))
                        )}
                      </TabsContent>

                      <TabsContent value="export" className="space-y-3 pt-4">
                        {/* Bugbot-caught (same mobile-overflow audit as the Content tab's Generate row):
                            this row had no flex-wrap, so the heading text plus button could not give way to
                            each other on a narrow phone viewport. flex-wrap lets the button drop to its own
                            line on mobile without affecting desktop/tablet, where both already fit on one row. */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                            <FileText size={14} /> Export / copy bundle preview
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={!exportBundleDistributable}
                            title={
                              exportBundleDistributable
                                ? undefined
                                : "Only an Approved draft with no missing-field placeholders can be copied for external use."
                            }
                            onClick={() => copyText(exportPreview, "Export bundle")}
                          >
                            <Copy size={12} className="mr-1.5" /> Copy bundle
                          </Button>
                        </div>
                        {!exportBundleDistributable && (
                          <div className="flex items-start gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-[11px] text-destructive">
                            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                            <span>
                              <strong>Internal review only — do not use externally.</strong> This draft is{" "}
                              {currentPersistedDraft
                                ? STATUS_LABEL[currentPersistedDraft.status as CatalogueDraftStatus]
                                : "not yet saved"}
                              , not Approved, and/or still has a missing-field placeholder in one of its blocks
                              (e.g. "Add missing field first: ..."). Copy is disabled until the draft is Approved
                              and every block is complete. If a field shown here as missing has since been set on
                              the product, this saved draft won't reflect it automatically — reset or regenerate
                              the draft to refresh it; historical rejected/approved content is never silently
                              rewritten.
                            </span>
                          </div>
                        )}
                        <p className="text-[11px] text-muted-foreground">
                          Text preview only — no PDF is generated in this studio.
                        </p>
                        {/* Bugbot-caught: disabling the Copy button alone doesn't stop an operator from
                            selecting and copying the same text directly out of the textarea, bypassing the
                            gate entirely. Suppress the actual bundle content, not just the button, whenever
                            it isn't distributable. */}
                        <Textarea
                          value={
                            exportBundleDistributable
                              ? exportPreview
                              : "Bundle text hidden — only an Approved draft with no missing-field placeholders can be previewed or copied for external use. See the warning above for what's blocking this draft."
                          }
                          readOnly
                          rows={16}
                          className="text-xs font-mono"
                        />
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
