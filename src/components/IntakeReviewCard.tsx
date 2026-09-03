import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  intakeBlocksDraftApply,
  type ProductIntakeResult,
  suggestionListKey,
} from "@/features/fastCreate/intake";

type Props = {
  pending: ProductIntakeResult;
  onApply: () => void;
  onDismiss: () => void;
};

export function IntakeReviewCard({ pending, onApply, onDismiss }: Props) {
  return (
    <div className="rounded-md border bg-background p-3 space-y-2">
      <div className="flex items-start gap-2 text-sm">
        {pending.status === "duplicate_barcode" ? (
          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
        ) : null}
        <p>{pending.message}</p>
      </div>
      {pending.suggestions.length > 0 && (
        <ul className="text-xs space-y-1 text-muted-foreground">
          {pending.suggestions.map((suggestion) => (
            <li key={suggestionListKey(suggestion)}>
              <span className="font-medium text-foreground">{suggestion.field}</span>:{" "}
              {suggestion.value ?? "—"} ({suggestion.confidence})
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2 pt-1">
        <Button
          type="button"
          size="sm"
          onClick={onApply}
          disabled={intakeBlocksDraftApply(pending) || pending.status === "empty"}
        >
          Apply to draft
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}
