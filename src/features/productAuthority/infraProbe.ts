import { supabase } from "@/integrations/supabase/client";
import { probeProductMediaBucket } from "./mediaReadiness";

export type InfraCheckStatus = "pass" | "fail" | "partial" | "unknown";

export type RpcProbeResult = {
  status: InfraCheckStatus;
  message: string;
  detail?: string;
};

export type PilotInfraReport = {
  probedAt: string;
  projectRef: string | null;
  mediaBucket: Awaited<ReturnType<typeof probeProductMediaBucket>>;
  generateOasisSku: RpcProbeResult;
  searchProductsWithAliases: RpcProbeResult;
  approveProductDraftRpc: RpcProbeResult;
  rejectProductDraftRpc: RpcProbeResult;
  allRpcsLive: boolean;
};

const MISSING_FN_RE = /could not find the function|function .* does not exist|404/i;

function projectRefFromUrl(): string | null {
  try {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    if (!url) return null;
    const m = url.match(/https:\/\/([^.]+)\.supabase\.co/);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

function classifyRpcResult(
  name: string,
  data: unknown,
  error: { message?: string } | null,
  opts?: { existsOnNotFound?: boolean },
): RpcProbeResult {
  if (!error && data != null) {
    return { status: "pass", message: `${name} RPC responded successfully.` };
  }
  const msg = error?.message ?? "Unknown RPC error";
  if (MISSING_FN_RE.test(msg)) {
    return {
      status: "fail",
      message: `${name} RPC not deployed on this Supabase project.`,
      detail: msg,
    };
  }
  if (opts?.existsOnNotFound && /not found|does not exist|invalid input/i.test(msg)) {
    return {
      status: "pass",
      message: `${name} RPC is deployed (expected validation error on probe).`,
      detail: msg,
    };
  }
  if (/permission|jwt|auth|row-level security/i.test(msg)) {
    return {
      status: "partial",
      message: `${name} RPC exists but probe lacked auth/permission.`,
      detail: msg,
    };
  }
  return { status: "partial", message: `${name} RPC returned: ${msg}`, detail: msg };
}

/** Read-only infra probes for pilot completion (no master writes). */
export async function probePilotInfra(): Promise<PilotInfraReport> {
  const mediaBucket = await probeProductMediaBucket();

  const skuRes = await supabase.rpc("generate_oasis_sku", {
    _division_code: "AS",
    _category_code: "BKL",
    _subcategory_code: "ASS",
    _packaging_code: "LOOSE",
  });
  const generateOasisSku = classifyRpcResult("generate_oasis_sku", skuRes.data, skuRes.error);

  const searchRes = await supabase.rpc("search_products_with_aliases", { _q: "cashew" });
  const searchProductsWithAliases = classifyRpcResult(
    "search_products_with_aliases",
    searchRes.data,
    searchRes.error,
  );

  const probeDraftId = "00000000-0000-0000-0000-000000000001";
  const approveRes = await (supabase as any).rpc("approve_catalogue_product_draft", {
    draft_id: probeDraftId,
  });
  const approveProductDraftRpc = classifyRpcResult(
    "approve_catalogue_product_draft",
    approveRes.data,
    approveRes.error,
    { existsOnNotFound: true },
  );

  const rejectRes = await (supabase as any).rpc("reject_catalogue_product_draft", {
    draft_id: probeDraftId,
    reason: "pilot_infra_probe",
  });
  const rejectProductDraftRpc = classifyRpcResult(
    "reject_catalogue_product_draft",
    rejectRes.data,
    rejectRes.error,
    { existsOnNotFound: true },
  );

  const rpcChecks = [
    generateOasisSku,
    searchProductsWithAliases,
    approveProductDraftRpc,
    rejectProductDraftRpc,
  ];
  const allRpcsLive = rpcChecks.every((c) => c.status === "pass" || c.status === "partial");

  return {
    probedAt: new Date().toISOString(),
    projectRef: projectRefFromUrl(),
    mediaBucket,
    generateOasisSku,
    searchProductsWithAliases,
    approveProductDraftRpc,
    rejectProductDraftRpc,
    allRpcsLive,
  };
}
