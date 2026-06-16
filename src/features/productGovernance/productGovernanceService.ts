import { supabase } from "@/integrations/supabase/client";
import type { GovernanceActionResult, ProductDeleteAssessment } from "./types";

function parseAssessment(data: unknown): ProductDeleteAssessment {
  const row = (data ?? {}) as Record<string, unknown>;
  const blockers = Array.isArray(row.blockers)
    ? row.blockers.map(String)
    : [];
  return {
    eligible: !!row.eligible,
    blockers,
    sku: row.sku != null ? String(row.sku) : null,
    product_name: row.product_name != null ? String(row.product_name) : null,
  };
}

function parseActionResult(data: unknown): GovernanceActionResult {
  const row = (data ?? {}) as Record<string, unknown>;
  const blockers = Array.isArray(row.blockers)
    ? row.blockers.map(String)
    : undefined;
  return {
    ok: !!row.ok,
    message: String(row.message ?? (row.ok ? "OK" : "Request failed")),
    blockers,
    sku: row.sku != null ? String(row.sku) : undefined,
  };
}

export async function assessProductDeleteEligibility(
  productId: string,
): Promise<ProductDeleteAssessment> {
  const { data, error } = await supabase.rpc("assess_product_delete_eligibility", {
    _product_id: productId,
  });

  if (error) {
    return {
      eligible: false,
      blockers: [error.message],
    };
  }

  return parseAssessment(data);
}

export async function archiveProduct(productId: string): Promise<GovernanceActionResult> {
  const { data, error } = await supabase.rpc("archive_product", {
    _product_id: productId,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  return parseActionResult(data);
}

export async function permanentlyDeleteProduct(
  productId: string,
): Promise<GovernanceActionResult> {
  const { data, error } = await supabase.rpc("permanently_delete_product", {
    _product_id: productId,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  return parseActionResult(data);
}

export function permanentDeleteConfirmationPhrase(sku: string): string {
  return `DELETE ${sku.trim()}`;
}
