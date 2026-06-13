import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import type { ChannelMoqRule, ChannelPriceRecord, PackagingHierarchy } from "../types";
import type { PricingRuleRow } from "../channelAuthorityMappers";
import { computePricingLadder, formatPriceSource } from "../pricingLadder";
import { priceWithAlternateUom } from "../priceUnitConversion";
import { NOT_CONFIGURED } from "../packagingTruth";

type Props = {
  prices: ChannelPriceRecord[];
  moqRules: ChannelMoqRule[];
  packaging: PackagingHierarchy;
  pricingRows?: PricingRuleRow[];
};

export function ChannelRulesPanel({ prices, moqRules, packaging, pricingRows = [] }: Props) {
  const ladder = useMemo(
    () => computePricingLadder({ pricingRows, priceRecords: prices }),
    [pricingRows, prices],
  );

  const weightAuth = {
    gramsPerPiece: packaging.gramsPerPiece,
    piecesPerKg: packaging.piecesPerKg,
  };

  return (
    <div className="card-elevated p-4 space-y-4">
      <h4 className="font-medium">Channel pricing ladder</h4>
      <p className="text-xs text-muted-foreground">
        Manual overrides from <code className="text-[10px]">product_pricing_rules</code> win.
        Blank channels inherit per governed ladder. B2B is required and never auto-derived.
        Costing is internal-only and excluded.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-1 pr-2">Channel</th>
              <th className="py-1 pr-2">Manual</th>
              <th className="py-1 pr-2">Effective</th>
              <th className="py-1 pr-2">Source</th>
              <th className="py-1 pr-2">Unit</th>
              <th className="py-1">MOQ / increment</th>
            </tr>
          </thead>
          <tbody>
            {ladder.map((row) => {
              const moq = moqRules.find(
                (r) => r.channel?.toLowerCase() === row.channel.toLowerCase(),
              );
              const effective =
                row.effectivePrice != null
                  ? priceWithAlternateUom(row.effectivePrice, row.uom, weightAuth)
                  : null;

              return (
                <tr key={row.channel} className="border-b border-border/50">
                  <td className="py-2 pr-2 font-medium">
                    {row.label}
                    {row.isRequired && (
                      <Badge variant="outline" className="ml-1 text-[9px]">
                        required
                      </Badge>
                    )}
                  </td>
                  <td className="py-2 pr-2">
                    {row.manualPrice != null
                      ? `₹${row.manualPrice}${row.uom ? `/${row.uom}` : ""}`
                      : "—"}
                  </td>
                  <td className="py-2 pr-2">
                    {row.effectivePrice != null ? (
                      <span>
                        ₹{row.effectivePrice}
                        {row.uom ? `/${row.uom}` : "/kg"}
                        {effective?.alternatePrice != null && (
                          <span className="block text-[10px] text-muted-foreground">
                            {effective.alternateLabel}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-destructive">{NOT_CONFIGURED}</span>
                    )}
                  </td>
                  <td className="py-2 pr-2">
                    <span className="font-mono text-[10px]">{formatPriceSource(row.source)}</span>
                    {row.sourceDetail && (
                      <span className="block text-[10px] text-muted-foreground">{row.sourceDetail}</span>
                    )}
                  </td>
                  <td className="py-2 pr-2">{row.uom ?? "kg"}</td>
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
