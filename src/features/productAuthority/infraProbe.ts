import { supabase } from "@/integrations/supabase/client";
import { PRODUCTION_CAPABILITIES } from "@/lib/productionCapabilities";
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

  const searchProductsWithAliases: RpcProbeResult =
    PRODUCTION_CAPABILITIES.searchProductsWithAliasesRpc
      ? { status: "unknown", message: "Alias search RPC requires a live probe." }
      : {
          status: "fail",
          message:
            "search_products_with_aliases is not deployed; the governed client fallback is active.",
        };

  const approveProductDraftRpc: RpcProbeResult = {
    status: "unknown",
    message: "Write-capable approval RPC is intentionally not invoked by this read-only probe.",
  };
  const rejectProductDraftRpc: RpcProbeResult = {
    status: "unknown",
    message: "Write-capable rejection RPC is intentionally not invoked by this read-only probe.",
  };

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
