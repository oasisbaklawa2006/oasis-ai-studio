import { getBuildMeterStatus, getMissingFieldChips, type ReadinessCategoryLike } from "@/features/productAuthority/buildMeter";
import { Badge } from "@/components/ui/badge";

interface BuildMeterBarProps {
  score: number;
  categories: ReadinessCategoryLike[];
  onChipClick?: (categoryKey: string) => void;
  sticky?: boolean;
}

/** Shared build-completion meter: percentage bar, 70% benchmark, tappable missing-field chips. */
export function BuildMeterBar({ score, categories, onChipClick, sticky }: BuildMeterBarProps) {
  const status = getBuildMeterStatus(score);
  const chips = getMissingFieldChips(categories);

  return (
    <div
      className={`rounded-md border bg-background/95 backdrop-blur p-3 space-y-2 ${sticky ? "sticky top-0 z-10 shadow-sm" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-semibold text-foreground">{status.score}%</span>
          <span className={`text-xs font-medium ${status.meetsThreshold ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
            {status.headline}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground">{status.detail}</span>
      </div>

      <div className="relative h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${status.meetsThreshold ? "bg-emerald-500" : "bg-amber-500"}`}
          style={{ width: `${status.score}%` }}
        />
        <div className="absolute top-0 bottom-0 w-px bg-foreground/40" style={{ left: "70%" }} title="70% benchmark" />
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {chips.map((chip) => (
            <Badge
              key={chip.key}
              variant="outline"
              className={onChipClick ? "cursor-pointer hover:bg-muted" : undefined}
              onClick={onChipClick ? () => onChipClick(chip.key) : undefined}
              title={chip.nextAction ?? undefined}
            >
              {chip.label}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
