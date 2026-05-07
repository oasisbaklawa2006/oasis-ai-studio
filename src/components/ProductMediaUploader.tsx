import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, Upload, Star, StarOff, Trash2, Loader2, Image as ImageIcon, Link2, RefreshCw, AlertTriangle, Video } from "lucide-react";
import { toast } from "sonner";

const MEDIA_TYPES = [
  "raw_photo", "hero_image", "white_background", "lifestyle",
  "closeup", "side_angle", "top_angle", "45_angle",
  "hamper_open", "hamper_closed", "video", "label_image",
  "source_pdf_page",
] as const;

type MediaType = typeof MEDIA_TYPES[number];

interface Props {
  productId: string;
  productSku?: string | null;
  currentHero?: string | null;
  onHeroChange?: (url: string | null) => void;
}

const isPdfPage = (url?: string | null) => !!url && url.includes("/_pdf_pages/");

export function ProductMediaUploader({ productId, productSku, currentHero, onHeroChange }: Props) {
  const [media, setMedia] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [type, setType] = useState<MediaType>("raw_photo");
  const [urlInput, setUrlInput] = useState("");
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const replaceCamRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data } = await supabase
      .from("product_media")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });
    setMedia(data ?? []);
  };

  useEffect(() => { if (productId) load(); }, [productId]);

  const uploadFile = async (file: File, asHero = false, isVideo = false): Promise<string | null> => {
    const folder = productSku || productId;
    const ts = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `products/${folder}/raw/${ts}-${safeName}`;
    const { error: upErr } = await supabase.storage
      .from("product-media")
      .upload(path, file, { cacheControl: "3600", upsert: false });
    if (upErr) { toast.error(upErr.message); return null; }
    const { data: pub } = supabase.storage.from("product-media").getPublicUrl(path);
    const url = pub.publicUrl;
    const mediaType: MediaType = isVideo ? "video" : (asHero ? "hero_image" : type);
    const { error: insErr } = await supabase.from("product_media").insert({
      product_id: productId,
      file_url: url,
      type: mediaType,
      angle: type.includes("angle") || type === "closeup" ? type : null,
      status: asHero ? "approved" : "raw",
      alt_text: file.name,
    });
    if (insErr) { toast.error(insErr.message); return null; }
    return url;
  };

  const upload = async (files: FileList | null, isVideo = false) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    let lastUrl = "";
    try {
      for (const file of Array.from(files)) {
        const url = await uploadFile(file, false, isVideo);
        if (url) lastUrl = url;
      }
      toast.success(`${files.length} file(s) uploaded`);
      await load();
      if (!isVideo && (!currentHero || isPdfPage(currentHero)) && lastUrl) {
        await setAsHero(lastUrl);
      }
    } finally {
      setUploading(false);
      if (galleryRef.current) galleryRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
      if (videoRef.current) videoRef.current.value = "";
    }
  };

  const replaceHero = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      // Demote existing PDF page hero, if any
      if (currentHero && isPdfPage(currentHero)) {
        await supabase.from("product_media")
          .update({ type: "source_pdf_page", status: "reference_only" })
          .eq("product_id", productId)
          .eq("file_url", currentHero);
      }
      const url = await uploadFile(files[0], true, false);
      if (url) {
        await setAsHero(url);
        toast.success("Hero photo replaced");
      }
      await load();
    } finally {
      setUploading(false);
      if (replaceRef.current) replaceRef.current.value = "";
      if (replaceCamRef.current) replaceCamRef.current.value = "";
    }
  };

  const setAsHero = async (url: string) => {
    const { error } = await supabase.from("products").update({ hero_image_url: url }).eq("id", productId);
    if (error) return toast.error(error.message);
    onHeroChange?.(url);
  };

  const removeAsHero = async () => {
    if (!confirm("Remove this image as the hero photo? The image stays in the gallery.")) return;
    const { error } = await supabase.from("products").update({ hero_image_url: null }).eq("id", productId);
    if (error) return toast.error(error.message);
    onHeroChange?.(null);
    toast.success("Hero cleared");
  };

  const remove = async (m: any) => {
    if (!confirm("Delete this photo permanently?")) return;
    const { error } = await supabase.from("product_media").delete().eq("id", m.id);
    if (error) return toast.error(error.message);
    if (m.file_url === currentHero) {
      await supabase.from("products").update({ hero_image_url: null }).eq("id", productId);
      onHeroChange?.(null);
    }
    toast.success("Photo deleted");
    await load();
  };

  const addFromUrl = async () => {
    const url = urlInput.trim();
    if (!url) return;
    const { error } = await supabase.from("product_media").insert({
      product_id: productId,
      file_url: url,
      type,
      status: "raw",
      alt_text: "url_import",
    });
    if (error) return toast.error(error.message);
    setUrlInput("");
    if (!currentHero || isPdfPage(currentHero)) await setAsHero(url);
    toast.success("Image added from URL");
    await load();
  };

  const heroIsPdf = isPdfPage(currentHero);

  return (
    <div className="card-elevated p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-xl">Media</h3>
        <div className="text-xs text-muted-foreground">Upload from gallery or take a photo.</div>
      </div>

      {heroIsPdf && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 mt-0.5 text-warning shrink-0" />
          <div className="min-w-0">
            <div className="font-medium">Source PDF page image — not a final product photo</div>
            <div className="text-xs text-muted-foreground break-all">Replace it with a real product photo to publish.</div>
          </div>
        </div>
      )}

      {/* Replace product photo */}
      <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
        <div className="text-sm font-medium flex items-center gap-2"><RefreshCw className="h-4 w-4" /> Replace product photo</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button type="button" variant="default" disabled={uploading} onClick={() => replaceRef.current?.click()} className="w-full">
            {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            From gallery
          </Button>
          <Button type="button" variant="default" disabled={uploading} onClick={() => replaceCamRef.current?.click()} className="w-full">
            <Camera className="h-4 w-4 mr-2" /> Take photo
          </Button>
        </div>
        <input ref={replaceRef} type="file" accept="image/*" hidden onChange={(e) => replaceHero(e.target.files)} />
        <input ref={replaceCamRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => replaceHero(e.target.files)} />
      </div>

      <div className="space-y-3">
        <div>
          <Label className="text-xs">Media type for next upload</Label>
          <select
            className="w-full h-10 px-3 rounded-md border bg-background text-sm mt-1"
            value={type}
            onChange={(e) => setType(e.target.value as MediaType)}
          >
            {MEDIA_TYPES.filter(t => t !== "video").map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Button type="button" variant="outline" disabled={uploading} onClick={() => galleryRef.current?.click()} className="w-full">
            {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Gallery
          </Button>
          <Button type="button" variant="outline" disabled={uploading} onClick={() => cameraRef.current?.click()} className="w-full">
            <Camera className="h-4 w-4 mr-2" /> Camera
          </Button>
          <Button type="button" variant="outline" disabled={uploading} onClick={() => videoRef.current?.click()} className="w-full">
            <Video className="h-4 w-4 mr-2" /> Video
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="Paste image URL (advanced)" />
          <Button type="button" variant="outline" onClick={addFromUrl} disabled={!urlInput.trim()}>
            <Link2 className="h-4 w-4 mr-2" /> Add URL
          </Button>
        </div>
      </div>

      <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => upload(e.target.files)} />
      <input ref={videoRef} type="file" accept="video/*" hidden onChange={(e) => upload(e.target.files, true)} />

      {media.length === 0 ? (
        <div className="text-sm text-muted-foreground border border-dashed rounded-lg py-8 text-center">
          No media yet. Upload a product photo to get started.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {media.map((m) => {
            const isHero = m.file_url === currentHero;
            const pdf = isPdfPage(m.file_url) || m.type === "source_pdf_page" || m.status === "reference_only";
            return (
              <div key={m.id} className="relative group rounded-lg overflow-hidden border bg-muted">
                <div className="aspect-square">
                  {m.type === "video" ? (
                    <video src={m.file_url} className="w-full h-full object-cover" controls />
                  ) : (
                    <img src={m.file_url} alt={m.alt_text || ""} className={`w-full h-full object-cover ${pdf && !isHero ? "opacity-70" : ""}`} />
                  )}
                </div>
                <div className="absolute top-1 left-1 right-1 flex flex-wrap gap-1">
                  <span className="text-[10px] bg-background/90 px-1.5 py-0.5 rounded">{m.type}</span>
                  {isHero && <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded flex items-center gap-0.5"><Star className="h-2.5 w-2.5" />Hero</span>}
                  {pdf && <span className="text-[10px] bg-warning/90 text-warning-foreground px-1.5 py-0.5 rounded">PDF page</span>}
                </div>
                <div className="absolute bottom-1 right-1 flex gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition">
                  {m.type !== "video" && !isHero && (
                    <button onClick={() => setAsHero(m.file_url)} className="bg-background/90 hover:bg-background rounded p-1.5" title="Set as hero">
                      <Star className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {isHero && (
                    <button onClick={removeAsHero} className="bg-background/90 hover:bg-background rounded p-1.5" title="Remove as hero">
                      <StarOff className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button onClick={() => remove(m)} className="bg-background/90 hover:bg-destructive hover:text-destructive-foreground rounded p-1.5" title="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
