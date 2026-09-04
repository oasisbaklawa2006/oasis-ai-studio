import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  isDisplayableMediaUrl,
  mediaSubmissionStatusLabel,
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

const formatAge = (dateStr?: string | null) => {
  if (!dateStr) return "Submitted recently";
  const ms = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.max(1, Math.floor(ms / 60000));
  if (minutes < 60) return `Submitted ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Submitted ${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `Submitted ${days} day${days === 1 ? "" : "s"} ago`;
};

const getSubmittedBy = (row: MediaSubmissionRow) =>
  row.submitter_name || row.submitter_email || row.submitted_by || "Unknown";

const MediaReview = () => {
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<MediaSubmissionRow[]>([]);
  const [activeTab, setActiveTab] = useState<MediaSubmissionStatus>("pending_approval");
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      const rows = await fetchMediaSubmissions(["pending_approval", "approved", "rejected"]);
      setItems(rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load media submissions");
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

  const groupedByStatus = useMemo(
    () => ({
      pending_approval: items.filter((i) => i.status === "pending_approval"),
      approved: items.filter((i) => i.status === "approved"),
      rejected: items.filter((i) => i.status === "rejected"),
    }),
    [items],
  );

  const currentItems = groupedByStatus[activeTab];

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
    const reason = reasons[row.id] ?? "";
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
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label} ({count})
              </Button>
            );
          })}
        </div>

        {loading && (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading submissions…</div>
        )}

        {!loading && currentItems.length === 0 && (
          <div className="catalogue-empty py-10">
            <p className="catalogue-empty-text">No media submissions in this section.</p>
          </div>
        )}

        {!loading &&
          currentItems.map((row) => {
            const summary = summarizeMediaSubmissionPayload(row.payload);
            const isPending = row.status === "pending_approval";
            const isRejected = row.status === "rejected";
            const showPreview = isDisplayableMediaUrl(summary.fileUrl);

            return (
              <div key={row.id} className="luxe-panel space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="text-sm space-y-1">
                    <div className="font-semibold text-foreground">
                      {summary.typeLabel} · {summary.operationIntent}
                    </div>
                    <div className="text-muted-foreground">
                      Product: {summary.productId ?? row.target_record_id ?? "(unlinked)"}
                    </div>
                    <div className="text-muted-foreground">{formatAge(row.submitted_at)}</div>
                    <div className="text-muted-foreground">Submitted by: {getSubmittedBy(row)}</div>
                  </div>
                  <span className="badge-soft catalogue-status-review">
                    {mediaSubmissionStatusLabel(row.status)}
                  </span>
                </div>

                <div className="grid sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-4">
                  {showPreview ? (
                    <div className="aspect-square max-w-[200px] rounded-lg border bg-muted overflow-hidden">
                      {summary.fileUrl?.includes(".mp4") || summary.fileUrl?.includes(".webm") ? (
                        <a
                          href={summary.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center h-full min-h-[120px] text-xs text-muted-foreground p-4 text-center underline-offset-4 hover:underline"
                        >
                          Open video preview
                        </a>
                      ) : (
                        <img
                          src={summary.fileUrl}
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
                        Reason: {row.rejection_reason || "No reason provided"}
                      </div>
                    )}
                  </div>
                </div>

                {isPending && (
                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <Input
                      className="flex-1"
                      placeholder="Rejection reason (required)"
                      value={reasons[row.id] ?? ""}
                      onChange={(e) =>
                        setReasons((prev) => ({ ...prev, [row.id]: e.target.value }))
                      }
                      aria-label="Rejection reason"
                    />
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="outline"
                        className="rounded-full"
                        onClick={() => reject(row)}
                        disabled={!(reasons[row.id] ?? "").trim()}
                      >
                        Reject
                      </Button>
                      <Button className="rounded-full" onClick={() => approve(row)}>
                        Approve
                      </Button>
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
