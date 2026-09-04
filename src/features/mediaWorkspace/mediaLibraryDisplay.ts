import { mediaTypeLabel } from "@/features/productAuthority/productMediaPersistence";

export type MediaRowApprovalState = "approved" | "pending_approval" | "rejected" | "raw";

/** Maps persisted product_media.status to a governed display state (fail-closed for unknown). */
export function mediaRowApprovalState(status: string | null | undefined): MediaRowApprovalState {
  const s = String(status ?? "raw").toLowerCase();
  if (s === "approved") return "approved";
  if (s === "rejected") return "rejected";
  if (s === "pending_approval" || s === "pending" || s === "draft") return "pending_approval";
  return "raw";
}

export function mediaRowStatusLabel(status: string | null | undefined): string {
  switch (mediaRowApprovalState(status)) {
    case "approved":
      return "Approved";
    case "pending_approval":
      return "Pending approval";
    case "rejected":
      return "Rejected";
    default:
      return "Raw";
  }
}

export function mediaSubmissionStatusLabel(status: string | null | undefined): string {
  const s = String(status ?? "").toLowerCase();
  if (s === "approved") return "Approved";
  if (s === "rejected") return "Rejected";
  if (s === "pending_approval") return "Awaiting approval";
  return status?.trim() || "Unknown";
}

const nestedRead = (payload: Record<string, unknown> | null | undefined, path: string) => {
  if (!payload) return undefined;
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== "object") return undefined;
    if (!Object.hasOwn(acc, key)) return undefined;
    return (acc as Record<string, unknown>)[key];
  }, payload);
};

export function readMediaPayloadField(
  payload: Record<string, unknown> | null | undefined,
  ...paths: string[]
): string {
  for (const path of paths) {
    const value = nestedRead(payload, path);
    if (value !== undefined && value !== null && value !== "") return String(value);
  }
  return "—";
}

export type MediaSubmissionSummary = {
  fileUrl: string | null;
  typeLabel: string;
  angle: string;
  altText: string;
  operationIntent: string;
  productId: string | null;
  storagePath: string | null;
};

/** Extract governed media identity from a catalogue_media_submissions payload — no invented facts. */
export function summarizeMediaSubmissionPayload(
  payload: Record<string, unknown> | null | undefined,
): MediaSubmissionSummary {
  const fileUrl = readMediaPayloadField(payload, "file_url", "fileUrl");
  const typeRaw = readMediaPayloadField(payload, "type");
  const typeLabel = typeRaw === "—" ? "—" : mediaTypeLabel(typeRaw);
  const angle = readMediaPayloadField(payload, "angle");
  const altText = readMediaPayloadField(payload, "alt_text", "altText");
  const operationIntent = readMediaPayloadField(payload, "operation_intent", "operationIntent");
  const productIdRaw = readMediaPayloadField(payload, "product_id", "productId");
  const productId = productIdRaw === "—" ? null : productIdRaw;
  const storagePathRaw = readMediaPayloadField(payload, "storage_path", "storagePath");
  const storagePath = storagePathRaw === "—" ? null : storagePathRaw;

  return {
    fileUrl: fileUrl === "—" ? null : fileUrl,
    typeLabel,
    angle,
    altText,
    operationIntent,
    productId,
    storagePath,
  };
}

export function isDisplayableMediaUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  return /^https?:\/\//i.test(url.trim());
}

/** Returns url only when it passes isDisplayableMediaUrl — fail-closed for DOM href/src binding. */
export function safeDisplayableMediaUrl(url: string | null | undefined): string | null {
  if (!isDisplayableMediaUrl(url)) return null;
  return url.trim();
}

export function formatSubmissionAge(dateStr?: string | null): string {
  if (!dateStr) return "Submitted recently";
  const ms = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.max(1, Math.floor(ms / 60000));
  if (minutes < 60) return `Submitted ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Submitted ${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `Submitted ${days} day${days === 1 ? "" : "s"} ago`;
}

export function formatSubmitterDisplay(opts: {
  submitter_name?: string | null;
  submitter_email?: string | null;
  submitted_by?: string | null;
}): string {
  return opts.submitter_name || opts.submitter_email || opts.submitted_by || "Unknown";
}

/** Payload-only product identity for review surfaces — never fall back to target_record_id. */
export function mediaSubmissionProductLabel(productId: string | null | undefined): string {
  const id = productId?.trim();
  return id ? id : "(unlinked)";
}

export function shouldShowMediaReviewEmptyState(opts: {
  loading: boolean;
  loadError: string | null;
  itemCount: number;
}): boolean {
  if (opts.loading || opts.loadError) return false;
  return opts.itemCount === 0;
}

/** Count uploads where both storage and DB insert succeeded (direct-write path). */
export function countCompletedMediaUploads(
  outcomes: ReadonlyArray<{ storageOk: boolean; insertOk: boolean }>,
): number {
  return outcomes.filter((o) => o.storageOk && o.insertOk).length;
}
