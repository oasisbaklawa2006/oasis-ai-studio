import { PageHeader } from "@/components/PageHeader";
import { Lock, Cloud, Image as ImageIcon, Video, MessageCircle, Tag, HardDrive, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const PdfHeroCleanup = () => {
  const { roles } = useAuth();
  const allowed = roles.includes("owner") || roles.includes("admin");
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const { count: c } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .ilike("hero_image_url", "%/_pdf_pages/%");
    setCount(c ?? 0);
  };

  useEffect(() => { if (allowed) refresh(); }, [allowed]);

  if (!allowed) return null;

  const run = async () => {
    if (!confirm(`Clear PDF page hero images on ${count} products? Media stays in the gallery as reference only.`)) return;
    setBusy(true);
    try {
      const { data: products } = await supabase
        .from("products")
        .select("id, hero_image_url")
        .ilike("hero_image_url", "%/_pdf_pages/%");
      const urls = (products ?? []).map((p: any) => p.hero_image_url).filter(Boolean) as string[];
      const ids = (products ?? []).map((p: any) => p.id);

      if (urls.length) {
        await supabase.from("product_media")
          .update({ type: "source_pdf_page", status: "reference_only" })
          .in("file_url", urls);
      }
      if (ids.length) {
        await supabase.from("products").update({ hero_image_url: null }).in("id", ids);
      }
      toast.success(`Cleared hero on ${ids.length} products`);
      await refresh();
    } catch (e: any) {
      toast.error(e.message || "Cleanup failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card-elevated p-5 space-y-3 mb-6 border-warning/40">
      <div className="flex items-center gap-2">
        <Trash2 className="h-5 w-5 text-warning" />
        <h3 className="font-display text-lg">Clear imported PDF page hero images</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        {count === null ? "Counting…" : `${count} products currently use a PDF page screenshot as their hero photo.`}
      </p>
      <Button onClick={run} disabled={busy || !count} variant="destructive" size="sm">
        {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
        Clear hero on {count ?? 0} products
      </Button>
    </div>
  );
};

const Card = ({ icon: Icon, title, status, fields, note }: any) => (
  <div className="card-elevated p-5 space-y-3">
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-accent" />
        <h3 className="font-display text-lg">{title}</h3>
      </div>
      <span className="badge-soft bg-muted text-muted-foreground">{status}</span>
    </div>
    <div className="space-y-1.5 text-xs">
      {fields.map((f: string) => (
        <div key={f} className="flex items-center justify-between border rounded px-2 py-1.5">
          <span className="text-muted-foreground">{f}</span>
          <span className="font-mono text-[11px] text-muted-foreground">— placeholder —</span>
        </div>
      ))}
    </div>
    {note && <p className="text-[11px] text-muted-foreground border-t pt-2">{note}</p>}
  </div>
);

const Settings = () => (
  <>
    <PageHeader title="Integration Center" subtitle="Future-ready connections for Oasis Central, AI, WhatsApp, label printers, and storage." />

    <PdfHeroCleanup />

    <div className="card-elevated p-4 mb-6 bg-accent-soft/40 text-sm flex items-start gap-2">
      <Lock className="h-4 w-4 mt-0.5 flex-shrink-0" />
      <span>Secrets are never stored in the frontend. Configure secrets in backend Edge Function secrets. Owner role only.</span>
    </div>

    <div className="grid sm:grid-cols-2 gap-4">
      <Card icon={Cloud} title="Oasis Central API" status="planned"
        fields={["Base URL", "API status", "Last sync", "Sync products (placeholder)", "Push catalogue link (placeholder)"]}
        note="Future sync MUST use product_id + SKU as the primary key. Aliases are search-only and never an external identifier." />
      <Card icon={ImageIcon} title="AI Image API" status="planned"
        fields={["Provider (OpenAI / Gemini / Runway / Adobe Firefly / Other)", "Status", "Test connection (placeholder)"]} />
      <Card icon={Video} title="AI Video API" status="planned"
        fields={["Provider (Runway / Pika / Other)", "Status", "Test connection (placeholder)"]} />
      <Card icon={MessageCircle} title="WhatsApp Business API" status="planned"
        fields={["Phone Number ID (placeholder)", "Template status (placeholder)", "Test share (placeholder)"]}
        note="MVP supports wa.me share links only. Business API will replace this later." />
      <Card icon={Tag} title="Barcode / Label App" status="planned"
        fields={["Barcode app endpoint", "TSC printer bridge endpoint", "Test label print (placeholder)"]}
        note="Labels and barcodes must reference SKU and product_id — never alias text." />
      <Card icon={HardDrive} title="Storage" status="connected"
        fields={["Backend storage status", "media bucket (planned)", "generated-assets bucket (planned)"]} />
    </div>
  </>
);

export default Settings;
