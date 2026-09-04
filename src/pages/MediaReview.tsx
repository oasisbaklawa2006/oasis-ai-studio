import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  isMediaCatalogueApprovalAvailable,
  MEDIA_CATALOGUE_APPROVAL_BLOCKED_MESSAGE,
} from "@/features/mediaWorkspace/mediaCatalogueApprovalPolicy";
import {
  formatSubmissionAge,
  formatSubmitterDisplay,
  mediaSubmissionProductLabel,
  mediaSubmissionStatusLabel,
  safeDisplayableMediaUrl,
  shouldShowMediaReviewEmptyState,
  summarizeMediaSubmissionPayload,
} from "@/features/mediaWorkspace/mediaLibraryDisplay";
import {
  approveMediaSubmission,
  fetchMediaSubmissions,
  type MediaSubmissionRow,
  type MediaSubmissionStatus,
  rejectMediaSubmission,
} from "@/features/mediaWorkspace/mediaReviewDesk";
import { isCatalogueReviewer } from "@/shared/auth/centralPermissions";

const TABS: { key: MediaSubmissionStatus; label: string }[] = [
  { key: "pending_approval", label: "Awaiting approval" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

const MediaReview = () => {
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<MediaSubmissionRow[]>([]);
  const [activeTab, setActiveTab] = useState<MediaSubmissionStatus>("pending_approval");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const mediaApprovalAvailable = isMediaCatalogueApprovalAvailable();

  const load = async () => {
    setLoading(true);
    try {
      const rows = await fetchMediaSubmissions(["pending_approval", "approved", "rejected"]);
      setItems(rows);
      setLoadError(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load media submissions";
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: run once on mount only; load() identity is stable in intent
  useEffect(() => {
    void (async () => {
      const ok = await isCatalogueReviewer();
      setAllowed(ok);
      if (ok) await load();
      else setLoading(false);
    })();
  }, []);

  const groupedByStatus = useMemo(
    () => ({
      pending_approval: items.filter((i) => i.status === "pending_approval"),
      approved: items.filter((i) => i.status === "approved"),
      rejected: items.filter((i) => i.status === "rejected"),
    }),
    [items],
  );

  const currentItems = useMemo(() => {
    switch (activeTab) {
      case "pending_approval":
        return groupedByStatus.pending_approval;
      case "approved":
        return groupedByStatus.approved;
      case "rejected":
        return groupedByStatus.rejected;
    }
  }, [activeTab, groupedByStatus]);

  const rejectionReasonFor = (submissionId: string): string =>
    submissionId in reasons ? reasons[submissionId] : "";

  const approve = async (row: MediaSubmissionRow) => {
    const res = await approveMediaSubmission(row.id);
    if (!res.ok) {
      if (/not finalized/i.test(res.message)) toast.warning(res.message);
      else toast.error(res.message);
      return;
    }
    toast.success("Media approved");
    await load();
  };

  const reject = async (row: MediaSubmissionRow) => {
    const reason = rejectionReasonFor(row.id);
    const res = await rejectMediaSubmission(row.id, reason);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success("Media rejected");
    setReasons((prev) => ({ ...prev, [row.id]: "" }));
    await load();
  };

  if (!allowed) {
    return (
      <div className="p-4 text-sm space-y-2">
        <p>Media review is restricted to catalogue reviewers.</p>
        <Link to="/media" className="text-sm text-primary underline-offset-4 hover:underline">
          Return to Media Library
        </Link>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Media Review"
        subtitle="Governed approval desk for catalogue media submissions — product identity preserved from payload only."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/media">Media Library</Link>
          </Button>
        }
      />

      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => {
            const count = groupedByStatus[tab.key].length;
            const isActive = activeTab === tab.key;
            return (
              <Button
                key={tab.key}
                variant={isActive ? "default" : "outline"}
                className="rounded-full"
                onClick={() => {
                  setActiveTab(tab.key);
                }}
              >
                {tab.label} ({count})
              </Button>
            );
          })}
        </div>

        {loading && (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading submissions…</div>
        )}

        {!loading && loadError && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Failed to load media submissions: {loadError}
          </div>
        )}

        {!loading &&
          shouldShowMediaReviewEmptyState({
            loading,
            loadError,
            itemCount: currentItems.length,
          }) && (
            <div className="catalogue-empty py-10">
              <p className="catalogue-empty-text">No media submissions in this section.</p>
            </div>
          )}

        {!loading &&
          currentItems.map((row) => {
            const summary = summarizeMediaSubmissionPayload(row.payload);
            const isPending = row.status === "pending_approval";
            const isRejected = row.status === "rejected";
            const previewUrl = safeDisplayableMediaUrl(summary.fileUrl);

            return (
              <div key={row.id} className="luxe-panel space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="text-sm space-y-1">
                    <div className="font-semibold text-foreground">
                      {summary.typeLabel} · {summary.operationIntent}
                    </div>
                    <div className="text-muted-foreground">
                      Product: {mediaSubmissionProductLabel(summary.productId)}
                    </div>
                    <div className="text-muted-foreground">
                      {formatSubmissionAge(row.submitted_at)}
                    </div>
                    <div className="text-muted-foreground">
                      Submitted by: {formatSubmitterDisplay(row)}
                    </div>
                  </div>
                  <span className="badge-soft catalogue-status-review">
                    {mediaSubmissionStatusLabel(row.status)}
                  </span>
                </div>

                <div className="grid sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-4">
                  {previewUrl ? (
                    <div className="aspect-square max-w-[200px] rounded-lg border bg-muted overflow-hidden">
                      {previewUrl.includes(".mp4") || previewUrl.includes(".webm") ? (
                        <a
                          href={previewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center h-full min-h-[120px] text-xs text-muted-foreground p-4 text-center underline-offset-4 hover:underline"
                        >
                          Open video preview
                        </a>
                      ) : (
                        <img
                          src={previewUrl}
                          alt={summary.altText !== "—" ? summary.altText : "Media preview"}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground rounded-lg border border-dashed p-4">
                      No preview URL in submission payload.
                    </div>
                  )}

                  <div className="text-sm space-y-1">
                    <div>
                      <span className="font-medium">Angle:</span> {summary.angle}
                    </div>
                    <div>
                      <span className="font-medium">Alt text:</span> {summary.altText}
                    </div>
                    <div>
                      <span className="font-medium">Operation:</span> {row.operation || "create"}
                    </div>
                    {summary.storagePath && (
                      <div className="text-xs text-muted-foreground truncate">
                        Storage: {summary.storagePath}
                      </div>
                    )}
                    {isRejected && (
                      <div className="text-destructive font-medium pt-1">
                        Reason: {row.rejection_reason || row.review_notes || "No reason provided"}
                      </div>
                    )}
                  </div>
                </div>

                {isPending && (
                  <div className="flex flex-col gap-2 pt-1">
                    {!mediaApprovalAvailable && (
                      <div className="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                        {MEDIA_CATALOGUE_APPROVAL_BLOCKED_MESSAGE}
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input
                        className="flex-1"
                        placeholder="Rejection reason (required)"
                        value={rejectionReasonFor(row.id)}
                        onChange={(e) => {
                          setReasons((prev) => ({ ...prev, [row.id]: e.target.value }));
                        }}
                        aria-label="Rejection reason"
                      />
                      <div className="flex gap-2 shrink-0">
                        <Button
                          variant="outline"
                          className="rounded-full"
                          onClick={() => reject(row)}
                          disabled={!rejectionReasonFor(row.id).trim()}
                        >
                          Reject
                        </Button>
                        {mediaApprovalAvailable && (
                          <Button className="rounded-full" onClick={() => approve(row)}>
                            Approve
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </>
  );
};

export default MediaReview;
