import { Barcode, FileImage, Loader2, Mic, MicOff, Type } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { IntakeReviewCard } from "@/components/IntakeReviewCard";
import { useVoiceCapture } from "@/components/productIntake/useVoiceCapture";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FastCreateDraftSnapshot } from "@/features/fastCreate/fastCreateDraft";
import {
  applyIntakeToDraft,
  intakeBlocksDraftApply,
  intakeFromBarcode,
  intakeFromOcrText,
  intakeFromText,
  intakeFromVoiceTranscript,
  type ProductIntakeResult,
  prepareOcrIntakeFromImage,
} from "@/features/fastCreate/intake";

type Props = {
  draft: FastCreateDraftSnapshot;
  onApply: (next: FastCreateDraftSnapshot) => void;
};

type IntakeTab = "barcode" | "ocr" | "voice" | "text";

const TABS: Array<{ key: IntakeTab; label: string }> = [
  { key: "barcode", label: "Barcode" },
  { key: "ocr", label: "OCR / image" },
  { key: "voice", label: "Voice" },
  { key: "text", label: "Paste / text" },
];

function showIntakeToast(result: ProductIntakeResult) {
  if (result.status === "duplicate_barcode") {
    toast.error(result.message);
    return;
  }
  toast.message(result.message);
}

export function ProductIntakePanel({ draft, onApply }: Props) {
  const [tab, setTab] = useState<IntakeTab>("text");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [textInput, setTextInput] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [ocrFileName, setOcrFileName] = useState<string | null>(null);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [pending, setPending] = useState<ProductIntakeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const voice = useVoiceCapture((transcript) => {
    setVoiceTranscript((prev) => `${prev} ${transcript}`.trim());
  });

  const clearInputs = () => {
    setBarcodeInput("");
    setTextInput("");
    setOcrText("");
    setVoiceTranscript("");
    setOcrFileName(null);
  };

  const runBarcodeLookup = () => {
    setBusy(true);
    intakeFromBarcode(barcodeInput)
      .then((result) => {
        setPending(result);
        showIntakeToast(result);
      })
      .finally(() => {
        setBusy(false);
      });
  };

  const runTextParse = () => {
    const result = intakeFromText(textInput);
    setPending(result);
    showIntakeToast(result);
  };

  const runVoiceParse = () => {
    const result = intakeFromVoiceTranscript(voiceTranscript);
    setPending(result);
    showIntakeToast(result);
  };

  const runOcrParse = () => {
    const result = intakeFromOcrText(ocrText, ocrFileName ?? undefined);
    setPending(result);
    showIntakeToast(result);
  };

  const runImageOcr = (file: File) => {
    setBusy(true);
    setOcrFileName(file.name);
    prepareOcrIntakeFromImage(file)
      .then((result) => {
        setOcrText(result.rawInput ?? "");
        setPending(result);
        showIntakeToast(result);
      })
      .finally(() => {
        setBusy(false);
      });
  };

  const applyPending = () => {
    if (!pending || intakeBlocksDraftApply(pending)) return;
    onApply(applyIntakeToDraft(draft, pending));
    toast.success("Intake suggestions applied — review the draft before create.");
    setPending(null);
    clearInputs();
  };

  return (
    <div className="rounded-lg border border-border/80 bg-muted/20 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Type className="h-4 w-4 text-accent" />
        <h3 className="text-sm font-medium">Multimodal product input</h3>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Barcode, pixel OCR, voice, and paste all feed the same reviewable Fast Create draft. Nothing
        is saved until you review and create.
      </p>

      <div className="flex flex-wrap gap-2">
        {TABS.map((entry) => (
          <Button
            key={entry.key}
            size="sm"
            variant={tab === entry.key ? "default" : "outline"}
            onClick={() => {
              setTab(entry.key);
            }}
          >
            {entry.key === "barcode" && <Barcode className="h-3.5 w-3.5 mr-1" />}
            {entry.key === "ocr" && <FileImage className="h-3.5 w-3.5 mr-1" />}
            {entry.key === "voice" && <Mic className="h-3.5 w-3.5 mr-1" />}
            {entry.key === "text" && <Type className="h-3.5 w-3.5 mr-1" />}
            {entry.label}
          </Button>
        ))}
      </div>

      {tab === "barcode" && (
        <div className="space-y-2">
          <Label>Barcode (scan or type)</Label>
          <div className="flex gap-2">
            <Input
              value={barcodeInput}
              onChange={(event) => {
                setBarcodeInput(event.target.value);
              }}
              placeholder="5901234123457"
              onKeyDown={(event) => {
                if (event.key === "Enter") runBarcodeLookup();
              }}
            />
            <Button
              type="button"
              onClick={runBarcodeLookup}
              disabled={busy || !barcodeInput.trim()}
            >
              Lookup
            </Button>
          </div>
        </div>
      )}

      {tab === "text" && (
        <div className="space-y-2">
          <Label>Paste product details</Label>
          <Textarea
            value={textInput}
            onChange={(event) => {
              setTextInput(event.target.value);
            }}
            placeholder={"Misr 15 Gift Box\nMRP ₹450\n6 pcs per pack"}
            rows={4}
          />
          <Button type="button" onClick={runTextParse} disabled={!textInput.trim()}>
            Parse text
          </Button>
        </div>
      )}

      {tab === "ocr" && (
        <div className="space-y-2">
          <Label>Label image</Label>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.item(0);
              if (file) runImageOcr(file);
            }}
          />
          <div className="flex gap-2 items-center">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                fileRef.current?.click();
              }}
              disabled={busy}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <FileImage className="h-4 w-4 mr-1" />
              )}
              Upload image
            </Button>
            {ocrFileName && <span className="text-xs text-muted-foreground">{ocrFileName}</span>}
          </div>
          <Label>Extracted / corrected label text</Label>
          <Textarea
            value={ocrText}
            onChange={(event) => {
              setOcrText(event.target.value);
            }}
            placeholder="Pixel OCR text appears here for review"
            rows={4}
          />
          <Button type="button" onClick={runOcrParse} disabled={!ocrText.trim()}>
            Parse OCR text
          </Button>
        </div>
      )}

      {tab === "voice" && (
        <div className="space-y-2">
          <Label>Voice transcript</Label>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (voice.listening) voice.stop();
              else voice.start();
            }}
          >
            {voice.listening ? (
              <MicOff className="h-4 w-4 mr-1" />
            ) : (
              <Mic className="h-4 w-4 mr-1" />
            )}
            {voice.listening ? "Stop" : "Start voice"}
          </Button>
          <Textarea
            value={voiceTranscript}
            onChange={(event) => {
              setVoiceTranscript(event.target.value);
            }}
            placeholder="Say or type: Cashew pyramid gift box, MRP 450, 6 pieces"
            rows={4}
          />
          <Button type="button" onClick={runVoiceParse} disabled={!voiceTranscript.trim()}>
            Parse transcript
          </Button>
        </div>
      )}

      {pending && (
        <IntakeReviewCard
          pending={pending}
          onApply={applyPending}
          onDismiss={() => {
            setPending(null);
          }}
        />
      )}
    </div>
  );
}
