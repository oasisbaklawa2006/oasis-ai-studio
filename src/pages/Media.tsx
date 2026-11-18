import { Camera, Image as ImageIcon, Loader2, Plus, Sparkles, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import {
  buildDirectMediaPath,
  buildStagingMediaPath,
  getMediaPublicUrl,
  IMAGE_MIME_TYPES,
  submitMediaCatalogueDraft,
  uploadMediaFileToStorage,
  useCatalogueMediaWriteMode,
  VIDEO_MIME_TYPES,
  validateMediaFile,
} from "@/features/catalogueDrafts/mediaDraftBoundary";
import type { ProductMediaRow } from "@/features/mediaReadiness/mediaAssetsFromForm";
import {
  mediaRowStatusLabel,
  safeDisplayableMediaUrl,
} from "@/features/mediaWorkspace/mediaLibraryDisplay";
import {
  formatMediaStorageError,
  insertProductMediaRow,
  mediaTypeLabel,
} from "@/features/productAuthority/productMediaPersistence";
import { supabase } from "@/integrations/supabase/client";
import type { Role } from "@/lib/permissions";

const MEDIA_DRAFT_SUCCESS =
  "Media change submitted for approval. It will not appear in the live library until authorised review.";

type MediaLibraryProduct = { id: string; product_name: string | null; sku: string | null };

type MediaLibraryRow = ProductMediaRow & {
  id: string;
  products?: { product_name: string | null; sku: string | null } | null;
};

const Media = () => {
  const { roles } = useAuth();
  const { writeMode, canMutate } = useCatalogueMediaWriteMode(roles as Role[]);
  const [media, setMedia] = useState<MediaLibraryRow[]>([]);
  const [products, setProducts] = useState<MediaLibraryProduct[]>([]);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<{ file: File; url: string } | null>(null);
  const [pendingNotices, setPendingNotices] = useState<string[]>([]);
  const [form, setForm] = useState({
    file_url: "",
    type: "raw_photo",
    angle: "front",
    alt_text: "",
    product_id: "",
    status: "raw",
  });
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const dialogSession = useRef(0);
  const mounted = useRef(false);
  const mediaLoadRequest = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      dialogSession.current += 1;
      mediaLoadRequest.current += 1;
    };
  }, []);

  useEffect(() => {
    const url = capturedPhoto?.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [capturedPhoto]);

  const changeDialogOpen = (nextOpen: boolean) => {
    dialogSession.current += 1;
    if (!nextOpen) setCapturedPhoto(null);
    setOpen(nextOpen);
  };

  const previewCameraFile = (file: File | undefined) => {
    if (!file || !canMutate || uploading || form.type === "video") return;
    const error = validateMediaFile(file, IMAGE_MIME_TYPES);
    if (error) {
      toast.error(error);
      return;
    }
    setCapturedPhoto({ file, url: URL.createObjectURL(file) });
  };

  const load = async () => {
    const request = ++mediaLoadRequest.current;
    const { data, error } = await supabase
      .from("product_media")
      .select("*, products(product_name, sku)")
      .order("created_at", { ascending: false });
    if (!mounted.current || mediaLoadRequest.current !== request) return;
    if (error) {
      toast.error("Media library refresh failed. Existing items are preserved; verify before retrying.");
      return;
    }
    setMedia(data ?? []);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only load of media library and product picker
  useEffect(() => {
    load();
    let current = true;
    supabase
      .from("products")
      .select("id,product_name,sku")
      .then(({ data }) => {
        if (current) setProducts(data ?? []);
      });
    return () => {
      current = false;
    };
  }, []);

  const resolveFolder = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    return product?.sku || productId || "unassigned";
  };

  const allowedMimeTypes = form.type === "video" ? VIDEO_MIME_TYPES : IMAGE_MIME_TYPES;

  const handleFiles = async (files: FileList | readonly File[] | null) => {
    if (!files || files.length === 0 || !canMutate || uploading) return;
    const session = dialogSession.current;
    const isCurrent = () => mounted.current && dialogSession.current === session;
    setUploading(true);
    try {
      const folder = resolveFolder(form.product_id);
      const validFiles: File[] = [];
      for (const file of Array.from(files)) {
        const validationError = validateMediaFile(file, allowedMimeTypes);
        if (validationError) {
          toast.error(validationError);
          continue;
        }
        validFiles.push(file);
      }
      if (validFiles.length === 0) return;

      if (writeMode === "draft") {
        if (!form.product_id) {
          toast.error("Select a product before submitting media for approval.");
          return;
        }
        let submitted = 0;
        for (const file of validFiles) {
          const path = buildStagingMediaPath(folder, file.name);
          const { error: upErr } = await uploadMediaFileToStorage(path, file);
          if (upErr) {
            toast.error(formatMediaStorageError(upErr));
            continue;
          }
          const url = getMediaPublicUrl(path);
          // A contributor must never mutate authoritative product_media before
          // approval. Only the governed catalogue draft is submitted here.
          const res = await submitMediaCatalogueDraft(
            "create",
            {
              productId: form.product_id,
              operationIntent: "create",
              fileUrl: url,
              storagePath: path,
              type: form.type,
              angle: form.angle,
              altText: form.alt_text || file.name,
              status: form.status,
              source: "upload",
            },
            null,
          );
          if (res.ok) {
            submitted += 1;
            if (!isCurrent()) continue;
            setPendingNotices((prev) => [
              ...prev,
              `${file.name} — pending approval (not in live media library)`,
            ]);
          } else {
            toast.error(res.message);
          }
        }
        if (submitted > 0) {
          toast.success(
            `${submitted} media submission${submitted === 1 ? "" : "s"} uploaded and submitted for approval.`,
          );
          load();
          if (!isCurrent()) return;
          changeDialogOpen(false);
          setForm({
            file_url: "",
            type: "raw_photo",
            angle: "front",
            alt_text: "",
            product_id: "",
            status: "raw",
          });
        }
        return;
      }

      let uploaded = 0;
      for (const file of validFiles) {
        const path = buildDirectMediaPath(folder, file.name);
        const { error: upErr } = await uploadMediaFileToStorage(path, file);
        if (upErr) {
          toast.error(formatMediaStorageError(upErr));
          continue;
        }
        const url = getMediaPublicUrl(path);
        const insertRes = await insertProductMediaRow({
          file_url: url,
          type: form.type,
          angle: form.angle,
          alt_text: form.alt_text || file.name,
          product_id: form.product_id || null,
          status: "raw",
        });
        if (!insertRes.ok) {
          toast.error(insertRes.message);
          continue;
        }
        uploaded += 1;
      }
      if (uploaded === 0) {
        load();
        return;
      }
      load();
      if (!isCurrent()) return;
      toast.success(`${uploaded} file(s) uploaded`);
      changeDialogOpen(false);
      setForm({
        file_url: "",
        type: "raw_photo",
        angle: "front",
        alt_text: "",
        product_id: "",
        status: "raw",
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      if (mounted.current) setUploading(false);
      if (galleryRef.current) galleryRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  };

  const add = async () => {
    if (!canMutate || uploading) return;
    if (!form.file_url) return toast.error("URL required (or use upload buttons above)");

    const session = dialogSession.current;
    if (writeMode === "draft") {
      if (!form.product_id) {
        toast.error("Select a product before submitting a URL for approval.");
        return;
      }
      setUploading(true);
      try {
        // URL proposals are approval-only: no direct product_media insertion.
        const res = await submitMediaCatalogueDraft(
          "url_import",
          {
            productId: form.product_id,
            operationIntent: "url_import",
            fileUrl: form.file_url,
            type: form.type,
            angle: form.angle,
            altText: form.alt_text || "url_import",
            status: form.status,
            source: "url_import",
          },
          null,
        );
        if (!res.ok) {
          toast.error(res.message);
          return;
        }
        if (!mounted.current) return;
        load();
        setPendingNotices((prev) => [
          ...prev,
          `URL import — submitted for approval (not live until review)`,
        ]);
        toast.success(MEDIA_DRAFT_SUCCESS);
        if (dialogSession.current === session) changeDialogOpen(false);
        setForm((current) =>
          current === form
            ? {
                file_url: "",
                type: "raw_photo",
                angle: "front",
                alt_text: "",
                product_id: "",
                status: "raw",
              }
            : current,
        );
      } finally {
        if (mounted.current) setUploading(false);
      }
      return;
    }

    setUploading(true);
    const controller = new AbortController();
    const signal = controller.signal;
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const insertRes = await insertProductMediaRow(
        {
          product_id: form.product_id || null,
          file_url: form.file_url,
          type: form.type,
          angle: form.angle,
          alt_text: form.alt_text || "url_import",
          status: form.status,
        },
        signal,
      );
      if (!mounted.current) return;
      if (signal.aborted) {
        load();
        return toast.error("Save timed out. Check the media library before retrying.");
      }
      if (!insertRes.ok) return toast.error(insertRes.message);
      toast.success("Media added");
      load();
      if (dialogSession.current !== session) return;
      changeDialogOpen(false);
      setForm({
        file_url: "",
        type: "raw_photo",
        angle: "front",
        alt_text: "",
        product_id: "",
        status: "raw",
      });
    } catch (error) {
      if (!mounted.current) return;
      if (signal.aborted) {
        load();
        toast.error("Save timed out. Check the media library before retrying.");
      } else {
        toast.error(error instanceof Error ? error.message : "Could not save media URL");
      }
    } finally {
      clearTimeout(timeout);
      if (mounted.current) setUploading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Media Library"
        subtitle="Raw, edited, hero, lifestyle, video, label imagery."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/media/review">Media Review</Link>
            </Button>
            {canMutate ? (
              <Dialog open={open} onOpenChange={changeDialogOpen}>
                <DialogTrigger asChild>
                  <Button disabled={uploading}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Media
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add media asset</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    {writeMode === "draft" && (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Media changes are submitted for approval and are not published in the live
                        media library until authorised review.
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Type</Label>
                        <select
                          className="w-full h-10 px-3 rounded-md border bg-background text-sm disabled:opacity-50"
                          value={form.type}
                          disabled={uploading}
                          onChange={(e) => {
                            if (e.target.value === "video") setCapturedPhoto(null);
                            setForm({ ...form, type: e.target.value });
                          }}
                        >
                          {[
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
                          ].map((t) => (
                            <option key={t} value={t}>
                              {mediaTypeLabel(t)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label>Angle</Label>
                        <select
                          className="w-full h-10 px-3 rounded-md border bg-background text-sm disabled:opacity-50"
                          value={form.angle}
                          disabled={uploading}
                          onChange={(e) => setForm({ ...form, angle: e.target.value })}
                        >
                          {[
                            "front",
                            "top",
                            "side",
                            "45",
                            "closeup",
                            "hamper_open",
                            "hamper_closed",
                          ].map((t) => (
                            <option key={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <Label>
                        Product {writeMode === "draft" ? "(required for approval)" : "(optional)"}
                      </Label>
                      <select
                        className="w-full h-10 px-3 rounded-md border bg-background text-sm disabled:opacity-50"
                        value={form.product_id}
                        disabled={uploading}
                        onChange={(e) => setForm({ ...form, product_id: e.target.value })}
                      >
                        <option value="">— None —</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.product_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>Alt text</Label>
                      <Input
                        value={form.alt_text}
                        disabled={uploading}
                        onChange={(e) => setForm({ ...form, alt_text: e.target.value })}
                        placeholder="Describe the photo"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={uploading}
                        onClick={() => galleryRef.current?.click()}
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
                        variant="outline"
                        disabled={uploading || form.type === "video"}
                        onClick={() => cameraRef.current?.click()}
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        Take photo
                      </Button>
                    </div>
                    <input
                      ref={galleryRef}
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      hidden
                      onChange={(e) => handleFiles(e.target.files)}
                    />
                    <input
                      ref={cameraRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      hidden
                      onChange={(e) => {
                        previewCameraFile(e.currentTarget.files?.[0]);
                        e.currentTarget.value = "";
                      }}
                    />

                    {capturedPhoto && form.type !== "video" && (
                      <div className="space-y-2">
                        <img
                          src={capturedPhoto.url}
                          alt="Camera capture preview"
                          className="max-h-48 w-full rounded-md object-contain"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            disabled={uploading}
                            onClick={() => setCapturedPhoto(null)}
                          >
                            Discard photo
                          </Button>
                          <Button
                            type="button"
                            disabled={uploading}
                            onClick={() => handleFiles([capturedPhoto.file])}
                          >
                            Upload photo
                          </Button>
                        </div>
                      </div>
                    )}

                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground">
                        Advanced: paste URL instead
                      </summary>
                      <div className="mt-2 space-y-2">
                        <Input
                          value={form.file_url}
                          disabled={uploading}
                          onChange={(e) => setForm({ ...form, file_url: e.target.value })}
                          placeholder="https://…"
                        />
                        <Button size="sm" className="w-full" disabled={uploading} onClick={add}>
                          {writeMode === "draft" ? "Submit URL for approval" : "Save URL"}
                        </Button>
                      </div>
                    </details>
                  </div>
                </DialogContent>
              </Dialog>
            ) : null}
          </div>
        }
      />

      {writeMode === "draft" && pendingNotices.length > 0 && (
        <div className="rounded-md border border-dashed bg-muted/20 p-3 mb-4 space-y-1">
          <div className="text-xs font-medium">Pending approval (not live in library)</div>
          {pendingNotices.map((notice) => (
            <div key={notice} className="text-[11px] text-muted-foreground">
              {notice}
            </div>
          ))}
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {media.map((m) => {
          const previewUrl = safeDisplayableMediaUrl(m.file_url);
          return (
            <div key={m.id} className="card-elevated overflow-hidden">
              <div className="aspect-square bg-muted flex items-center justify-center">
                {m.type === "video" && previewUrl ? (
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center h-full w-full text-xs text-muted-foreground p-4 text-center underline-offset-4 hover:underline"
                  >
                    View video
                  </a>
                ) : previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={m.alt_text || "media"}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <span className="text-xs text-muted-foreground p-4 text-center">No preview</span>
                )}
              </div>
              <div className="p-3 space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="badge-soft bg-secondary text-secondary-foreground">
                    {mediaTypeLabel(m.type)}
                  </span>
                  <span
                    className="badge-soft text-[10px] shrink-0"
                    title={`Approval state: ${mediaRowStatusLabel(m.status)}`}
                  >
                    {mediaRowStatusLabel(m.status)}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground">{m.angle}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {m.products?.product_name ?? "Unlinked"}
                </div>
                <div className="flex items-center gap-1 text-[11px] text-accent-foreground/80 bg-accent-soft px-2 py-1 rounded">
                  <Sparkles className="h-3 w-3" />
                  Future AI: enhance · BG remove · multi-angle · reel · identify
                </div>
              </div>
            </div>
          );
        })}
        {media.length === 0 && (
          <div className="col-span-full text-sm text-muted-foreground text-center py-12">
            <ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
            No media yet.
          </div>
        )}
      </div>
    </>
  );
};

export default Media;
