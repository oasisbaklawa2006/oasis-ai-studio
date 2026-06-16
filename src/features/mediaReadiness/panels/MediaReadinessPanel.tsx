import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle2, ImageIcon } from "lucide-react";
import { authoritativeMediaAssets } from "../mediaAuthorityContract";
import { evaluateMediaReadiness, selectApprovedImageUrlsForCentral } from "../mediaReadinessEngine";
import {
  getMediaGovernanceMode,
  mediaGovernanceModeLabel,
} from "../mediaGovernanceMode";
import {
  productMediaContextFromForm,
  slotDisplayLabel,
  type ProductMediaRow,
} from "../mediaAssetsFromForm";
import type { MediaAssetSlotStatus } from "../types";

type Props = {
  form: Record<string, unknown>;
  productMediaRows?: ProductMediaRow[];
};

function SlotCard({ slot }: { slot: MediaAssetSlotStatus }) {
  return (
    <div className="rounded border p-2 text-xs">
      <div className="font-medium">{slot.label}</div>
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
          status: slot.status,
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
  );
}

export function MediaReadinessPanel({ form, productMediaRows = [] }: Props) {
  const product = useMemo(() => productMediaContextFromForm(form), [form]);
  const assets = useMemo(
    () => authoritativeMediaAssets(productMediaRows, form),
    [form, productMediaRows],
  );

  const readiness = useMemo(
    () => evaluateMediaReadiness(product, assets),
    [product, assets],
  );

  const governanceMode = getMediaGovernanceMode();
  const requiredSlots = readiness.slots.filter((s) => s.required);
  const recommendedSlots = readiness.slots.filter((s) => !s.required);

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
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Governance: {mediaGovernanceModeLabel(governanceMode)}
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
        {governanceMode === "production" ? (
          <>
            Readiness uses persisted <code className="text-[10px]">product_media</code> rows matched
            by category profile. Upload each required slot before publish.
          </>
        ) : (
          <>
            Pilot testing mode: only governed required slots block Product Truth, readiness score,
            Central Sync, and catalogue approval. Other assets are recommended.
          </>
        )}
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

      {requiredSlots.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Required assets
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {requiredSlots.map((slot) => (
              <SlotCard key={slot.type} slot={slot} />
            ))}
          </div>
        </div>
      )}

      {recommendedSlots.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Recommended assets
            {governanceMode !== "production" && (
              <span className="normal-case font-normal text-muted-foreground/80">
                {" "}
                — optional until pilot signoff
              </span>
            )}
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {recommendedSlots.map((slot) => (
              <SlotCard key={slot.type} slot={slot} />
            ))}
          </div>
        </div>
      )}

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
