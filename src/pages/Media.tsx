import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Sparkles, Image as ImageIcon, Upload, Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  buildDirectMediaPath,
  buildStagingMediaPath,
  getMediaPublicUrl,
  submitMediaCatalogueDraft,
  uploadMediaFileToStorage,
  useCatalogueMediaWriteMode,
} from "@/features/catalogueDrafts/mediaDraftBoundary";
import {
  formatMediaInsertError,
  formatMediaStorageError,
  insertProductMediaRow,
  mediaTypeLabel,
} from "@/features/productAuthority/productMediaPersistence";
import type { Role } from "@/lib/permissions";

const MEDIA_DRAFT_SUCCESS =
  "Media change submitted for approval. Approved media will appear here after review.";

const Media = () => {
  const { roles } = useAuth();
  const { writeMode, canMutate } = useCatalogueMediaWriteMode(roles as Role[]);
  const [media, setMedia] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
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

  const load = async () => {
    const { data } = await supabase
      .from("product_media")
      .select("*, products(product_name, sku)")
      .order("created_at", { ascending: false });
    setMedia(data ?? []);
  };

  useEffect(() => {
    load();
    supabase
      .from("products")
      .select("id,product_name,sku")
      .then(({ data }) => setProducts(data ?? []));
  }, []);

  const resolveFolder = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    return product?.sku || productId || "unassigned";
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || !canMutate) return;
    setUploading(true);
    try {
      const folder = resolveFolder(form.product_id);

      if (writeMode === "draft") {
        if (!form.product_id) {
          toast.error("Select a product before submitting media for approval.");
          return;
        }
        let submitted = 0;
        for (const file of Array.from(files)) {
          const path = buildStagingMediaPath(folder, file.name);
          const { error: upErr } = await uploadMediaFileToStorage(path, file);
          if (upErr) {
            toast.error(formatMediaStorageError(upErr));
            continue;
          }
          const url = getMediaPublicUrl(path);
          const insertRes = await insertProductMediaRow({
            product_id: form.product_id,
            file_url: url,
            type: form.type,
            angle: form.angle,
            alt_text: form.alt_text || file.name,
            status: form.status,
          });
          if (!insertRes.ok) {
            toast.error(insertRes.message);
            continue;
          }
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
            null
          );
          if (res.ok) {
            submitted += 1;
            setPendingNotices((prev) => [
              ...prev,
              `${file.name} — submitted for approval (visible in library)`,
            ]);
          } else {
            toast.error(res.message);
          }
        }
        if (submitted > 0) {
          toast.success(
            `${submitted} media submission${submitted === 1 ? "" : "s"} uploaded and submitted for approval.`
          );
          load();
          setOpen(false);
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

      for (const file of Array.from(files)) {
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
      }
      toast.success(`${files.length} file(s) uploaded`);
      setOpen(false);
      setForm({
        file_url: "",
        type: "raw_photo",
        angle: "front",
        alt_text: "",
        product_id: "",
        status: "raw",
      });
      load();
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
      if (galleryRef.current) galleryRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  };

  const add = async () => {
    if (!canMutate || uploading) return;
    if (!form.file_url) return toast.error("URL required (or use upload buttons above)");

    if (writeMode === "draft") {
      if (!form.product_id) {
        toast.error("Select a product before submitting a URL for approval.");
        return;
      }
      setUploading(true);
      try {
        const insertRes = await insertProductMediaRow({
          product_id: form.product_id,
          file_url: form.file_url,
          type: form.type,
          angle: form.angle,
          alt_text: form.alt_text || "url_import",
          status: form.status,
        });
        if (!insertRes.ok) {
          toast.error(insertRes.message);
          return;
        }
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
          null
        );
        if (!res.ok) {
          toast.error(res.message);
          load();
          return;
        }
        setPendingNotices((prev) => [
          ...prev,
          `URL import — submitted for approval (visible in library)`,
        ]);
        toast.success(MEDIA_DRAFT_SUCCESS);
        setOpen(false);
        setForm({
          file_url: "",
          type: "raw_photo",
          angle: "front",
          alt_text: "",
          product_id: "",
          status: "raw",
        });
        load();
      } finally {
        setUploading(false);
      }
      return;
    }

    const insertRes = await insertProductMediaRow({
      product_id: form.product_id || null,
      file_url: form.file_url,
      type: form.type,
      angle: form.angle,
      alt_text: form.alt_text || "url_import",
      status: form.status,
    });
    if (!insertRes.ok) return toast.error(insertRes.message);
    toast.success("Media added");
    setOpen(false);
    setForm({
      file_url: "",
      type: "raw_photo",
      angle: "front",
      alt_text: "",
      product_id: "",
      status: "raw",
    });
    load();
  };

  return (
    <>
      <PageHeader
        title="Media Library"
        subtitle="Raw, edited, hero, lifestyle, video, label imagery."
        actions={
          canMutate ? (
            <Dialog open={open} onOpenChange={setOpen}>
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
                      Media changes are submitted for approval. Approved media will appear here
                      after review.
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Type</Label>
                      <select
                        className="w-full h-10 px-3 rounded-md border bg-background text-sm disabled:opacity-50"
                        value={form.type}
                        disabled={uploading}
                        onChange={(e) => setForm({ ...form, type: e.target.value })}
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
                        {["front", "top", "side", "45", "closeup", "hamper_open", "hamper_closed"].map(
                          (t) => (
                            <option key={t}>{t}</option>
                          )
                        )}
                      </select>
                    </div>
                  </div>
                  <div>
                    <Label>Product {writeMode === "draft" ? "(required for approval)" : "(optional)"}</Label>
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
                      disabled={uploading}
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
                    onChange={(e) => handleFiles(e.target.files)}
                  />

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
          ) : undefined
        }
      />

      {writeMode === "draft" && pendingNotices.length > 0 && (
        <div className="rounded-md border border-dashed bg-muted/20 p-3 mb-4 space-y-1">
          <div className="text-xs font-medium">Pending approval (not live in library)</div>
          {pendingNotices.map((notice, index) => (
            <div key={`${notice}-${index}`} className="text-[11px] text-muted-foreground">
              {notice}
            </div>
          ))}
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {media.map((m) => (
          <div key={m.id} className="card-elevated overflow-hidden">
            <div className="aspect-square bg-muted flex items-center justify-center">
              {m.type === "video" ? (
                <video src={m.file_url} className="w-full h-full object-cover" />
              ) : (
                <img
                  src={m.file_url}
                  alt={m.alt_text || "media"}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              )}
            </div>
            <div className="p-3 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="badge-soft bg-secondary text-secondary-foreground">{m.type}</span>
                <span className="text-muted-foreground">{m.angle}</span>
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {m.products?.product_name ?? "Unlinked"}
              </div>
              <div className="flex items-center gap-1 text-[11px] text-accent-foreground/80 bg-accent-soft px-2 py-1 rounded">
                <Sparkles className="h-3 w-3" />
                Future AI: enhance · BG remove · multi-angle · reel · identify
              </div>
            </div>
          </div>
        ))}
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
