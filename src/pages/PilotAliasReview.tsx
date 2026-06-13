import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, X, Save, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  buildAllPilotAliasBundles,
  buildPilotAliasBundle,
  setTermReviewStatus,
} from "@/features/productAuthority/pilotAliasEngine";
import {
  PILOT_ALIAS_DISCLAIMER,
  PILOT_ALIAS_TYPE_LABELS,
  PILOT_CHANNEL_LABELS,
  type PilotAliasSkuBundle,
  type PilotReviewStatus,
} from "@/features/productAuthority/pilotAliasTypes";
import { PILOT_SKUS, PILOT_SKU_LABELS, type PilotSkuCode } from "@/features/productAuthority/skuGuard";
import { loadPilotAliasReview, setPilotTermReview } from "@/features/productAuthority/pilotAliasReviewStorage";
import { saveApprovedPilotAliases } from "@/features/productAuthority/pilotAliasSave";

function collisionBadge(level: string) {
  if (level === "block") return <Badge variant="destructive">collision</Badge>;
  if (level === "warning") return <Badge variant="secondary">warn</Badge>;
  return null;
}

function statusBadge(status: PilotReviewStatus) {
  const map = {
    suggested: "outline",
    approved: "default",
    rejected: "destructive",
  } as const;
  return (
    <Badge variant={map[status]} className="capitalize">
      {status}
    </Badge>
  );
}

const PilotAliasReview = () => {
  const { roles } = useAuth();
  const [activeSku, setActiveSku] = useState<PilotSkuCode>(PILOT_SKUS[0]);
  const [bundles, setBundles] = useState<PilotAliasSkuBundle[]>(() => buildAllPilotAliasBundles());
  const [saving, setSaving] = useState(false);

  const applyStoredReview = () => {
    const stored = loadPilotAliasReview();
    setBundles(
      buildAllPilotAliasBundles().map((b) => {
        let next = b;
        for (const term of b.terms) {
          const st = stored[term.id];
          if (st) next = setTermReviewStatus(next, term.id, st);
        }
        return next;
      }),
    );
  };

  useEffect(() => {
    applyStoredReview();
  }, []);

  const bundle = useMemo(
    () => bundles.find((b) => b.sku === activeSku) ?? buildPilotAliasBundle(activeSku),
    [bundles, activeSku],
  );

  const updateStatus = (termId: string, status: PilotReviewStatus) => {
    setPilotTermReview(termId, status);
    setBundles((prev) =>
      prev.map((b) => (b.sku === activeSku ? setTermReviewStatus(b, termId, status) : b)),
    );
  };

  const approveAllSafe = () => {
    let next = bundle;
    for (const term of bundle.terms) {
      if (term.collision.level === "block") continue;
      if (term.review_status === "rejected") continue;
      next = setTermReviewStatus(next, term.id, "approved");
      setPilotTermReview(term.id, "approved");
    }
    setBundles((prev) => prev.map((b) => (b.sku === activeSku ? next : b)));
    toast.success("Approved all non-blocked terms for this SKU.");
  };

  const saveApproved = async () => {
    setSaving(true);
    try {
      const res = await saveApprovedPilotAliases(bundle, roles as any);
      if (!res.ok) {
        toast.error(res.errors[0] ?? "Save failed");
        return;
      }
      toast.success(
        res.mode === "draft"
          ? `Submitted ${res.saved} alias draft(s) for approval.`
          : `Saved ${res.saved} alias(es) to product_aliases.`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const groups: Array<{ title: string; filter: (t: (typeof bundle.terms)[number]) => boolean }> = [
    { title: "Official / search (5)", filter: (t) => t.alias_type === "official" || t.alias_type === "search_keyword" },
    { title: "WhatsApp keywords (5)", filter: (t) => t.alias_type === "whatsapp_keyword" },
    { title: "Phonetic variants (3)", filter: (t) => t.alias_type === "phonetic" },
    { title: "Sales terms (3)", filter: (t) => t.alias_type === "sales_term" },
  ];

  return (
    <>
      <PageHeader
        title="5-SKU Alias Term Review"
        subtitle="16 governed terms per pilot SKU — approve before save"
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" asChild>
              <Link to="/testing/pilot-readiness">Pilot readiness</Link>
            </Button>
            <Button variant="outline" onClick={applyStoredReview}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Reload
            </Button>
          </div>
        }
      />

      <p className="text-sm text-muted-foreground mb-4">{PILOT_ALIAS_DISCLAIMER}</p>

      <div className="flex flex-wrap gap-2 mb-6">
        {PILOT_SKUS.map((sku) => {
          const b = bundles.find((x) => x.sku === sku);
          return (
            <Button
              key={sku}
              variant={activeSku === sku ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveSku(sku)}
            >
              {PILOT_SKU_LABELS[sku]}
              {b && (
                <span className="ml-2 text-xs opacity-80">
                  {b.summary.approved}/{b.summary.total}
                </span>
              )}
            </Button>
          );
        })}
      </div>

      <div className="card-elevated p-4 mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-display text-lg">{bundle.product_name}</div>
          <div className="font-mono text-sm text-muted-foreground">{bundle.sku}</div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="secondary" onClick={approveAllSafe}>
            Approve safe terms
          </Button>
          <Button size="sm" onClick={saveApproved} disabled={saving || bundle.summary.approved === 0}>
            <Save className="h-4 w-4 mr-1" />
            Save approved ({bundle.summary.approved})
          </Button>
        </div>
      </div>

      {groups.map((group) => (
        <div key={group.title} className="mb-6">
          <h3 className="font-medium mb-2">{group.title}</h3>
          <div className="space-y-2">
            {bundle.terms.filter(group.filter).map((term) => (
              <div
                key={term.id}
                className="rounded-lg border p-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between"
              >
                <div className="space-y-1 min-w-0">
                  <div className="font-medium">{term.alias_text}</div>
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
                    <span>{PILOT_ALIAS_TYPE_LABELS[term.alias_type]}</span>
                    <span>·</span>
                    <span>{PILOT_CHANNEL_LABELS[term.channel_scope]}</span>
                    {collisionBadge(term.collision.level)}
                  </div>
                  {term.collision.level !== "none" && (
                    <p className="text-xs text-amber-700 dark:text-amber-300">{term.collision.reason}</p>
                  )}
                  {term.review_notes && (
                    <p className="text-xs text-destructive">{term.review_notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {statusBadge(term.review_status)}
                  <Button
                    size="icon"
                    variant="outline"
                    disabled={term.collision.level === "block"}
                    onClick={() => updateStatus(term.id, "approved")}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="outline" onClick={() => updateStatus(term.id, "rejected")}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
};

export default PilotAliasReview;
