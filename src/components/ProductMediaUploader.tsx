import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  RefreshCw,
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
import type { Role } from "@/lib/permissions";

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

interface Props {
  productId: string;
  productSku?: string | null;
  currentHero?: string | null;
  onHeroChange?: (url: string | null) => void;
  onMediaChange?: () => void;
}

const isPdfPage = (url?: string | null) => !!url && url.includes("/_pdf_pages/");

const MEDIA_DRAFT_SUCCESS =
  "Media change submitted for approval. Approved media will appear here after review.";

export function ProductMediaUploader({
  productId,
  productSku,
  currentHero,
  onHeroChange,
  onMediaChange,
}: Props) {
  const { roles } = useAuth();
  const { writeMode, canMutate } = useCatalogueMediaWriteMode(roles as Role[]);
  const [media, setMedia] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [type, setType] = useState<MediaType>("raw_photo");
  const [urlInput, setUrlInput] = useState("");
  const [pendingNotices, setPendingNotices] = useState<string[]>([]);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const replaceCamRef = useRef<HTMLInputElement>(null);

  const storageFolder = productSku || productId;

  const load = async () => {
    const { data } = await supabase
      .from("product_media")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });
    setMedia(data ?? []);
    onMediaChange?.();
  };

  useEffect(() => {
    if (productId) load();
  }, [productId]);

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
    const insertRes = await insertProductMediaRow({
      product_id: productId,
      file_url: url,
      type: mediaType,
      angle: type.includes("angle") || type === "closeup" ? type : null,
      alt_text: file.name,
      status: asHero ? "approved" : status,
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
    const saved = await persistMediaRow(file, url, mediaType, asHero ? "approved" : "raw", asHero);
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
      await load();
      return false;
    }
    setPendingNotices((prev) => [
      ...prev,
      `${file.name} — submitted for approval (visible below until review)`,
    ]);
    await load();
    return true;
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
          await load();
        }
        return;
      }

      for (const file of Array.from(files)) {
        const url = await uploadFileDirect(file, false, isVideo);
        if (url) lastUrl = url;
      }
      toast.success(`${files.length} file(s) uploaded`);
      await load();
      if (!isVideo && (!currentHero || isPdfPage(currentHero)) && lastUrl) {
        await setAsHeroDirect(lastUrl);
      }
    } finally {
      setUploading(false);
      if (galleryRef.current) galleryRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
      if (videoRef.current) videoRef.current.value = "";
    }
  };

  const replaceHero = async (files: FileList | null) => {
    if (!files || files.length === 0 || !canMutate) return;
    setUploading(true);
    try {
      if (writeMode === "draft") {
        const existingHeroRow = media.find((m) => m.file_url === currentHero);
        const ok = await uploadFileDraft(files[0], "replace_hero", {
          targetRecordId: existingHeroRow?.id ?? null,
        });
        if (ok) toast.success(MEDIA_DRAFT_SUCCESS);
        return;
      }

      if (currentHero && isPdfPage(currentHero)) {
        await supabase
          .from("product_media")
          .update({ type: "source_pdf_page", status: "reference_only" })
          .eq("product_id", productId)
          .eq("file_url", currentHero);
      }
      const url = await uploadFileDirect(files[0], true, false);
      if (url) {
        await setAsHeroDirect(url);
        toast.success("Hero photo replaced");
      }
      await load();
    } finally {
      setUploading(false);
      if (replaceRef.current) replaceRef.current.value = "";
      if (replaceCamRef.current) replaceCamRef.current.value = "";
    }
  };

  const setAsHeroDirect = async (url: string) => {
    const { error } = await supabase
      .from("products")
      .update(heroUrlWritePayload(url))
      .eq("id", productId);
    if (error) return toast.error(error.message);
    onHeroChange?.(url);
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

    await setAsHeroDirect(m.file_url);
    toast.success("Set as hero photo");
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

    const { error } = await supabase
      .from("products")
      .update(heroUrlWritePayload(null))
      .eq("id", productId);
    if (error) return toast.error(error.message);
    onHeroChange?.(null);
    toast.success("Hero cleared");
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

    const { error } = await supabase.from("product_media").delete().eq("id", m.id);
    if (error) return toast.error(error.message);
    if (m.file_url === currentHero) {
      await supabase.from("products").update(heroUrlWritePayload(null)).eq("id", productId);
      onHeroChange?.(null);
    }
    toast.success("Photo deleted");
    await load();
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
          await load();
          return;
        }
        setUrlInput("");
        setPendingNotices((prev) => [
          ...prev,
          `URL import — submitted for approval (visible below until review)`,
        ]);
        toast.success(MEDIA_DRAFT_SUCCESS);
        await load();
      } finally {
        setUploading(false);
      }
      return;
    }

    const { error } = await insertProductMediaRow({
      product_id: productId,
      file_url: url,
      type,
      status: "raw",
      alt_text: "url_import",
    }).then((res) => (res.ok ? { error: null } : { error: res.error }));

    if (error) {
      if (import.meta.env.DEV) console.error("[media-url-add]", error, url);
      return toast.error(formatMediaInsertError(error));
    }
    setUrlInput("");
    if (!currentHero || isPdfPage(currentHero)) await setAsHeroDirect(url);
    toast.success("Image added from URL");
    await load();
  };

  const heroIsPdf = isPdfPage(currentHero);

  return (
    <div className="card-elevated p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-xl">Media</h3>
          <div className="text-xs text-muted-foreground">
            {writeMode === "readonly"
              ? "View only — you cannot upload or change media."
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
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <div className="text-sm font-medium flex items-center gap-2">
            <RefreshCw className="h-4 w-4" /> Replace product photo
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              type="button"
              variant="default"
              disabled={uploading}
              onClick={() => replaceRef.current?.click()}
              className="w-full"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              From gallery
            </Button>
            <Button
              type="button"
              variant="default"
              disabled={uploading}
              onClick={() => replaceCamRef.current?.click()}
              className="w-full"
            >
              <Camera className="h-4 w-4 mr-2" /> Take photo
            </Button>
          </div>
          <input
            ref={replaceRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => replaceHero(e.target.files)}
          />
          <input
            ref={replaceCamRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => replaceHero(e.target.files)}
          />
        </div>
      )}

      {canMutate && (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Media type for next upload</Label>
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
        multiple
        hidden
        onChange={(e) => upload(e.target.files)}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => upload(e.target.files)}
      />
      <input
        ref={videoRef}
        type="file"
        accept="video/*"
        hidden
        onChange={(e) => upload(e.target.files, true)}
      />

      {media.length === 0 ? (
        <div className="text-sm text-muted-foreground border border-dashed rounded-lg py-8 text-center">
          No media yet. Upload a product photo to get started.
        </div>
      ) : (
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
      )}
    </div>
  );
}
