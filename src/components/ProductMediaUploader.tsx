import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isSupersededById } from "@/features/productAuthority/requestRace";
import type { ProductMediaRow } from "@/features/mediaReadiness/mediaAssetsFromForm";
import {
  beginProductMediaOperation,
  fetchProductMediaRows,
  getCachedProductMediaAuthority,
  publishProductMediaAuthority,
  reconcileProductMediaAuthority,
  subscribeToProductMediaAuthority,
} from "@/features/productAuthority/productMediaMutationAuthority";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Camera,
  Upload,
  Star,
  StarOff,
  Trash2,
  Loader2,
  Link2,
  AlertTriangle,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  buildDirectMediaPath,
  buildStagingMediaPath,
  getMediaPublicUrl,
  submitMediaCatalogueDraft,
  uploadMediaFileToStorage,
  useCatalogueMediaWriteMode,
  type MediaOperationIntent,
} from "@/features/catalogueDrafts/mediaDraftBoundary";
import {
  formatMediaInsertError,
  formatMediaStorageError,
  insertProductMediaRow,
  mediaTypeLabel,
} from "@/features/productAuthority/productMediaPersistence";
import { heroUrlWritePayload } from "@/lib/productImage";
import {
  applyHeroDesignation,
  deriveHeroUrlFromMediaRows,
  deriveMediaStatusFromRows,
} from "@/features/mediaReadiness/mediaAuthorityContract";
import type { Role } from "@/lib/permissions";
import {
  getMediaGovernanceMode,
  GOVERNANCE_REQUIRED_UPLOADER_TYPES,
  RECOMMENDED_UPLOADER_TYPES,
} from "@/features/mediaReadiness/mediaGovernanceMode";
import { isTestingMediaGovernance } from "@/features/mediaReadiness/mediaGovernanceDisplay";

const MEDIA_TYPES = [
  "raw_photo",
  "hero_image",
  "white_background",
  "lifestyle",
  "closeup",
  "side_angle",
  "top_angle",
  "45_angle",
  "hamper_open",
  "hamper_closed",
  "video",
  "label_image",
  "source_pdf_page",
] as const;

type MediaType = (typeof MEDIA_TYPES)[number];

function requiredReadinessSlots(): MediaType[] {
  const mode = getMediaGovernanceMode();
  if (mode === "production") {
    return ["hero_image", "white_background", "closeup"];
  }
  return [...GOVERNANCE_REQUIRED_UPLOADER_TYPES[mode]] as MediaType[];
}

function recommendedReadinessSlots(): MediaType[] {
  const mode = getMediaGovernanceMode();
  if (mode === "production") return [];
  const required = new Set(requiredReadinessSlots());
  return RECOMMENDED_UPLOADER_TYPES.filter((t) =>
    MEDIA_TYPES.includes(t as MediaType) && !required.has(t as MediaType),
  ) as MediaType[];
}

const isRequiredSlot = (t: MediaType) => requiredReadinessSlots().includes(t);

const slotFilled = (media: any[], slot: MediaType) =>
  media.some((m) => m.type === slot && m.status === "approved");

interface Props {
  productId: string;
  productSku?: string | null;
  currentHero?: string | null;
  /** hero-only: compact hero upload for Status sidebar / testing governance */
  variant?: "full" | "hero-only";
}

const isPdfPage = (url?: string | null) => !!url && url.includes("/_pdf_pages/");

const MEDIA_DRAFT_SUCCESS =
  "Media change submitted for approval. Approved media will appear here after review.";

export function ProductMediaUploader({
  productId,
  productSku,
  currentHero,
  variant = "full",
}: Props) {
  const heroOnly = variant === "hero-only";
  const testingMode = isTestingMediaGovernance();
  const { roles } = useAuth();
  const { writeMode, canMutate } = useCatalogueMediaWriteMode(roles as Role[]);
  // `media` is a thin, passive mirror of the ONE shared product-media authority
  // (productMediaMutationAuthority.ts) — never a second, independently-drifting model. It is
  // populated by (a) an initial display fetch/cache-read below and (b) the subscription below,
  // which applies every reconciled result for this exact product regardless of this component's
  // own mount state at the time the underlying mutation committed.
  const [media, setMedia] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [type, setType] = useState<MediaType>("hero_image");
  const [urlInput, setUrlInput] = useState("");
  const [pendingNotices, setPendingNotices] = useState<string[]>([]);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const slotInputRef = useRef<HTMLInputElement>(null);
  const [slotUploadTarget, setSlotUploadTarget] = useState<MediaType | null>(null);

  const storageFolder = productSku || productId;

  // Used only to decide (a) whether a passive display read that resolves late is still worth
  // applying to this component's own local state, and (b) whether a product-specific success toast
  // would misleadingly describe whatever the UI now shows after the operator has moved on to a
  // different product. Neither of these gates reconciliation itself — see
  // productMediaMutationAuthority.ts's module doc for why a committed write must never be
  // suppressed merely because this component unmounted or moved on.
  const productIdRef = useRef(productId);
  productIdRef.current = productId;
  const isSupersededByProductSwitch = (requestProductId: string) =>
    isSupersededById(requestProductId, productIdRef.current);

  // Passive initial display fetch — a READ, so (per the lifecycle rules this module documents) it
  // may be safely ignored once superseded by a product switch. Prefers any already-reconciled
  // authority for this product over its own raw read, so a fetch that happens to resolve after a
  // mutation's own reconciliation never regresses the display back to pre-mutation data.
  useEffect(() => {
    let cancelled = false;
    const cached = getCachedProductMediaAuthority(productId);
    if (cached) setMedia(cached.rows);
    fetchProductMediaRows(productId)
      .then((rows) => {
        if (cancelled || isSupersededByProductSwitch(productId)) return;
        const stillCached = getCachedProductMediaAuthority(productId);
        setMedia(stillCached ? stillCached.rows : rows);
      })
      .catch(() => {
        // Passive display fetch only — a failure here just means the list may lag until the next
        // reconciled result publishes; no user-facing error surface existed for this before either.
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  // Mirrors the shared authority for the rest of this component's lifetime, independent of the
  // effect above — a committed mutation (this instance's own, or another instance's, e.g. Full
  // Editor's) always reaches every subscriber, never suppressed by any component's mount state.
  useEffect(() => {
    return subscribeToProductMediaAuthority((result) => {
      if (result.productId !== productIdRef.current) return;
      setMedia(result.rows);
    });
  }, []);

  /** Refreshes this component's own display only — used by draft-mode paths, which must never
   * write direct authority (that would bypass the approval workflow); no sequencing/publish.
   * Returns the fetched rows (or null on failure/supersede) so a caller can separately publish
   * them without a write — see publishDraftMediaAuthority below. */
  const refreshLocalMediaView = async (): Promise<ProductMediaRow[] | null> => {
    const requestProductId = productId;
    try {
      const rows = await fetchProductMediaRows(requestProductId);
      if (isSupersededByProductSwitch(requestProductId)) return null;
      setMedia(rows);
      return rows;
    } catch {
      // Best-effort passive refresh only, matching the pre-existing behavior this replaces.
      return null;
    }
  };

  // Bugbot-caught: draft-mode uploads only ever called refreshLocalMediaView (this component's own
  // local state), never reconcileProductMediaAuthority/publishProductMediaAuthority — so Catalogue
  // Studio's readiness/sticky media and Full Editor's productMediaRows/form (which now sync
  // exclusively via subscribeToProductMediaAuthority, per the architecture this PR introduced) never
  // learned about a submitted draft until an unrelated resync happened. Fixing this must NOT call
  // reconcileProductMediaAuthority — its repair step assumes direct-write authority, and even
  // without `repair: true` it still writes products.hero_image_url/media_status, which draft mode
  // must never do. Instead, derive heroUrl/mediaStatus the exact same *pure* way
  // syncProductMediaAuthority does (deriveHeroUrlFromMediaRows only ever considers approved rows, so
  // a new pending/raw row can never be surfaced as an approved hero) and publish that — no write.
  const publishDraftMediaAuthority = (
    requestProductId: string,
    operationId: number,
    rows: ProductMediaRow[],
  ) => {
    publishProductMediaAuthority(requestProductId, operationId, {
      heroUrl: deriveHeroUrlFromMediaRows(rows),
      mediaStatus: deriveMediaStatusFromRows(rows, { fallbackHeroUrl: null }),
      rows,
    });
  };

  const applyDirectHeroAuthority = async (url: string) => {
    const requestProductId = productId;
    const operationId = beginProductMediaOperation(requestProductId);
    await applyHeroDesignation(requestProductId, url);
    await reconcileProductMediaAuthority(requestProductId, operationId, {
      fallbackHeroUrl: url,
      repair: true,
    });
  };

  useEffect(() => {
    const required = requiredReadinessSlots();
    const nextMissing = required.find((slot) => !slotFilled(media, slot));
    if (nextMissing) setType(nextMissing);
    else if (!media.some((m) => m.type === "hero_image" || m.file_url === currentHero)) {
      setType("hero_image");
    }
  }, [media, currentHero]);

  const submitDraft = async (
    intent: MediaOperationIntent,
    fields: {
      fileUrl?: string | null;
      storagePath?: string | null;
      type?: string | null;
      angle?: string | null;
      altText?: string | null;
      status?: string | null;
      source?: string | null;
      requestedHero?: boolean;
    },
    targetRecordId?: string | null
  ) => {
    return submitMediaCatalogueDraft(
      intent,
      {
        productId,
        operationIntent: intent,
        fileUrl: fields.fileUrl,
        storagePath: fields.storagePath,
        type: fields.type,
        angle: fields.angle,
        altText: fields.altText,
        status: fields.status,
        source: fields.source,
        requestedHero: fields.requestedHero,
      },
      targetRecordId
    );
  };

  const persistMediaRow = async (
    file: File,
    url: string,
    mediaType: MediaType,
    status: string,
    asHero = false,
  ): Promise<boolean> => {
    const directApproved =
      writeMode !== "draft" && (isRequiredSlot(mediaType) || asHero);
    const insertRes = await insertProductMediaRow({
      product_id: productId,
      file_url: url,
      type: mediaType,
      angle: mediaType.includes("angle") || mediaType === "closeup" ? mediaType : null,
      alt_text: file.name,
      status: directApproved ? "approved" : status,
    });
    if (!insertRes.ok) {
      toast.error(insertRes.message);
      return false;
    }
    return true;
  };

  const uploadFileDirect = async (
    file: File,
    asHero = false,
    isVideo = false
  ): Promise<string | null> => {
    const path = buildDirectMediaPath(storageFolder, file.name);
    const { error: upErr } = await uploadMediaFileToStorage(path, file);
    if (upErr) {
      toast.error(formatMediaStorageError(upErr));
      return null;
    }
    const url = getMediaPublicUrl(path);
    const mediaType: MediaType = isVideo ? "video" : asHero ? "hero_image" : type;
    const saved = await persistMediaRow(
      file,
      url,
      mediaType,
      isRequiredSlot(mediaType) || asHero ? "approved" : "raw",
      asHero,
    );
    if (!saved) return null;
    return url;
  };

  const uploadFileDraft = async (
    file: File,
    intent: MediaOperationIntent,
    opts: {
      isVideo?: boolean;
      asHeroType?: boolean;
      targetRecordId?: string | null;
    } = {}
  ) => {
    const requestProductId = productId;
    const operationId = beginProductMediaOperation(requestProductId);
    const path = buildStagingMediaPath(storageFolder, file.name);
    const { error: upErr } = await uploadMediaFileToStorage(path, file);
    if (upErr) {
      toast.error(formatMediaStorageError(upErr));
      return false;
    }
    const url = getMediaPublicUrl(path);
    const mediaType = opts.isVideo ? "video" : opts.asHeroType ? "hero_image" : type;
    const saved = await persistMediaRow(
      file,
      url,
      mediaType as MediaType,
      "raw",
      opts.asHeroType,
    );
    if (!saved) return false;
    const res = await submitDraft(
      intent,
      {
        fileUrl: url,
        storagePath: path,
        type: mediaType,
        angle: type.includes("angle") || type === "closeup" ? type : null,
        altText: file.name,
        status: "raw",
        source: "upload",
        requestedHero:
          intent === "replace_hero" ||
          intent === "set_hero" ||
          (intent === "create" && opts.asHeroType),
      },
      opts.targetRecordId
    );
    if (!res.ok) {
      toast.error(res.message);
      const rows = await refreshLocalMediaView();
      if (rows) publishDraftMediaAuthority(requestProductId, operationId, rows);
      return false;
    }
    setPendingNotices((prev) => [
      ...prev,
      `${file.name} — submitted for approval (visible below until review)`,
    ]);
    const rows = await refreshLocalMediaView();
    if (rows) publishDraftMediaAuthority(requestProductId, operationId, rows);
    return true;
  };

  const uploadToSlot = async (files: FileList | null, slot: MediaType) => {
    if (!files?.length || !canMutate) return;
    setUploading(true);
    setType(slot);
    try {
      const asHero = slot === "hero_image";
      if (writeMode === "draft") {
        const ok = await uploadFileDraft(files[0], asHero ? "replace_hero" : "create", {
          asHeroType: asHero,
        });
        if (ok) toast.success(MEDIA_DRAFT_SUCCESS);
        return;
      }
      const requestProductId = productId;
      const operationId = beginProductMediaOperation(requestProductId);
      if (asHero && currentHero && isPdfPage(currentHero)) {
        await supabase
          .from("product_media")
          .update({ type: "source_pdf_page", status: "reference_only" })
          .eq("product_id", productId)
          .eq("file_url", currentHero);
      }
      const url = await uploadFileDirect(files[0], asHero, false);
      if (url && asHero) {
        // Bugbot-caught: the file/row already committed via uploadFileDirect above. If
        // applyDirectHeroAuthority's reconciliation throws (network/DB error), the old per-instance
        // load() refresh this replaced is gone, and reconcileProductMediaAuthority never publishes to
        // subscribers — so the gallery could show stale data indefinitely with no user-facing signal
        // that the already-saved file isn't reflected yet. Fall back to the same passive
        // refreshLocalMediaView() the draft-mode path already uses, and say so.
        try {
          await applyDirectHeroAuthority(url);
          // Bugbot-caught: applyDirectHeroAuthority already silently no-ops once the operator has
          // switched products mid-request, but this toast still fired unconditionally — misleadingly
          // implying the hero designation applied to whatever product is on screen now, when it may
          // have applied to the previous one instead. A bare Media-tab close (no product switch)
          // does not make this toast untrue, so only the product-switch check gates it.
          if (!isSupersededByProductSwitch(requestProductId)) toast.success("Hero image uploaded");
        } catch {
          await refreshLocalMediaView();
          if (!isSupersededByProductSwitch(requestProductId)) {
            toast.error("Hero image saved, but syncing the gallery failed — refreshed with a best-effort read instead.");
          }
        }
      } else if (url) {
        try {
          await reconcileProductMediaAuthority(requestProductId, operationId);
          if (!isSupersededByProductSwitch(requestProductId)) {
            toast.success(`${mediaTypeLabel(slot)} uploaded`);
          }
        } catch {
          await refreshLocalMediaView();
          if (!isSupersededByProductSwitch(requestProductId)) {
            toast.error(`${mediaTypeLabel(slot)} saved, but syncing the gallery failed — refreshed with a best-effort read instead.`);
          }
        }
      }
    } finally {
      setUploading(false);
      if (slotInputRef.current) slotInputRef.current.value = "";
      setSlotUploadTarget(null);
    }
  };

  const upload = async (files: FileList | null, isVideo = false) => {
    if (!files || files.length === 0 || !canMutate) return;
    setUploading(true);
    let lastUrl = "";
    try {
      if (writeMode === "draft") {
        let submitted = 0;
        for (const file of Array.from(files)) {
          const ok = await uploadFileDraft(file, "create", { isVideo });
          if (ok) submitted += 1;
        }
        if (submitted > 0) {
          toast.success(
            `${submitted} media submission${submitted === 1 ? "" : "s"} uploaded and submitted for approval.`
          );
          await refreshLocalMediaView();
        }
        return;
      }

      const requestProductId = productId;
      const operationId = beginProductMediaOperation(requestProductId);
      for (const file of Array.from(files)) {
        const url = await uploadFileDirect(file, false, isVideo);
        if (url) lastUrl = url;
      }
      // Bugbot-caught: same gap as uploadToSlot above — the file(s) already committed via
      // uploadFileDirect. If the reconciliation call below throws, fall back to the same
      // best-effort refreshLocalMediaView() the draft-mode path already uses, instead of leaving
      // the gallery stale with no signal.
      try {
        if (!isVideo && (!currentHero || isPdfPage(currentHero)) && lastUrl) {
          await applyDirectHeroAuthority(lastUrl);
        } else {
          await reconcileProductMediaAuthority(requestProductId, operationId);
        }
        if (!isSupersededByProductSwitch(requestProductId)) {
          toast.success(`${files.length} file(s) uploaded`);
        }
      } catch {
        await refreshLocalMediaView();
        if (!isSupersededByProductSwitch(requestProductId)) {
          toast.error(`${files.length} file(s) saved, but syncing the gallery failed — refreshed with a best-effort read instead.`);
        }
      }
    } finally {
      setUploading(false);
      if (galleryRef.current) galleryRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
      if (videoRef.current) videoRef.current.value = "";
    }
  };

  const setAsHeroDirect = async (url: string) => {
    await applyDirectHeroAuthority(url);
  };

  const setAsHero = async (m: any) => {
    if (!canMutate || uploading) return;

    if (writeMode === "draft") {
      setUploading(true);
      try {
        const res = await submitDraft(
          "set_hero",
          {
            fileUrl: m.file_url,
            type: m.type,
            angle: m.angle,
            altText: m.alt_text,
            status: m.status,
            source: m.source ?? "gallery",
            requestedHero: true,
          },
          m.id
        );
        if (!res.ok) {
          toast.error(res.message);
          return;
        }
        toast.success(MEDIA_DRAFT_SUCCESS);
      } finally {
        setUploading(false);
      }
      return;
    }

    const requestProductId = productId;
    await setAsHeroDirect(m.file_url);
    // Bugbot-caught: same reasoning as uploadToSlot's hero-upload toast above — suppress only once
    // the operator has moved on to a different product since this click started, not merely for
    // closing the Media tab.
    if (!isSupersededByProductSwitch(requestProductId)) toast.success("Set as hero photo");
  };

  const removeAsHero = async () => {
    if (!canMutate || uploading) return;
    if (!confirm("Remove this image as the hero photo? The image stays in the gallery.")) return;

    if (writeMode === "draft") {
      setUploading(true);
      try {
        const heroRow = media.find((m) => m.file_url === currentHero);
        const res = await submitDraft(
          "clear_hero",
          {
            fileUrl: currentHero ?? null,
            type: heroRow?.type ?? null,
            requestedHero: false,
          },
          heroRow?.id ?? null
        );
        if (!res.ok) {
          toast.error(res.message);
          return;
        }
        toast.success(MEDIA_DRAFT_SUCCESS);
      } finally {
        setUploading(false);
      }
      return;
    }

    const requestProductId = productId;
    const operationId = beginProductMediaOperation(requestProductId);
    const { error } = await supabase
      .from("products")
      .update(heroUrlWritePayload(null))
      .eq("id", productId);
    if (error) return toast.error(error.message);
    // This mutation only overrides the `products.hero_image_url` column — it deliberately leaves
    // the underlying product_media row untouched ("the image stays in the gallery"), so a fresh
    // re-derive-from-rows (reconcileProductMediaAuthority) would immediately resurrect the old
    // hero from that still-approved row. publishProductMediaAuthority instead propagates exactly
    // what this write actually did (heroUrl: null, rows unchanged), while still going through the
    // same per-product sequencing guarantee against out-of-order completions.
    publishProductMediaAuthority(requestProductId, operationId, {
      heroUrl: null,
      mediaStatus: deriveMediaStatusFromRows(media, { fallbackHeroUrl: null }),
      rows: media,
    });
    // Bugbot-caught: the mutation itself always targets the product this click was for, so it
    // genuinely succeeded — but if the operator has since switched to a different product, a
    // "Hero cleared" toast shown against the *new* product's UI would misleadingly read as if it
    // applied to what's on screen right now.
    if (!isSupersededByProductSwitch(requestProductId)) toast.success("Hero cleared");
  };

  const remove = async (m: any) => {
    if (!canMutate || uploading) return;
    if (!confirm("Delete this photo permanently?")) return;

    if (writeMode === "draft") {
      setUploading(true);
      try {
        const res = await submitDraft(
          "delete_request",
          {
            fileUrl: m.file_url,
            type: m.type,
            angle: m.angle,
            altText: m.alt_text,
            status: m.status,
            source: m.source ?? null,
          },
          m.id
        );
        if (!res.ok) {
          toast.error(res.message);
          return;
        }
        toast.success(
          "Delete request submitted for approval. This media stays visible until review."
        );
      } finally {
        setUploading(false);
      }
      return;
    }

    const requestProductId = productId;
    const operationId = beginProductMediaOperation(requestProductId);
    const { error } = await supabase.from("product_media").delete().eq("id", m.id);
    if (error) return toast.error(error.message);
    if (m.file_url === currentHero) {
      // Unlike removeAsHero, the row is genuinely gone now — re-deriving hero from what's actually
      // left in product_media (reconcileProductMediaAuthority) is correct here, not a resurrection
      // risk, and also correctly promotes an older approved hero row if one exists.
      await supabase.from("products").update(heroUrlWritePayload(null)).eq("id", productId);
    }
    await reconcileProductMediaAuthority(requestProductId, operationId);
    // Bugbot-caught: same reasoning as removeAsHero above — suppress the "Photo deleted" toast
    // only once the operator has moved on to a different product, so a success message never
    // appears to describe whatever the UI happens to show right now.
    if (!isSupersededByProductSwitch(requestProductId)) toast.success("Photo deleted");
  };

  const normalizeImageUrl = (raw: string): { url: string; warning?: string } => {
    const u = raw.trim();
    const driveFile = u.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    const driveOpen = u.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (u.includes("drive.google.com") || u.includes("googleusercontent.com")) {
      const id = driveFile?.[1] || driveOpen?.[1];
      if (id) {
        return {
          url: `https://lh3.googleusercontent.com/d/${id}=w1600`,
          warning:
            "Google Drive links can be unreliable. If the image fails to load, please upload the file directly instead.",
        };
      }
    }
    return { url: u };
  };

  const looksLikeImageUrl = (u: string) =>
    /\.(jpg|jpeg|png|webp|gif|avif|svg)(\?.*)?$/i.test(u) ||
    /supabase\.co\/storage/.test(u) ||
    /images\.unsplash\.com|cdn\.shopify\.com|imgix\.net|cloudinary\.com|imagekit\.io/.test(u);

  const addFromUrl = async () => {
    if (!canMutate || uploading) return;
    const raw = urlInput.trim();
    if (!raw) return toast.error("URL is required");
    if (!/^https?:\/\//i.test(raw)) return toast.error("URL must start with http:// or https://");
    const { url, warning } = normalizeImageUrl(raw);
    if (warning) toast.warning(warning);
    if (!looksLikeImageUrl(url) && !url.includes("drive.google.com")) {
      toast.warning(
        "This URL may not be a direct image link. Please use a direct image URL ending in .jpg, .jpeg, .png, .webp, or upload from gallery."
      );
    }

    if (writeMode === "draft") {
      setUploading(true);
      try {
        const wantsHero = !currentHero || isPdfPage(currentHero);
        const insertRes = await insertProductMediaRow({
          product_id: productId,
          file_url: url,
          type,
          status: "raw",
          alt_text: "url_import",
        });
        if (!insertRes.ok) {
          toast.error(insertRes.message);
          return;
        }
        const res = await submitDraft("url_import", {
          fileUrl: url,
          type,
          status: "raw",
          altText: "url_import",
          source: "url_import",
          requestedHero: wantsHero,
        });
        if (!res.ok) {
          toast.error(res.message);
          await refreshLocalMediaView();
          return;
        }
        setUrlInput("");
        setPendingNotices((prev) => [
          ...prev,
          `URL import — submitted for approval (visible below until review)`,
        ]);
        toast.success(MEDIA_DRAFT_SUCCESS);
        await refreshLocalMediaView();
      } finally {
        setUploading(false);
      }
      return;
    }

    const requestProductId = productId;
    const operationId = beginProductMediaOperation(requestProductId);
    const insertRes = await insertProductMediaRow({
      product_id: productId,
      file_url: url,
      type,
      status: writeMode !== "draft" && isRequiredSlot(type) ? "approved" : "raw",
      alt_text: "url_import",
    });

    if (!insertRes.ok) {
      if (import.meta.env.DEV) console.error("[media-url-add]", insertRes.error, url);
      return toast.error(insertRes.message);
    }
    setUrlInput("");
    if (!currentHero || isPdfPage(currentHero)) {
      await applyDirectHeroAuthority(url);
    } else {
      await reconcileProductMediaAuthority(requestProductId, operationId);
    }
    if (!isSupersededByProductSwitch(requestProductId)) toast.success("Image added from URL");
  };

  const heroIsPdf = isPdfPage(currentHero);

  return (
    <div className="card-elevated p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-xl">{heroOnly || testingMode ? "Hero image" : "Media"}</h3>
          <div className="text-xs text-muted-foreground">
            {writeMode === "readonly"
              ? "View only — you cannot upload or change media."
              : heroOnly || testingMode
                ? "Upload or replace the approved hero image for catalogue readiness."
                : "Upload from gallery or take a photo."}
          </div>
          {writeMode === "draft" && (
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              Media changes are submitted for approval. Approved media will appear here after
              review.
            </p>
          )}
        </div>
      </div>

      {writeMode === "draft" && pendingNotices.length > 0 && (
        <div className="rounded-md border border-dashed bg-muted/20 p-3 space-y-1">
          <div className="text-xs font-medium">Pending approval (not live)</div>
          {pendingNotices.map((notice, index) => (
            <div key={`${notice}-${index}`} className="text-[11px] text-muted-foreground">
              {notice}
            </div>
          ))}
        </div>
      )}

      {heroIsPdf && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 mt-0.5 text-warning shrink-0" />
          <div className="min-w-0">
            <div className="font-medium">Source PDF page image — not a final product photo</div>
            <div className="text-xs text-muted-foreground break-all">
              Replace it with a real product photo to publish.
            </div>
          </div>
        </div>
      )}

      {canMutate && (
        <div className="space-y-3">
          {!heroOnly && !testingMode && (
            <div className="text-sm font-medium">Required for readiness</div>
          )}
          {(heroOnly || testingMode) && currentHero && !heroIsPdf && (
            <div className="rounded-lg border overflow-hidden">
              <img src={currentHero} alt="Hero" className="w-full max-h-40 object-cover" />
            </div>
          )}
          <div className={`grid gap-2 ${heroOnly || testingMode ? "grid-cols-1 sm:grid-cols-2" : "sm:grid-cols-3"}`}>
            {(heroOnly || testingMode ? (["hero_image"] as MediaType[]) : requiredReadinessSlots()).map((slot) => {
              const filled = slotFilled(media, slot);
              return (
                <div key={slot} className="rounded-lg border p-3 space-y-2 bg-muted/20">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium">{mediaTypeLabel(slot)}</span>
                    <Badge variant={filled ? "default" : "outline"} className="text-[10px]">
                      {filled ? "approved" : "missing"}
                    </Badge>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={filled ? "outline" : "default"}
                    disabled={uploading}
                    className="w-full"
                    onClick={() => {
                      setSlotUploadTarget(slot);
                      slotInputRef.current?.click();
                    }}
                  >
                    {uploading && slotUploadTarget === slot ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5 mr-1" />
                    )}
                    {filled ? "Replace" : "Upload"}
                  </Button>
                </div>
              );
            })}
          </div>
          {!heroOnly && !testingMode && recommendedReadinessSlots().length > 0 && (
            <>
              <div className="text-sm font-medium text-muted-foreground">Recommended assets</div>
              <p className="text-[11px] text-muted-foreground">
                Optional until pilot signoff — do not block catalogue or Central sync.
              </p>
              <div className="grid sm:grid-cols-3 gap-2">
                {recommendedReadinessSlots().slice(0, 6).map((slot) => {
                  const filled = slotFilled(media, slot);
                  return (
                    <div key={slot} className="rounded-lg border border-dashed p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium">{mediaTypeLabel(slot)}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {filled ? "uploaded" : "recommended"}
                        </Badge>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={uploading}
                        className="w-full"
                        onClick={() => {
                          setSlotUploadTarget(slot);
                          slotInputRef.current?.click();
                        }}
                      >
                        {uploading && slotUploadTarget === slot ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                        ) : (
                          <Upload className="h-3.5 w-3.5 mr-1" />
                        )}
                        Upload
                      </Button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          <input
            ref={slotInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              if (slotUploadTarget) void uploadToSlot(e.target.files, slotUploadTarget);
            }}
          />
        </div>
      )}

      {canMutate && !heroOnly && !testingMode && (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Additional media type</Label>
            <select
              className="w-full h-10 px-3 rounded-md border bg-background text-sm mt-1 disabled:opacity-50"
              value={type}
              disabled={uploading}
              onChange={(e) => setType(e.target.value as MediaType)}
            >
              {MEDIA_TYPES.filter((t) => t !== "video").map((t) => (
                <option key={t} value={t}>
                  {mediaTypeLabel(t)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={uploading}
              onClick={() => galleryRef.current?.click()}
              className="w-full"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Gallery
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={uploading}
              onClick={() => cameraRef.current?.click()}
              className="w-full"
            >
              <Camera className="h-4 w-4 mr-2" /> Camera
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={uploading}
              onClick={() => videoRef.current?.click()}
              className="w-full"
            >
              <Video className="h-4 w-4 mr-2" /> Video
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={urlInput}
              disabled={uploading}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Paste image URL (advanced)"
            />
            <Button
              type="button"
              variant="outline"
              onClick={addFromUrl}
              disabled={!urlInput.trim() || uploading}
            >
              <Link2 className="h-4 w-4 mr-2" /> Add URL
            </Button>
          </div>
        </div>
      )}

      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple={!(heroOnly || testingMode)}
        hidden
        onChange={(e) => {
          if (heroOnly || testingMode) {
            void uploadToSlot(e.target.files, "hero_image");
          } else {
            void upload(e.target.files);
          }
          if (galleryRef.current) galleryRef.current.value = "";
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          if (heroOnly || testingMode) {
            void uploadToSlot(e.target.files, "hero_image");
          } else {
            void upload(e.target.files);
          }
          if (cameraRef.current) cameraRef.current.value = "";
        }}
      />
      <input
        ref={videoRef}
        type="file"
        accept="video/*"
        hidden
        onChange={(e) => upload(e.target.files, true)}
      />

      {(heroOnly || testingMode) && canMutate && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={uploading}
            onClick={() => galleryRef.current?.click()}
            className="w-full"
          >
            <Upload className="h-4 w-4 mr-2" /> From gallery
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={uploading}
            onClick={() => cameraRef.current?.click()}
            className="w-full"
          >
            <Camera className="h-4 w-4 mr-2" /> Take photo
          </Button>
        </div>
      )}

      {!heroOnly && !testingMode && media.length === 0 ? (
        <div className="text-sm text-muted-foreground border border-dashed rounded-lg py-8 text-center">
          No media yet. Upload a product photo to get started.
        </div>
      ) : !heroOnly && !testingMode ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {media.map((m) => {
            const isHero = m.file_url === currentHero;
            const pdf =
              isPdfPage(m.file_url) || m.type === "source_pdf_page" || m.status === "reference_only";
            return (
              <div key={m.id} className="relative group rounded-lg overflow-hidden border bg-muted">
                <div className="aspect-square relative bg-muted">
                  {m.type === "video" ? (
                    <video src={m.file_url} className="w-full h-full object-cover" controls />
                  ) : (
                    <img
                      src={m.file_url}
                      alt={m.alt_text || ""}
                      className={`w-full h-full object-cover ${pdf && !isHero ? "opacity-70" : ""}`}
                      onError={(e) => {
                        const img = e.currentTarget;
                        img.style.display = "none";
                        const parent = img.parentElement;
                        if (parent && !parent.querySelector(".broken-fallback")) {
                          const div = document.createElement("div");
                          div.className =
                            "broken-fallback absolute inset-0 flex flex-col items-center justify-center text-[10px] text-muted-foreground p-2 text-center";
                          div.innerHTML =
                            '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15l-5-5L5 21"/><rect x="3" y="3" width="18" height="18" rx="2"/></svg><div class="mt-1">Image failed to load</div>';
                          parent.appendChild(div);
                        }
                        if (import.meta.env.DEV) console.warn("[media-load-fail]", m.file_url);
                      }}
                    />
                  )}
                </div>
                <div className="absolute top-1 left-1 right-1 flex flex-wrap gap-1">
                  <span className="text-[10px] bg-background/90 px-1.5 py-0.5 rounded">
                    {mediaTypeLabel(m.type)}
                  </span>
                  {isHero && (
                    <Badge variant="default" className="text-[10px] h-5 px-1.5">
                      <Star className="h-2.5 w-2.5 mr-0.5" />
                      Hero
                    </Badge>
                  )}
                  {pdf && (
                    <span className="text-[10px] bg-warning/90 text-warning-foreground px-1.5 py-0.5 rounded">
                      PDF page
                    </span>
                  )}
                </div>
                {canMutate && (
                  <div className="absolute bottom-1 right-1 flex gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition">
                    {m.type !== "video" && !isHero && (
                      <button
                        type="button"
                        disabled={uploading}
                        onClick={() => setAsHero(m)}
                        className="bg-background/90 hover:bg-background rounded p-1.5 disabled:opacity-50"
                        title="Set as hero"
                      >
                        <Star className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {isHero && (
                      <button
                        type="button"
                        disabled={uploading}
                        onClick={removeAsHero}
                        className="bg-background/90 hover:bg-background rounded p-1.5 disabled:opacity-50"
                        title="Remove as hero"
                      >
                        <StarOff className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => remove(m)}
                      className="bg-background/90 hover:bg-destructive hover:text-destructive-foreground rounded p-1.5 disabled:opacity-50"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
