import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Copy, Eye, Lock } from "lucide-react";
import { toast } from "sonner";
import {
  evaluateProductReadiness,
  productTruthInputFromForm,
} from "@/features/productTruth/productReadiness";
import type { ChannelMoqRule, ChannelPriceRecord } from "@/features/productTruth/types";
import {
  approveAndPreviewCentralSync,
  listCatalogueVersions,
  listSyncPreviewEvents,
  previewCentralSync,
} from "../centralSyncPreviewService";
import { validateSnapshotGate } from "../snapshotValidation";
import type { CatalogueSyncEventRow, CatalogueVersionRow, CentralSyncPreviewBundle } from "../types";
import { isImmutableVersion } from "../catalogueVersionStore";
import { isStaleCatalogueVersion } from "../centralSyncPayload";

type Props = {
  form: Record<string, unknown>;
  productId: string;
  complianceApproved?: boolean;
  complianceMetaPending?: boolean;
  prices?: ChannelPriceRecord[];
  moqRules?: ChannelMoqRule[];
};

export function CentralSyncPreviewPanel({
  form,
  productId,
  complianceApproved = false,
  complianceMetaPending = false,
  prices = [],
  moqRules = [],
}: Props) {
  const [versions, setVersions] = useState<CatalogueVersionRow[]>([]);
  const [events, setEvents] = useState<CatalogueSyncEventRow[]>([]);
  const [bundle, setBundle] = useState<CentralSyncPreviewBundle | null>(null);
  const [loading, setLoading] = useState(false);

  const truthInput = useMemo(
    () =>
      productTruthInputFromForm(form, {
        complianceApproved,
        complianceMetaPending,
        isLegacy: !form.sku,
        prices,
        moqRules,
      }),
    [form, complianceApproved, complianceMetaPending, prices, moqRules],
  );

  const readiness = useMemo(() => evaluateProductReadiness(truthInput), [truthInput]);

  const validation = useMemo(
    () =>
      validateSnapshotGate(readiness, {
        complianceManuallyApproved: complianceApproved && !complianceMetaPending,
      }),
    [readiness, complianceApproved, complianceMetaPending],
  );

  const headVersion = versions[0] ?? null;

  const refresh = useCallback(async () => {
    const [v, e] = await Promise.all([
      listCatalogueVersions(productId),
      listSyncPreviewEvents(productId),
    ]);
    setVersions(v);
    setEvents(e);
  }, [productId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runPreview = async () => {
    setLoading(true);
    try {
      const result = await previewCentralSync({
        form,
        productId,
        complianceApproved,
        complianceMetaPending,
        prices,
        moqRules,
      });
      setBundle(result.bundle);
      await refresh();
      toast.success("Central sync preview generated (no live write)");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setLoading(false);
    }
  };

  const runApprovePreview = async () => {
    setLoading(true);
    try {
      const result = await approveAndPreviewCentralSync({
        form,
        productId,
        complianceApproved,
        complianceMetaPending,
        prices,
        moqRules,
      });
      setBundle(result.preview.bundle);
      await refresh();
      if (validation.allowed) {
        toast.success(result.approveMessage);
      } else {
        toast.warning(result.approveMessage);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Approve preview failed");
    } finally {
      setLoading(false);
    }
  };

  const copyJson = async () => {
    if (!bundle) return;
    await navigator.clipboard.writeText(JSON.stringify(bundle, null, 2));
    toast.success("Payload copied to clipboard");
  };

  const exportJson = () => {
    if (!bundle) return;
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `central-sync-preview-${productId.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-sm flex gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 text-warning mt-0.5" />
        <div>
          <strong>Preview only — no live Central write.</strong>
          <p className="text-xs text-muted-foreground mt-1">
            Connector 25B/25C export shape for review. Live sync and webhooks are not enabled.
          </p>
        </div>
      </div>

      <div className="card-elevated p-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="font-medium">Central sync readiness</h4>
          <p className="text-xs text-muted-foreground">
            Immutable snapshots lock after approval. GST/HSN stay null until manual compliance approval.
          </p>
        </div>
        {validation.allowed && readiness.readyForCentralSync ? (
          <Badge className="bg-success/10 text-success border-success/20">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Ready for Central Sync
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
            <Lock className="h-3 w-3 mr-1" /> Blocked
          </Badge>
        )}
      </div>

      {validation.blockers.length > 0 && (
        <div className="card-elevated p-4">
          <div className="text-xs font-medium text-destructive mb-2">Validation blockers</div>
          <ul className="text-sm list-disc pl-4 space-y-0.5">
            {validation.blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => void runPreview()} disabled={loading}>
          <Eye className="h-3 w-3 mr-1" /> Generate preview
        </Button>
        <Button size="sm" onClick={() => void runApprovePreview()} disabled={loading || !validation.allowed}>
          Approve snapshot (preview)
        </Button>
        <Button size="sm" variant="outline" onClick={() => void copyJson()} disabled={!bundle}>
          <Copy className="h-3 w-3 mr-1" /> Copy JSON
        </Button>
        <Button size="sm" variant="outline" onClick={exportJson} disabled={!bundle}>
          Export JSON
        </Button>
      </div>

      <div className="card-elevated p-4">
        <h4 className="font-medium mb-2">Version history</h4>
        {versions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No catalogue versions yet. Generate a preview to create a draft.</p>
        ) : (
          <ul className="text-sm space-y-2">
            {versions.map((v) => {
              const stale =
                headVersion != null &&
                v.id !== headVersion.id &&
                isStaleCatalogueVersion(v.version_number, headVersion.version_number);
              return (
                <li key={v.id} className="rounded border p-2 flex flex-wrap justify-between gap-2">
                  <div>
                    <span className="font-mono text-xs">{v.version_code}</span>
                    <span className="text-muted-foreground ml-2">#{v.version_number}</span>
                    {stale && (
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        superseded
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{v.status}</Badge>
                    {isImmutableVersion(v.status) && (
                      <Lock className="h-3 w-3 text-muted-foreground" title="Immutable" />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {bundle && (
        <div className="card-elevated p-4 space-y-2">
          <h4 className="font-medium">Payload JSON preview</h4>
          <pre className="text-[11px] bg-muted/30 rounded p-3 overflow-auto max-h-96">
            {JSON.stringify(bundle, null, 2)}
          </pre>
        </div>
      )}

      <div className="card-elevated p-4">
        <h4 className="font-medium mb-2">Sync event log</h4>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No preview events recorded yet.</p>
        ) : (
          <ul className="text-xs space-y-2 max-h-48 overflow-auto">
            {events.map((e) => (
              <li key={e.id} className="border-b pb-1">
                <span className="font-mono">{e.sync_status}</span>
                <span className="text-muted-foreground ml-2">{e.triggered_at}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
