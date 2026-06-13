import type { ChannelMoqRule, ChannelPriceRecord, PackagingHierarchy } from "../types";
import { getChannelPrice, priceBlocksPublish } from "../channelPricingMoqEngine";
import {
  configuredChannels,
  formatChannelLabel,
} from "../channelAuthorityMappers";

type Props = {
  prices: ChannelPriceRecord[];
  moqRules: ChannelMoqRule[];
  packaging: PackagingHierarchy;
};

export function ChannelRulesPanel({ prices, moqRules }: Props) {
  const channels = configuredChannels(prices, moqRules);

  return (
    <div className="card-elevated p-4 space-y-4">
      <h4 className="font-medium">Channel rules summary</h4>
      <p className="text-xs text-muted-foreground">
        Loaded from <code className="text-[10px]">product_pricing_rules</code> and{" "}
        <code className="text-[10px]">product_moq_rules</code> — same source as Channels tab.
      </p>

      {channels.length === 0 ? (
        <p className="text-sm text-muted-foreground">No channel rules configured.</p>
      ) : (
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
              {channels.map((ch) => {
                const price = getChannelPrice(prices, ch);
                const moq = moqRules.find((r) => r.channel?.toLowerCase() === ch.toLowerCase());
                const displayPrice = price?.sellingPrice ?? price?.mrp;
                return (
                  <tr key={ch} className="border-b border-border/50">
                    <td className="py-2 pr-2 font-medium">{formatChannelLabel(ch)}</td>
                    <td className="py-2 pr-2">
                      {displayPrice != null ? `${displayPrice} ${price?.currency ?? "INR"}` : "—"}
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
      )}
    </div>
  );
}
