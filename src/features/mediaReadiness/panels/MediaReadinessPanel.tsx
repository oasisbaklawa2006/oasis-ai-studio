import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle2, ImageIcon } from "lucide-react";
import { evaluateMediaReadiness, selectApprovedImageUrlsForCentral } from "../mediaReadinessEngine";
import {
  mediaAssetsFromSources,
  productMediaContextFromForm,
  slotDisplayLabel,
  type ProductMediaRow,
} from "../mediaAssetsFromForm";

type Props = {
  form: Record<string, unknown>;
  productMediaRows?: ProductMediaRow[];
};

export function MediaReadinessPanel({ form, productMediaRows = [] }: Props) {
  const product = useMemo(() => productMediaContextFromForm(form), [form]);
  const assets = useMemo(
    () => mediaAssetsFromSources({ form, productMediaRows }),
    [form, productMediaRows],
  );

  const readiness = useMemo(
    () => evaluateMediaReadiness(product, assets),
    [product, assets],
  );

  const centralUrls = useMemo(() => selectApprovedImageUrlsForCentral(assets), [assets]);
  const pct = readiness.maxScore
    ? Math.round((readiness.score / readiness.maxScore) * 100)
    : 0;

  return (
    <div className="card-elevated p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="font-medium flex items-center gap-2">
            <ImageIcon className="h-4 w-4" /> Media readiness
          </h4>
          <p className="text-xs text-muted-foreground mt-1">
            Profile: <span className="font-mono">{readiness.profile.replace(/_/g, " ")}</span>
            {readiness.isLegacy && " · legacy product"}
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {readiness.score}/{readiness.maxScore} required
        </Badge>
      </div>

      <Progress value={pct} className="h-2" />

      <div className="flex flex-wrap gap-2 text-xs">
        {readiness.canPublishMedia ? (
          <span className="badge-soft bg-success/10 text-success flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Required for catalogue
          </span>
        ) : (
          <span className="badge-soft bg-warning/10 text-warning">Catalogue: blocked</span>
        )}
        {readiness.canSyncMediaToCentral ? (
          <span className="badge-soft bg-success/10 text-success flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Required for Central sync
          </span>
        ) : (
          <span className="badge-soft bg-warning/10 text-warning">Central sync: blocked</span>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground rounded border border-dashed p-2">
        Media slots combine hero URL, optional <code className="text-[10px]">media_assets</code> on the
        form, and persisted <code className="text-[10px]">product_media</code> rows. Requirements are
        profile-driven from <code className="text-[10px]">readinessProfiles.ts</code>.
      </p>

      {readiness.blockers.length > 0 && (
        <div>
          <div className="text-xs font-medium text-destructive flex items-center gap-1 mb-1">
            <AlertTriangle className="h-3 w-3" /> Media blockers
          </div>
          <ul className="text-sm list-disc pl-4 space-y-0.5">
            {readiness.blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-2">
        {readiness.slots.map((slot) => (
          <div key={slot.type} className="rounded border p-2 text-xs">
            <div className="font-medium">
              {slot.label}
              {!slot.required && (
                <span className="text-muted-foreground font-normal"> (optional)</span>
              )}
            </div>
            <div className="text-muted-foreground font-mono text-[10px] mt-0.5">{slot.type}</div>
            <Badge
              variant="outline"
              className={`mt-1 text-[10px] ${
                !slot.present
                  ? ""
                  : !slot.approved
                    ? "border-warning/50 text-warning"
                    : "border-success/50 text-success"
              }`}
            >
              {slotDisplayLabel({
                present: slot.present,
                approved: slot.approved,
                status: slot.status as "missing" | "draft" | "pending_approval" | "approved",
              })}
            </Badge>
            {slot.url && (
              <img
                src={slot.url}
                alt={slot.label}
                className="mt-2 h-16 w-full object-cover rounded border"
              />
            )}
          </div>
        ))}
      </div>

      {centralUrls.length > 0 && (
        <div>
          <div className="text-xs font-medium mb-2">Central approved_image_urls preview</div>
          <ul className="text-[11px] space-y-1 font-mono break-all text-muted-foreground">
            {centralUrls.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
