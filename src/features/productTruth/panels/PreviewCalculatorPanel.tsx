import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getInvalidQtyMessage,
  validateOrderQtyAgainstChannelRules,
} from "../channelPricingMoqEngine";
import { describeConversion } from "../uomPackagingEngine";
import type { ChannelMoqRule, PackagingHierarchy } from "../types";

type Props = {
  packaging: PackagingHierarchy;
  moqRules: ChannelMoqRule[];
};

export function PreviewCalculatorPanel({ packaging, moqRules }: Props) {
  const [qty, setQty] = useState("10");
  const [uom, setUom] = useState("kg");
  const [channel, setChannel] = useState("b2b");

  const n = Number(qty);
  const rule = moqRules.find((r) => r.channel === channel);
  const validation =
    Number.isFinite(n) && n > 0
      ? validateOrderQtyAgainstChannelRules(n, uom, channel, rule, packaging)
      : { valid: false, messages: ["Enter a positive quantity"] };

  const invalidMsg =
    Number.isFinite(n) && n > 0
      ? getInvalidQtyMessage(n, uom, channel, rule, packaging)
      : null;

  return (
    <div className="card-elevated p-4 space-y-4">
      <h4 className="font-medium">Preview calculator</h4>
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Qty</Label>
          <Input value={qty} onChange={(e) => setQty(e.target.value)} className="h-9" />
        </div>
        <div>
          <Label className="text-xs">UOM</Label>
          <Input value={uom} onChange={(e) => setUom(e.target.value)} className="h-9" />
        </div>
        <div>
          <Label className="text-xs">Channel</Label>
          <Input value={channel} onChange={(e) => setChannel(e.target.value)} className="h-9" />
        </div>
      </div>

      {Number.isFinite(n) && n > 0 && (
        <div className="rounded border p-3 text-sm space-y-2 bg-muted/20">
          <p>{describeConversion(n, uom, packaging)}</p>
          <p className={validation.valid ? "text-success" : "text-destructive"}>
            {validation.valid ? "Valid for channel rules" : invalidMsg ?? validation.messages.join("; ")}
          </p>
        </div>
      )}

      <Button type="button" variant="outline" size="sm" onClick={() => { setQty("1"); setUom("pcs"); setChannel("retail"); }}>
        Reset: retail 1 pc
      </Button>
    </div>
  );
}
