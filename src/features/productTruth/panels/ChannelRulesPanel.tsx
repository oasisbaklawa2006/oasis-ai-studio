import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { seedMoqRowForChannel, type ChannelSeedTarget } from "@/features/productAuthority/seedChannelAuthority";
import { PRODUCT_TRUTH_CHANNELS } from "../types";
import type { ChannelMoqRule, ChannelPriceRecord, PackagingHierarchy } from "../types";
import { getChannelPrice, priceBlocksPublish } from "../channelPricingMoqEngine";

type Props = {
  prices: ChannelPriceRecord[];
  moqRules: ChannelMoqRule[];
  packaging: PackagingHierarchy;
  productId?: string;
  product?: Record<string, unknown>;
  onMoqSeeded?: () => void;
};

export function ChannelRulesPanel({
  prices,
  moqRules,
  productId,
  product,
  onMoqSeeded,
}: Props) {
  const [seeding, setSeeding] = useState<string | null>(null);

  const seedMoq = async (channel: ChannelSeedTarget) => {
    if (!productId || !product) {
      toast.error("Save the product first to seed MOQ rules.");
      return;
    }
    setSeeding(channel);
    try {
      const res = await seedMoqRowForChannel(productId, channel, product);
      if (!res.ok) {
        toast.error(res.message ?? "MOQ seed failed");
        return;
      }
      toast.success(`MOQ rule seeded for ${channel}`);
      onMoqSeeded?.();
    } finally {
      setSeeding(null);
    }
  };

  return (
    <div className="card-elevated p-4 space-y-4">
      <h4 className="font-medium">Channel rules summary</h4>
      <p className="text-xs text-muted-foreground">
        Full edit on Channels tab. Supported: {PRODUCT_TRUTH_CHANNELS.join(", ")}.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-1 pr-2">Channel</th>
              <th className="py-1 pr-2">Price</th>
              <th className="py-1 pr-2">Status</th>
              <th className="py-1">MOQ / increment</th>
            </tr>
          </thead>
          <tbody>
            {PRODUCT_TRUTH_CHANNELS.map((ch) => {
              const price = getChannelPrice(prices, ch);
              const moq = moqRules.find((r) => r.channel === ch);
              const priceExists = !!(price?.sellingPrice ?? price?.mrp);
              const moqMissing = priceExists && !moq;
              const seedChannel = ch === "retail" || ch === "b2b" ? (ch as ChannelSeedTarget) : null;

              return (
                <tr key={ch} className="border-b border-border/50">
                  <td className="py-2 pr-2 font-medium">{ch}</td>
                  <td className="py-2 pr-2">
                    {price?.sellingPrice ?? price?.mrp ?? "—"} {price?.currency ?? ""}
                  </td>
                  <td className="py-2 pr-2">
                    {price?.priceStatus ?? "—"}
                    {price && priceBlocksPublish(price) && (
                      <span className="text-warning ml-1">(blocks publish)</span>
                    )}
                  </td>
                  <td className="py-2">
                    {moq?.moqApplicable ? (
                      `${moq.moqValue ?? "—"} ${moq.moqUom ?? ""} / +${moq.incrementValue ?? "—"} ${moq.incrementUom ?? ""}`
                    ) : moq && !moq.moqApplicable ? (
                      "N/A (retail)"
                    ) : moqMissing && seedChannel ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-warning">Missing MOQ</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 text-[10px]"
                          disabled={seeding === seedChannel}
                          onClick={() => void seedMoq(seedChannel)}
                        >
                          {seeding === seedChannel ? "Seeding…" : "Seed MOQ from product"}
                        </Button>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
