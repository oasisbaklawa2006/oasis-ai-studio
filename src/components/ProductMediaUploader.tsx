import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Camera, Upload, Star, Trash2, Loader2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

const MEDIA_TYPES = [
  "raw_photo", "hero_image", "white_background", "lifestyle",
  "closeup", "side_angle", "top_angle", "45_angle",
  "hamper_open", "hamper_closed", "video", "label_image",
] as const;

type MediaType = typeof MEDIA_TYPES[number];

interface Props {
  productId: string;
  productSku?: string | null;
  currentHero?: string | null;
  onHeroChange?: (url: string) => void;
}

export function ProductMediaUploader({ productId, productSku, currentHero, onHeroChange }: Props) {
  const [media, setMedia] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [type, setType] = useState<MediaType>("raw_photo");
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data } = await supabase
      .from("product_media")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });
    setMedia(data ?? []);
  };

  useEffect(() => { if (productId) load(); }, [productId]);

  const upload = async (files: FileList | null, isVideo = false) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const folder = productSku || productId;
    let lastUrl = "";
    try {
      for (const file of Array.from(files)) {
        const ts = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `products/${folder}/raw/${ts}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("product-media")
          .upload(path, file, { cacheControl: "3600", upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("product-media").getPublicUrl(path);
        const url = pub.publicUrl;
        lastUrl = url;
        const { error: insErr } = await supabase.from("product_media").insert({
          product_id: productId,
          file_url: url,
          type: isVideo ? "video" : type,
          angle: type.includes("angle") || type === "closeup" ? type : null,
          status: "raw",
          alt_text: file.name,
        });
        if (insErr) throw insErr;
      }
      toast.success(`${files.length} file(s) uploaded`);
      await load();
      // Auto-set hero if none yet and uploaded was image
      if (!isVideo && !currentHero && lastUrl) {
        await setAsHero(lastUrl);
      }
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
      if (galleryRef.current) galleryRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
      if (videoRef.current) videoRef.current.value = "";
    }
  };

  const setAsHero = async (url: string) => {
    const { error } = await supabase.from("products").update({ hero_image_url: url }).eq("id", productId);
    if (error) return toast.error(error.message);
    toast.success("Hero image updated");
    onHeroChange?.(url);
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this media?")) return;
    const { error } = await supabase.from("product_media").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await load();
  };

  return (
    <div className="card-elevated p-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-xl">Media</h3>
        <div className="text-xs text-muted-foreground">Upload from gallery or take a photo.</div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <div className="sm:col-span-3">
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

        <Button type="button" variant="outline" disabled={uploading} onClick={() => galleryRef.current?.click()}>
          {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
          Upload from gallery
        </Button>
        <Button type="button" variant="outline" disabled={uploading} onClick={() => cameraRef.current?.click()}>
          <Camera className="h-4 w-4 mr-2" />
          Take photo
        </Button>
        <Button type="button" variant="outline" disabled={uploading} onClick={() => videoRef.current?.click()}>
          <ImageIcon className="h-4 w-4 mr-2" />
          Upload video
        </Button>
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
            return (
              <div key={m.id} className="relative group rounded-lg overflow-hidden border bg-muted">
                <div className="aspect-square">
                  {m.type === "video" ? (
                    <video src={m.file_url} className="w-full h-full object-cover" controls />
                  ) : (
                    <img src={m.file_url} alt={m.alt_text || ""} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="absolute top-1 left-1 flex gap-1">
                  <span className="text-[10px] bg-background/90 px-1.5 py-0.5 rounded">{m.type}</span>
                  {isHero && <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded flex items-center gap-0.5"><Star className="h-2.5 w-2.5" />Hero</span>}
                </div>
                <div className="absolute bottom-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  {m.type !== "video" && !isHero && (
                    <button onClick={() => setAsHero(m.file_url)} className="bg-background/90 hover:bg-background rounded p-1" title="Set as hero">
                      <Star className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button onClick={() => remove(m.id)} className="bg-background/90 hover:bg-destructive hover:text-destructive-foreground rounded p-1" title="Delete">
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
