import type { ChangeEvent, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isEnterKey, readTextFieldValue } from "./domInput";

type Props = {
  value: string;
  busy: boolean;
  onValueChange: (value: string) => void;
  onLookup: () => void;
};

export function BarcodeIntakeFields({ value, busy, onValueChange, onLookup }: Props) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onValueChange(readTextFieldValue(event));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!isEnterKey(event) || busy || !value.trim()) return;
    onLookup();
  };

  return (
    <div className="space-y-2">
      <Label>Barcode (scan or type)</Label>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={handleChange}
          placeholder="5901234123457"
          onKeyDown={handleKeyDown}
        />
        <Button type="button" onClick={onLookup} disabled={busy || !value.trim()}>
          Lookup
        </Button>
      </div>
    </div>
  );
}
