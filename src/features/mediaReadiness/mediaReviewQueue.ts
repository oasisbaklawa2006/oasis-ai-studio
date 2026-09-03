import { supabase } from "@/integrations/supabase/client";

export type MediaReviewStatus = "pending_approval" | "approved" | "rejected";

export type MediaReviewQueueItem = {
  id: string;
  source: "catalogue_submission" | "product_media";
  status: MediaReviewStatus;
  productId: string | null;
  productName: string | null;
  productSku: string | null;
  mediaType: string | null;
  submittedAt: string | null;
  submittedBy: string | null;
  payload?: Record<string, unknown> | null;
};

const PENDING_PRODUCT_MEDIA = new Set(["raw", "pending", "pending_approval", "draft"]);

type CatalogueMediaSubmissionRow = {
  id: string;
  status: MediaReviewStatus;
  payload?: Record<string, unknown> | null;
  submitted_at?: string | null;
  submitted_by?: string | null;
};

type ProductMediaQueueRow = {
  id: string;
  status: string | null;
  media_type: string | null;
  product_id: string | null;
  created_at: string | null;
  products: { product_name?: string; sku?: string } | null;
};

function readPayloadField(
  payload: Record<string, unknown> | null | undefined,
  ...keys: string[]
): string | null {
  if (!payload) return null;
  for (const key of keys) {
    if (!Object.hasOwn(payload, key)) continue;
    const value = payload[key];
    if (value != null && value !== "") return String(value);
  }
  return null;
}

function mapSubmissionRow(row: CatalogueMediaSubmissionRow): MediaReviewQueueItem {
  const payload = row.payload ?? null;
  return {
    id: row.id,
    source: "catalogue_submission",
    status: row.status,
    productId: readPayloadField(payload, "product_id", "productId"),
    productName: readPayloadField(payload, "product_name", "productName"),
    productSku: readPayloadField(payload, "sku"),
    mediaType: readPayloadField(payload, "media_type", "type", "role"),
    submittedAt: row.submitted_at ?? null,
    submittedBy: row.submitted_by ?? null,
    payload,
  };
}

function mapPendingProductMediaRow(row: ProductMediaQueueRow): MediaReviewQueueItem | null {
  const status = String(row.status ?? "").toLowerCase();
  if (!PENDING_PRODUCT_MEDIA.has(status)) return null;
  const product = row.products;
  return {
    id: row.id,
    source: "product_media",
    status: "pending_approval",
    productId: row.product_id ?? null,
    productName: product?.product_name ?? null,
    productSku: product?.sku ?? null,
    mediaType: row.media_type ?? null,
    submittedAt: row.created_at ?? null,
    submittedBy: null,
    payload: null,
  };
}

async function fetchCatalogueSubmissions(): Promise<MediaReviewQueueItem[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic draft table
  const { data } = await (supabase as any)
    .from("catalogue_media_submissions")
    .select("*")
    .in("status", ["pending_approval", "approved", "rejected"])
    .order("submitted_at", { ascending: false });
  return (data ?? []).map((row: CatalogueMediaSubmissionRow) => mapSubmissionRow(row));
}

async function fetchPendingProductMediaRows(): Promise<MediaReviewQueueItem[]> {
  const { data } = await supabase
    .from("product_media")
    .select("id, status, media_type, product_id, created_at, products(product_name, sku)")
    .order("created_at", { ascending: false });
  return (data ?? [])
    .map((row) => mapPendingProductMediaRow(row as ProductMediaQueueRow))
    .filter((item): item is MediaReviewQueueItem => item != null);
}

function sortBySubmittedAtDesc(items: MediaReviewQueueItem[]): MediaReviewQueueItem[] {
  return [...items].sort((a, b) => {
    const aTime = a.submittedAt ? Date.parse(a.submittedAt) : 0;
    const bTime = b.submittedAt ? Date.parse(b.submittedAt) : 0;
    return bTime - aTime;
  });
}

export async function fetchMediaReviewQueue(): Promise<MediaReviewQueueItem[]> {
  const [submissions, productMedia] = await Promise.all([
    fetchCatalogueSubmissions(),
    fetchPendingProductMediaRows(),
  ]);
  return sortBySubmittedAtDesc([...submissions, ...productMedia]);
}

export function filterMediaReviewQueue(
  items: MediaReviewQueueItem[],
  status: MediaReviewStatus,
): MediaReviewQueueItem[] {
  return items.filter((item) => item.status === status);
}

export async function approveMediaSubmission(draftId: string): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- governed RPC not in generated types
  const { error } = await (supabase as any).rpc("approve_catalogue_media_submission", {
    draft_id: draftId,
  });
  return error?.message ?? null;
}

export async function rejectMediaSubmission(
  draftId: string,
  reason: string,
): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- governed RPC not in generated types
  const { error } = await (supabase as any).rpc("reject_catalogue_media_submission", {
    draft_id: draftId,
    reason,
  });
  return error?.message ?? null;
}
