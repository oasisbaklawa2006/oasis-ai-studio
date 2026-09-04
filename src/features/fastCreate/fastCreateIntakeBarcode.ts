import { supabase } from "@/integrations/supabase/client";

type ClaimIntakeBarcodeRpc = (
  name: "catalogue_claim_intake_barcode",
  args: { p_barcode: string; p_exclude_product_id?: string | null },
) => Promise<{ data: string | null; error: { message: string } | null }>;

type SubmitProductDraftRpc = (
  name: "submit_catalogue_product_draft_v1",
  args: {
    p_operation: "create" | "update" | "delete_request";
    p_target_record_id: string | null;
    p_payload: Record<string, unknown>;
  },
) => Promise<{
  data: Array<{ draft_id: string; already_pending: boolean }> | null;
  error: { message: string } | null;
}>;

const claimIntakeBarcodeRpc = supabase.rpc.bind(supabase) as unknown as ClaimIntakeBarcodeRpc;
const submitProductDraftRpc = supabase.rpc.bind(supabase) as unknown as SubmitProductDraftRpc;

export function readIntakeBarcode(extraFormPatch?: Record<string, unknown>): string | null {
  const raw = extraFormPatch?.intake_barcode;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed || null;
}

/** Fail-closed Core claim before direct product writes. */
export async function claimReviewedIntakeBarcode(
  barcode: string,
  excludeProductId?: string | null,
): Promise<string> {
  const { data, error } = await claimIntakeBarcodeRpc("catalogue_claim_intake_barcode", {
    p_barcode: barcode,
    p_exclude_product_id: excludeProductId ?? null,
  });
  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error("Intake barcode claim failed — no barcode returned from Core authority.");
  }
  return data;
}

export async function submitFastCreateProductDraft(
  payload: Record<string, unknown>,
  operation: "create" | "update" = "create",
  targetRecordId: string | null = null,
): Promise<{ draftId: string; alreadyPending: boolean }> {
  const { data, error } = await submitProductDraftRpc("submit_catalogue_product_draft_v1", {
    p_operation: operation,
    p_target_record_id: targetRecordId,
    p_payload: payload,
  });
  if (error) {
    throw new Error(error.message);
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.draft_id) {
    throw new Error("Product draft submit failed — Core authority returned no draft id.");
  }
  return { draftId: row.draft_id, alreadyPending: row.already_pending ?? false };
}

export function withReviewedIntakeBarcode<T extends Record<string, unknown>>(
  payload: T,
  intakeBarcode: string | null,
): T & { intake_barcode?: string } {
  if (!intakeBarcode) return payload;
  return { ...payload, intake_barcode: intakeBarcode };
}
