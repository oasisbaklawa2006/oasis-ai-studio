import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  approveMediaSubmission,
  fetchMediaReviewQueue,
  filterMediaReviewQueue,
  type MediaReviewQueueItem,
  type MediaReviewStatus,
  rejectMediaSubmission,
} from "@/features/mediaReadiness/mediaReviewQueue";
import { productMediaDeepLink } from "@/features/productAuthority/productEditDeepLinks";
import { isCatalogueReviewer } from "@/shared/auth/centralPermissions";

const TABS: { key: MediaReviewStatus; label: string }[] = [
  { key: "pending_approval", label: "Awaiting Review" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

function queueItemLabel(item: MediaReviewQueueItem): string {
  return item.productName ?? item.productSku ?? item.productId ?? "Unassigned product";
}

export default function MediaReview() {
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<MediaReviewQueueItem[]>([]);
  const [activeTab, setActiveTab] = useState<MediaReviewStatus>("pending_approval");
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      setItems(await fetchMediaReviewQueue());
    } finally {
      setLoading(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: run once on mount only; load() identity is stable in intent
  useEffect(() => {
    (async () => {
      const ok = await isCatalogueReviewer();
      setAllowed(ok);
      if (ok) await load();
      else setLoading(false);
    })();
  }, []);

  const grouped = useMemo(
    () => ({
      pending_approval: filterMediaReviewQueue(items, "pending_approval"),
      approved: filterMediaReviewQueue(items, "approved"),
      rejected: filterMediaReviewQueue(items, "rejected"),
    }),
    [items],
  );

  const approve = async (item: MediaReviewQueueItem) => {
    if (item.source !== "catalogue_submission") {
      toast.message("Open the product media tab to action direct product_media rows.");
      return;
    }
    const message = await approveMediaSubmission(item.id);
    if (message) {
      toast.error(message);
      return;
    }
    toast.success("Media submission approved");
    load();
  };

  const reject = async (item: MediaReviewQueueItem) => {
    if (item.source !== "catalogue_submission") {
      toast.message("Open the product media tab to action direct product_media rows.");
      return;
    }
    const reason = reasons[item.id]?.trim();
    if (!reason) {
      toast.error("Enter a rejection reason first.");
      return;
    }
    const message = await rejectMediaSubmission(item.id, reason);
    if (message) {
      toast.error(message);
      return;
    }
    toast.success("Media submission rejected");
    load();
  };

  if (!allowed && !loading) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Media Review"
          description="Governed review queue for catalogue media submissions and pending product media."
        />
        <p className="text-sm text-muted-foreground">
          Catalogue reviewer access is required. Media submissions can also be reviewed from the{" "}
          <Link to="/approvals" className="underline">
            Approval Inbox
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Media Review"
        description="SCREEN #41 — media governance queue. Catalogue submissions are actionable here; direct product_media rows link to the product editor."
      />

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <Button
            key={tab.key}
            variant={activeTab === tab.key ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label} ({grouped[tab.key].length})
          </Button>
        ))}
        <Button variant="ghost" size="sm" onClick={() => load()} disabled={loading}>
          Refresh
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading media review queue…</p>
      ) : grouped[activeTab].length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No {activeTab.replace(/_/g, " ")} media items.
        </p>
      ) : (
        <div className="space-y-3">
          {grouped[activeTab].map((item) => (
            <div key={`${item.source}-${item.id}`} className="card-elevated p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{queueItemLabel(item)}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.source === "catalogue_submission"
                      ? "Catalogue submission"
                      : "Product media row"}
                    {item.mediaType ? ` · ${item.mediaType}` : ""}
                    {item.productSku ? ` · ${item.productSku}` : ""}
                  </p>
                </div>
                {item.productId ? (
                  <Button asChild variant="outline" size="sm">
                    <Link to={productMediaDeepLink(item.productId)}>Open media tab</Link>
                  </Button>
                ) : null}
              </div>

              {activeTab === "pending_approval" && item.source === "catalogue_submission" ? (
                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex-1 min-w-[200px]">
                    <Input
                      placeholder="Rejection reason (required to reject)"
                      value={reasons[item.id] ?? ""}
                      onChange={(e) =>
                        setReasons((prev) => ({ ...prev, [item.id]: e.target.value }))
                      }
                    />
                  </div>
                  <Button size="sm" onClick={() => approve(item)}>
                    Approve
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => reject(item)}>
                    Reject
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
