import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ProductUtteranceResolution, RuntimeAlternative } from "@/features/productIntelligence/runtime";
import {
  canConfirmSuggestion,
  confirmButtonLabelForCard,
  displayActionForBand,
  formatDetectedQuantity,
  requiresExplicitProductSelection,
  showPrimarySuggestion,
} from "@/features/operatorInbox/suggestionGovernance";
import type { OperatorSuggestionState } from "@/features/operatorInbox/types";
import { Check, X, Sparkles } from "lucide-react";

const BAND_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  HIGH: "default",
  MEDIUM: "secondary",
  LOW: "destructive",
};

type ProductSuggestionCardProps = {
  resolution: ProductUtteranceResolution;
  operator: OperatorSuggestionState;
  onConfirm: () => void;
  onReject: () => void;
  onSelectAlternative: (alt: RuntimeAlternative) => void;
  disabled?: boolean;
  draftStatus?: string | null;
};

export function ProductSuggestionCard({
  resolution,
  operator,
  onConfirm,
  onReject,
  onSelectAlternative,
  disabled = false,
  draftStatus = null,
}: ProductSuggestionCardProps) {
  const displayAction = displayActionForBand(resolution.confidence_band);
  const primary = showPrimarySuggestion(resolution);
  const selectedSku = operator.selected_sku;
  const decided = operator.decision !== "pending";
  const confidence = resolution.confidence ?? 0;
  const alternatives = resolution.alternatives ?? [];
  const reason = resolution.reason?.trim() || "No additional resolver detail.";
  const detectedQuantity = formatDetectedQuantity(resolution);
  const needsProductPick = requiresExplicitProductSelection(resolution) && !decided;
  const canConfirm = canConfirmSuggestion(resolution, operator);
  const confirmLabel = confirmButtonLabelForCard(resolution, operator);

  return (
    <div className="mt-2 rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2 text-sm" data-testid="product-suggestion-card">
      <div className="flex items-center gap-2 flex-wrap">
        <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Product suggestion
        </span>
        <Badge variant={BAND_VARIANT[resolution.confidence_band] ?? "outline"} className="text-[10px]">
          {resolution.confidence_band}
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          {displayAction}
        </Badge>
        <span className="text-[10px] text-muted-foreground ml-auto">
          {(confidence * 100).toFixed(0)}%
        </span>
      </div>

      {primary && (
        <div className="text-sm">
          <div className="font-medium">{resolution.resolved_name}</div>
          <div className="font-mono text-xs text-muted-foreground">{resolution.resolved_sku}</div>
        </div>
      )}

      {!primary && (
        <p className="text-xs text-muted-foreground">
          No single confident match — review alternatives or ask the customer to clarify.
        </p>
      )}

      {needsProductPick && (
        <p
          className="text-xs text-amber-800 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-1.5"
          data-testid="clarification-required-banner"
        >
          Clarification required — select a product from the alternatives before confirming.
        </p>
      )}

      {decided && operator.decision === "confirmed" && draftStatus && (
        <p
          className="text-xs text-emerald-800 dark:text-emerald-300"
          data-testid="draft-status-banner"
        >
          Draft {draftStatus.replace(/_/g, " ").toLowerCase()} · {operator.selected_product_name ?? operator.selected_sku}
        </p>
      )}

      {detectedQuantity && (
        <div className="text-xs" data-testid="detected-quantity">
          <span className="text-muted-foreground">Detected quantity:</span>{" "}
          <span className="font-medium">{detectedQuantity}</span>
        </div>
      )}

      <p className="text-xs text-muted-foreground leading-snug">{reason}</p>

      {alternatives.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Alternatives ({alternatives.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {alternatives.map((alt) => (
              <Button
                key={`${alt.sku}-${alt.matched_term}`}
                type="button"
                size="sm"
                variant={selectedSku === alt.sku ? "default" : "outline"}
                className="h-7 text-[11px] px-2"
                disabled={disabled || decided}
                onClick={() => onSelectAlternative(alt)}
              >
                {alt.product_name} · {alt.sku.split("-").pop()}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          type="button"
          size="sm"
          className="h-8"
          variant={canConfirm ? "default" : "secondary"}
          disabled={disabled || decided || !canConfirm}
          onClick={onConfirm}
          data-testid="confirm-suggestion-button"
        >
          <Check className="h-3.5 w-3.5 mr-1" />
          {confirmLabel}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8"
          disabled={disabled || decided}
          onClick={onReject}
        >
          <X className="h-3.5 w-3.5 mr-1" />
          Reject
        </Button>
        {decided && (
          <span className="text-xs text-muted-foreground self-center">
            {operator.decision === "confirmed" && `Confirmed · ${operator.selected_sku}`}
            {operator.decision === "rejected" && "Suggestion rejected"}
            {operator.decision === "alternative_selected" &&
              `Alternative · ${operator.selected_sku}`}
          </span>
        )}
      </div>
    </div>
  );
}
