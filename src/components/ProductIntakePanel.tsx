import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Barcode, FileImage, Mic, MicOff, Type, AlertTriangle } from "lucide-react";
import type { FastCreateDraftSnapshot } from "@/features/fastCreate/fastCreateDraft";
import {
  applyIntakeToDraft,
  extractOcrCandidateText,
  intakeBlocksDraftApply,
  intakeFromBarcode,
  intakeFromOcrText,
  intakeFromText,
  intakeFromVoiceTranscript,
  prepareOcrIntakeFromImage,
  type ProductIntakeResult,
} from "@/features/fastCreate/intake";

type Props = {
  draft: FastCreateDraftSnapshot;
  onApply: (next: FastCreateDraftSnapshot, intake: ProductIntakeResult) => void;
};

type IntakeTab = "barcode" | "ocr" | "voice" | "text";

const TAB_LABELS: Record<IntakeTab, string> = {
  barcode: "Barcode",
  ocr: "OCR / image",
  voice: "Voice",
  text: "Paste / text",
};

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

  const resetPending = () => setPending(null);

  const showReview = (result: ProductIntakeResult) => {
    setPending(result);
    if (result.status === "duplicate_barcode") {
      toast.error(result.message);
      return;
    }
    if (result.status === "unsupported" || result.status === "empty") {
      toast.message(result.message);
      return;
    }
    toast.message(result.message);
  };

  const handleBarcode = async () => {
    setBusy(true);
    try {
      showReview(await intakeFromBarcode(barcodeInput));
    } finally {
      setBusy(false);
    }
  };

  const handleText = () => {
    showReview(intakeFromText(textInput));
  };

  const handleVoiceParse = () => {
    showReview(intakeFromVoiceTranscript(voiceTranscript));
  };

  const handleOcrParse = () => {
    showReview(intakeFromOcrText(ocrText, ocrFileName ?? undefined));
  };

  const onPickImage = async (file: File | null) => {
    if (!file) return;
    setOcrFileName(file.name);
    const prepared = prepareOcrIntakeFromImage(file);
    const { text } = extractOcrCandidateText(file);
    setOcrText(text);
    showReview(prepared);
  };

  const startVoice = () => {
    const SpeechRecognitionCtor =
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : undefined;

    if (!SpeechRecognitionCtor) {
      toast.error("Speech recognition is not supported in this browser — type the transcript instead.");
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-IN";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognitionRef.current = recognition;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const parts: string[] = [];
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        parts.push(event.results[i][0].transcript);
      }
      setVoiceTranscript((prev) => `${prev} ${parts.join(" ")}`.trim());
    };
    recognition.onerror = () => {
      setListening(false);
      toast.error("Voice capture failed — type the transcript manually.");
    };
    recognition.onend = () => setListening(false);

    setListening(true);
    recognition.start();
  };

  const stopVoice = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const applyPending = () => {
    if (!pending || intakeBlocksDraftApply(pending)) return;
    const next = applyIntakeToDraft(draft, pending);
    onApply(next, pending);
    toast.success("Intake suggestions applied — review the draft before create.");
    resetPending();
    setBarcodeInput("");
    setTextInput("");
    setOcrText("");
    setVoiceTranscript("");
    setOcrFileName(null);
  };

  return (
    <div className="rounded-lg border border-border/80 bg-muted/20 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Type className="h-4 w-4 text-accent" />
        <h3 className="text-sm font-medium">Multimodal product input</h3>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Barcode, OCR, voice, and paste all feed the same reviewable Fast Create draft. Nothing is saved until you
        review and create.
      </p>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(TAB_LABELS) as IntakeTab[]).map((key) => (
          <Button key={key} size="sm" variant={tab === key ? "default" : "outline"} onClick={() => setTab(key)}>
            {key === "barcode" && <Barcode className="h-3.5 w-3.5 mr-1" />}
            {key === "ocr" && <FileImage className="h-3.5 w-3.5 mr-1" />}
            {key === "voice" && <Mic className="h-3.5 w-3.5 mr-1" />}
            {key === "text" && <Type className="h-3.5 w-3.5 mr-1" />}
            {TAB_LABELS[key]}
          </Button>
        ))}
      </div>

      {tab === "barcode" && (
        <div className="space-y-2">
          <Label>Barcode (scan or type)</Label>
          <div className="flex gap-2">
            <Input
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="8901234567890"
              onKeyDown={(e) => e.key === "Enter" && void handleBarcode()}
            />
            <Button type="button" onClick={() => void handleBarcode()} disabled={busy || !barcodeInput.trim()}>
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
            onChange={(e) => setTextInput(e.target.value)}
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
            accept="image/*,.pdf"
            className="hidden"
            onChange={(e) => void onPickImage(e.target.files?.[0] ?? null)}
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
              <FileImage className="h-4 w-4 mr-1" /> Upload image
            </Button>
            {ocrFileName && <span className="text-xs text-muted-foreground self-center">{ocrFileName}</span>}
          </div>
          <Label>Extracted / corrected label text</Label>
          <Textarea
            value={ocrText}
            onChange={(e) => setOcrText(e.target.value)}
            placeholder="Type or correct the text you see on the label"
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
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={listening ? stopVoice : startVoice}>
              {listening ? <MicOff className="h-4 w-4 mr-1" /> : <Mic className="h-4 w-4 mr-1" />}
              {listening ? "Stop" : "Start voice"}
            </Button>
          </div>
          <Textarea
            value={voiceTranscript}
            onChange={(e) => setVoiceTranscript(e.target.value)}
            placeholder="Say or type: Cashew pyramid gift box, MRP 450, 6 pieces"
            rows={4}
          />
          <Button type="button" onClick={handleVoiceParse} disabled={!voiceTranscript.trim()}>
            Parse transcript
          </Button>
        </div>
      )}

      {pending && (
        <div className="rounded-md border bg-background p-3 space-y-2">
          <div className="flex items-start gap-2 text-sm">
            {pending.status === "duplicate_barcode" ? (
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            ) : null}
            <p>{pending.message}</p>
          </div>
          {pending.suggestions.length > 0 && (
            <ul className="text-xs space-y-1 text-muted-foreground">
              {pending.suggestions.map((s, idx) => (
                <li key={`${s.field}-${idx}`}>
                  <span className="font-medium text-foreground">{s.field}</span>: {s.value ?? "—"} ({s.confidence})
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              onClick={applyPending}
              disabled={intakeBlocksDraftApply(pending) || pending.status === "empty"}
            >
              Apply to draft
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={resetPending}>
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
