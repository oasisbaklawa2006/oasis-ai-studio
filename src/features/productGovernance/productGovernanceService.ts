import type { GovernanceActionResult, ProductDeleteAssessment } from "./types";

/** Current Core metadata has no product archive/delete RPC. Do not fabricate write authority. */
export const PRODUCT_ARCHIVE_AVAILABLE = false;
export const PRODUCT_DELETE_AVAILABLE = false;
const UNAVAILABLE =
  "Product archive/deletion is unavailable in Core. Contact the administrator for the governed lifecycle action.";
export async function assessProductDeleteEligibility(
  _productId: string,
): Promise<ProductDeleteAssessment> {
  return { eligible: false, blockers: [UNAVAILABLE] };
}
export async function archiveProduct(_productId: string): Promise<GovernanceActionResult> {
  return { ok: false, message: UNAVAILABLE };
}
export async function permanentlyDeleteProduct(
  _productId: string,
): Promise<GovernanceActionResult> {
  return { ok: false, message: UNAVAILABLE };
}
export function permanentDeleteConfirmationPhrase(sku: string): string {
  return `DELETE ${sku.trim()}`;
}
