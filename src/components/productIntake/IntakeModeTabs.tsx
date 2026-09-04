import { Barcode, FileImage, Mic, Type } from "lucide-react";
import { Button } from "@/components/ui/button";

export type IntakeTab = "barcode" | "ocr" | "voice" | "text";

const TABS: Array<{ key: IntakeTab; label: string }> = [
  { key: "barcode", label: "Barcode" },
  { key: "ocr", label: "OCR / image" },
  { key: "voice", label: "Voice" },
  { key: "text", label: "Paste / text" },
];

type Props = {
  activeTab: IntakeTab;
  onSelect: (tab: IntakeTab) => void;
};

function tabIcon(tab: IntakeTab) {
  if (tab === "barcode") return <Barcode className="h-3.5 w-3.5 mr-1" />;
  if (tab === "ocr") return <FileImage className="h-3.5 w-3.5 mr-1" />;
  if (tab === "voice") return <Mic className="h-3.5 w-3.5 mr-1" />;
  return <Type className="h-3.5 w-3.5 mr-1" />;
}

export function IntakeModeTabs({ activeTab, onSelect }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {TABS.map((entry) => (
        <Button
          key={entry.key}
          size="sm"
          variant={activeTab === entry.key ? "default" : "outline"}
          onClick={() => {
            onSelect(entry.key);
          }}
        >
          {tabIcon(entry.key)}
          {entry.label}
        </Button>
      ))}
    </div>
  );
}
