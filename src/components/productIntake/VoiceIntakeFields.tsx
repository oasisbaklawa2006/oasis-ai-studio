import type { ChangeEvent } from "react";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { readTextFieldValue } from "./domInput";

type Props = {
  transcript: string;
  listening: boolean;
  onTranscriptChange: (value: string) => void;
  onToggleListening: () => void;
  onParse: () => void;
};

export function VoiceIntakeFields({
  transcript,
  listening,
  onTranscriptChange,
  onToggleListening,
  onParse,
}: Props) {
  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onTranscriptChange(readTextFieldValue(event));
  };

  return (
    <div className="space-y-2">
      <Label>Voice transcript</Label>
      <Button type="button" variant="outline" onClick={onToggleListening}>
        {listening ? <MicOff className="h-4 w-4 mr-1" /> : <Mic className="h-4 w-4 mr-1" />}
        {listening ? "Stop" : "Start voice"}
      </Button>
      <Textarea
        value={transcript}
        onChange={handleChange}
        placeholder="Say or type: Cashew pyramid gift box, MRP 450, 6 pieces"
        rows={4}
      />
      <Button type="button" onClick={onParse} disabled={!transcript.trim()}>
        Parse transcript
      </Button>
    </div>
  );
}
