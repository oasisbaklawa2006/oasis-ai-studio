import { PRODUCT_TRUTH_CHANNELS } from "../types";
import type { ChannelMoqRule, ChannelPriceRecord, PackagingHierarchy } from "../types";
import { getChannelPrice, priceBlocksPublish } from "../channelPricingMoqEngine";

type Props = {
  prices: ChannelPriceRecord[];
  moqRules: ChannelMoqRule[];
  packaging: PackagingHierarchy;
};

export function ChannelRulesPanel({ prices, moqRules }: Props) {
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
                    {moq?.moqApplicable
                      ? `${moq.moqValue ?? "—"} ${moq.moqUom ?? ""} / +${moq.incrementValue ?? "—"} ${moq.incrementUom ?? ""}`
                      : "—"}
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
