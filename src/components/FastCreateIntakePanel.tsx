import { Type } from "lucide-react";
import { type Dispatch, type SetStateAction, useState } from "react";
import { toast } from "sonner";
import { IntakeReviewCard } from "@/components/IntakeReviewCard";
import { BarcodeIntakeFields } from "@/components/productIntake/BarcodeIntakeFields";
import { IntakeModeTabs, type IntakeTab } from "@/components/productIntake/IntakeModeTabs";
import { OcrIntakeFields } from "@/components/productIntake/OcrIntakeFields";
import { TextIntakeFields } from "@/components/productIntake/TextIntakeFields";
import { useVoiceCapture } from "@/components/productIntake/useVoiceCapture";
import { VoiceIntakeFields } from "@/components/productIntake/VoiceIntakeFields";
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

function showIntakeToast(result: ProductIntakeResult) {
  if (result.status === "duplicate_barcode") {
    toast.error(result.message);
    return;
  }
  toast.message(result.message);
}

function appendVoiceTranscript(previous: string, transcript: string): string {
  return `${previous} ${transcript}`.trim();
}

function handleVoiceTranscriptChunk(
  setVoiceTranscript: Dispatch<SetStateAction<string>>,
  transcript: string,
): void {
  setVoiceTranscript((previous) => appendVoiceTranscript(previous, transcript));
}

export function FastCreateIntakePanel({ draft, onApply }: Props) {
  const [tab, setTab] = useState<IntakeTab>("text");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [textInput, setTextInput] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [ocrFileName, setOcrFileName] = useState<string | null>(null);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [pending, setPending] = useState<ProductIntakeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const voice = useVoiceCapture((transcript) => {
    handleVoiceTranscriptChunk(setVoiceTranscript, transcript);
  });

  const selectTab = (nextTab: IntakeTab) => {
    setTab(nextTab);
  };

  const updateBarcodeInput = (value: string) => {
    setBarcodeInput(value);
  };

  const updateTextInput = (value: string) => {
    setTextInput(value);
  };

  const updateOcrText = (value: string) => {
    setOcrText(value);
  };

  const updateVoiceTranscript = (value: string) => {
    setVoiceTranscript(value);
  };

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

  const toggleVoiceListening = () => {
    if (voice.listening) {
      voice.stop();
      return;
    }
    voice.start();
  };

  const applyPending = () => {
    if (!pending || intakeBlocksDraftApply(pending)) return;
    onApply(applyIntakeToDraft(draft, pending));
    toast.success("Intake suggestions applied — review the draft before create.");
    setPending(null);
    clearInputs();
  };

  const dismissPending = () => {
    setPending(null);
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

      <IntakeModeTabs activeTab={tab} onSelect={selectTab} />

      {tab === "barcode" && (
        <BarcodeIntakeFields
          value={barcodeInput}
          busy={busy}
          onValueChange={updateBarcodeInput}
          onLookup={runBarcodeLookup}
        />
      )}

      {tab === "text" && (
        <TextIntakeFields
          value={textInput}
          onValueChange={updateTextInput}
          onParse={runTextParse}
        />
      )}

      {tab === "ocr" && (
        <OcrIntakeFields
          ocrText={ocrText}
          ocrFileName={ocrFileName}
          busy={busy}
          onOcrTextChange={updateOcrText}
          onImageSelected={runImageOcr}
          onParse={runOcrParse}
        />
      )}

      {tab === "voice" && (
        <VoiceIntakeFields
          transcript={voiceTranscript}
          listening={voice.listening}
          onTranscriptChange={updateVoiceTranscript}
          onToggleListening={toggleVoiceListening}
          onParse={runVoiceParse}
        />
      )}

      {pending && (
        <IntakeReviewCard pending={pending} onApply={applyPending} onDismiss={dismissPending} />
      )}
    </div>
  );
}
