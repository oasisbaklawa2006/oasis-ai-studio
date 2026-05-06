import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Copy, MessageCircle, Download, QrCode } from "lucide-react";
import { toast } from "sonner";
import { QRCodeCanvas } from "qrcode.react";

export const SharePanel = ({ url, title }: { url: string; title: string }) => {
  const [msg, setMsg] = useState(`Hello, please view this curated Oasis Baklawa catalogue: ${url}. For pricing, customization, or bulk orders, reply here.`);
  const qrRef = useRef<HTMLDivElement>(null);

  const downloadQR = () => {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${title.replace(/\s+/g, "-").toLowerCase()}-qr.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <div className="card-elevated p-5 space-y-4">
      <div className="flex items-center gap-2">
        <QrCode className="h-4 w-4 text-accent" />
        <h3 className="font-display text-lg">Share panel</h3>
      </div>

      <div>
        <div className="text-xs text-muted-foreground mb-1">Public URL</div>
        <div className="flex gap-2">
          <Input readOnly value={url} className="font-mono text-xs" />
          <Button size="icon" variant="outline" onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copied"); }}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div>
        <div className="text-xs text-muted-foreground mb-1">WhatsApp message</div>
        <Textarea rows={4} value={msg} onChange={(e) => setMsg(e.target.value)} className="text-sm" />
        <Button asChild className="w-full mt-2">
          <a href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer">
            <MessageCircle className="h-4 w-4 mr-1" />Share on WhatsApp
          </a>
        </Button>
      </div>

      <div className="border-t pt-4">
        <div className="text-xs text-muted-foreground mb-2">QR code</div>
        <div ref={qrRef} className="flex flex-col items-center gap-3">
          <div className="bg-card p-3 rounded border">
            <QRCodeCanvas value={url} size={160} level="M" />
          </div>
          <Button variant="outline" size="sm" onClick={downloadQR}>
            <Download className="h-4 w-4 mr-1" />Download QR PNG
          </Button>
        </div>
      </div>
    </div>
  );
};
