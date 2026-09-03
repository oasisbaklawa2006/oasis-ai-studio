import type { ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { readTextFieldValue } from "./domInput";

type Props = {
  value: string;
  onValueChange: (value: string) => void;
  onParse: () => void;
};

export function TextIntakeFields({ value, onValueChange, onParse }: Props) {
  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onValueChange(readTextFieldValue(event));
  };

  return (
    <div className="space-y-2">
      <Label>Paste product details</Label>
      <Textarea
        value={value}
        onChange={handleChange}
        placeholder={"Misr 15 Gift Box\nMRP ₹450\n6 pcs per pack"}
        rows={4}
      />
      <Button type="button" onClick={onParse} disabled={!value.trim()}>
        Parse text
      </Button>
    </div>
  );
}
