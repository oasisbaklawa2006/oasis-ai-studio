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
