import { Barcode, FileImage, Loader2, Mic, MicOff, Type } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { IntakeReviewCard } from "@/components/IntakeReviewCard";
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
import { transcriptFromSpeechEvent } from "@/features/fastCreate/intake/voiceTranscript";

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
  const [listening, setListening] = useState(false);
  const [pending, setPending] = useState<ProductIntakeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const clearInputs = () => {
    setBarcodeInput("");
    setTextInput("");
    setOcrText("");
    setVoiceTranscript("");
    setOcrFileName(null);
  };

  const handleBarcode = async () => {
    setBusy(true);
    try {
      const result = await intakeFromBarcode(barcodeInput);
      setPending(result);
      showIntakeToast(result);
    } finally {
      setBusy(false);
    }
  };

  const handleText = () => {
    const result = intakeFromText(textInput);
    setPending(result);
    showIntakeToast(result);
  };

  const handleVoiceParse = () => {
    const result = intakeFromVoiceTranscript(voiceTranscript);
    setPending(result);
    showIntakeToast(result);
  };

  const handleOcrParse = () => {
    const result = intakeFromOcrText(ocrText, ocrFileName ?? undefined);
    setPending(result);
    showIntakeToast(result);
  };

  const onPickImage = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setOcrFileName(file.name);
    try {
      const result = await prepareOcrIntakeFromImage(file);
      setOcrText(result.rawInput ?? "");
      setPending(result);
      showIntakeToast(result);
    } finally {
      setBusy(false);
    }
  };

  const startVoice = () => {
    const SpeechRecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      toast.error(
        "Speech recognition is not supported in this browser — type the transcript instead.",
      );
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-IN";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognitionRef.current = recognition;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = transcriptFromSpeechEvent(event);
      if (!transcript) return;
      setVoiceTranscript((prev) => `${prev} ${transcript}`.trim());
    };
    recognition.onerror = () => {
      setListening(false);
      toast.error("Voice capture failed — type the transcript manually.");
    };
    recognition.onend = () => {
      setListening(false);
    };

    setListening(true);
    recognition.start();
  };

  const stopVoice = () => {
    recognitionRef.current?.stop();
    setListening(false);
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
              onChange={(e) => {
                setBarcodeInput(e.target.value);
              }}
              placeholder="5901234123457"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void handleBarcode();
                }
              }}
            />
            <Button
              type="button"
              onClick={() => {
                void handleBarcode();
              }}
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
            onChange={(e) => {
              setTextInput(e.target.value);
            }}
            placeholder={"Misr 15 Gift Box\nMRP ₹450\n6 pcs per pack"}
            rows={4}
          />
          <Button type="button" onClick={handleText} disabled={!textInput.trim()}>
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
            onChange={(e) => {
              const file = e.target.files?.item(0) ?? null;
              void onPickImage(file);
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
            onChange={(e) => {
              setOcrText(e.target.value);
            }}
            placeholder="Pixel OCR text appears here for review"
            rows={4}
          />
          <Button type="button" onClick={handleOcrParse} disabled={!ocrText.trim()}>
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
              if (listening) stopVoice();
              else startVoice();
            }}
          >
            {listening ? <MicOff className="h-4 w-4 mr-1" /> : <Mic className="h-4 w-4 mr-1" />}
            {listening ? "Stop" : "Start voice"}
          </Button>
          <Textarea
            value={voiceTranscript}
            onChange={(e) => {
              setVoiceTranscript(e.target.value);
            }}
            placeholder="Say or type: Cashew pyramid gift box, MRP 450, 6 pieces"
            rows={4}
          />
          <Button type="button" onClick={handleVoiceParse} disabled={!voiceTranscript.trim()}>
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
