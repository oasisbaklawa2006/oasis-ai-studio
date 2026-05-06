import { PageHeader } from "@/components/PageHeader";
import { Camera, Search, Wand2, Layers, Film, FileText, Tags, Beaker, ShieldCheck, Send } from "lucide-react";

const steps = [
  { icon: Camera, title: "Upload raw iPhone photo", desc: "Designer drops a quick studio shot.", status: "Ready for API" },
  { icon: Search, title: "AI identifies the product", desc: "Recognise SKU from photo & link to master.", status: "Planned" },
  { icon: Wand2, title: "AI enhances product photo", desc: "Studio-grade lighting, clean background.", status: "Planned" },
  { icon: Layers, title: "AI creates multiple angles", desc: "Front, top, 45°, lifestyle.", status: "Planned" },
  { icon: Film, title: "AI creates short reel", desc: "WhatsApp / Instagram-ready video.", status: "Planned" },
  { icon: FileText, title: "AI writes catalogue copy", desc: "Luxury, on-brand descriptions.", status: "Planned" },
  { icon: Tags, title: "AI suggests tags & category", desc: "Occasion, market, family auto-classified.", status: "Planned" },
  { icon: Beaker, title: "AI drafts ingredients & nutrition", desc: "From recipe sheet or vision input.", status: "Planned" },
  { icon: ShieldCheck, title: "Human approves", desc: "QA, legal & branding sign-off.", status: "Always" },
  { icon: Send, title: "Publish to catalogue & label printer", desc: "Ready for client share + sticker print.", status: "Planned" },
];

const tone = (s: string) => s === "Ready for API"
  ? "bg-success/10 text-success"
  : s === "Always" ? "bg-accent-soft text-accent-foreground" : "bg-muted text-muted-foreground";

const AIStudio = () => (
  <>
    <PageHeader title="AI Studio · Roadmap" subtitle="The end-to-end automation we're wiring into Oasis Catalogue Studio." />

    <div className="card-elevated p-6 mb-8 gradient-hero text-primary-foreground">
      <h2 className="font-display text-3xl mb-2">From iPhone snap to gold-standard catalogue.</h2>
      <p className="opacity-80 max-w-2xl">A single photo becomes a fully-described, tagged, photographed, video-ready, label-compliant product — with a human always in the loop.</p>
    </div>

    <div className="relative">
      <div className="absolute left-5 top-2 bottom-2 w-px bg-border hidden sm:block" />
      <div className="space-y-4">
        {steps.map((s, i) => (
          <div key={s.title} className="flex gap-4 sm:gap-6 items-start">
            <div className="relative flex-shrink-0 h-10 w-10 rounded-full bg-card border-2 border-accent flex items-center justify-center font-display text-sm">
              {i+1}
            </div>
            <div className="card-elevated p-4 flex-1 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <s.icon className="h-5 w-5 text-accent mt-0.5" />
                <div className="min-w-0">
                  <div className="font-medium">{s.title}</div>
                  <div className="text-sm text-muted-foreground">{s.desc}</div>
                </div>
              </div>
              <span className={`badge-soft ${tone(s.status)} flex-shrink-0`}>{s.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  </>
);

export default AIStudio;
