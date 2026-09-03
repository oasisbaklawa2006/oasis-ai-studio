import type { ChangeEvent } from "react";
import { FileImage, Loader2 } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { readFirstSelectedFile, readTextFieldValue } from "./domInput";

type Props = {
  ocrText: string;
  ocrFileName: string | null;
  busy: boolean;
  onOcrTextChange: (value: string) => void;
  onImageSelected: (file: File) => void;
  onParse: () => void;
};

export function OcrIntakeFields({
  ocrText,
  ocrFileName,
  busy,
  onOcrTextChange,
  onImageSelected,
  onParse,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    const input = fileRef.current;
    if (input) input.click();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = readFirstSelectedFile(event);
    if (file) onImageSelected(file);
  };

  const handleTextChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onOcrTextChange(readTextFieldValue(event));
  };

  return (
    <div className="space-y-2">
      <Label>Label image</Label>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={handleFileChange}
      />
      <div className="flex gap-2 items-center">
        <Button type="button" variant="outline" onClick={handleUploadClick} disabled={busy}>
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
        onChange={handleTextChange}
        placeholder="Pixel OCR text appears here for review"
        rows={4}
      />
      <Button type="button" onClick={onParse} disabled={!ocrText.trim()}>
        Parse OCR text
      </Button>
    </div>
  );
}
