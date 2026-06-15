import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { seedMoqRowForChannel, type ChannelSeedTarget } from "@/features/productAuthority/seedChannelAuthority";
import {
  getInvalidQtyMessage,
  validateOrderQtyAgainstChannelRules,
} from "../channelPricingMoqEngine";
import { describeConversion } from "../uomPackagingEngine";
import type { ChannelMoqRule, ChannelPriceRecord, PackagingHierarchy } from "../types";

type Props = {
  packaging: PackagingHierarchy;
  moqRules: ChannelMoqRule[];
  prices?: ChannelPriceRecord[];
  productId?: string;
  product?: Record<string, unknown>;
  onMoqSeeded?: () => void;
};

export function PreviewCalculatorPanel({
  packaging,
  moqRules,
  prices = [],
  productId,
  product,
  onMoqSeeded,
}: Props) {
  const [qty, setQty] = useState("10");
  const [uom, setUom] = useState("kg");
  const [channel, setChannel] = useState("b2b");
  const [seeding, setSeeding] = useState(false);

  const n = Number(qty);
  const rule = moqRules.find((r) => r.channel === channel);
  const channelPrice = prices.find((p) => p.channel === channel);
  const priceExists = !!(channelPrice?.sellingPrice ?? channelPrice?.mrp);
  const moqMissing = priceExists && !rule;
  const seedChannel =
    channel === "retail" || channel === "b2b" ? (channel as ChannelSeedTarget) : null;

  const validation =
    Number.isFinite(n) && n > 0
      ? validateOrderQtyAgainstChannelRules(n, uom, channel, rule, packaging)
      : { valid: false, messages: ["Enter a positive quantity"] };

  const invalidMsg =
    Number.isFinite(n) && n > 0
      ? getInvalidQtyMessage(n, uom, channel, rule, packaging)
      : null;

  const seedMoq = async () => {
    if (!productId || !product || !seedChannel) {
      toast.error("Save the product and use retail or B2B channel to seed MOQ.");
      return;
    }
    setSeeding(true);
    try {
      const res = await seedMoqRowForChannel(productId, seedChannel, product);
      if (!res.ok) {
        toast.error(res.message ?? "MOQ seed failed");
        return;
      }
      toast.success(`MOQ rule seeded for ${seedChannel}`);
      onMoqSeeded?.();
    } finally {
      setSeeding(false);
    }
  };

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

      {moqMissing && seedChannel && (
        <div className="rounded border border-warning/40 bg-warning/10 p-3 text-sm flex flex-wrap items-center justify-between gap-2">
          <span className="text-warning">
            {channel} price is configured but no MOQ rule exists — calculator cannot validate orders.
          </span>
          <Button type="button" size="sm" variant="outline" disabled={seeding} onClick={() => void seedMoq()}>
            {seeding ? "Seeding…" : "Seed MOQ from product"}
          </Button>
        </div>
      )}

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
