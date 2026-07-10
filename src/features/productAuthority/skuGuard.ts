/** 5-SKU pilot authority set (Batch 001 anchors). */
export const PILOT_SKUS = [
  "OAS-AS-BKL-0024",
  "OAS-AS-BKL-0020",
  "OAS-AS-BKL-0001",
  "OAS-AS-BKL-0025",
  "OAS-AS-BKL-0007",
] as const;

export type PilotSkuCode = (typeof PILOT_SKUS)[number];

export const PILOT_SKU_LABELS: Record<PilotSkuCode, string> = {
  "OAS-AS-BKL-0024": "Mor Pistachio Durum",
  "OAS-AS-BKL-0020": "Tart Cashew",
  "OAS-AS-BKL-0001": "Cashew Kitta",
  "OAS-AS-BKL-0025": "Coconut Durum",
  "OAS-AS-BKL-0007": "Cashew Finger",
};

const DRAFT_SKU_RE = /^DRAFT-/i;
const OAS_FC_FALLBACK_RE = /^OAS-FC-/i;
const OAS_SKU_RE = /^OAS-[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+-\d{4}$/;

export function isDraftSku(sku: string | null | undefined): boolean {
  if (!sku) return false;
  return DRAFT_SKU_RE.test(String(sku).trim());
}

export function isStructuredOasisSku(sku: string | null | undefined): boolean {
  if (!sku) return false;
  const s = String(sku).trim();
  if (isDraftSku(s)) return false;
  if (OAS_FC_FALLBACK_RE.test(s)) return false;
  return OAS_SKU_RE.test(s) || (s.startsWith("OAS-") && s.length >= 12);
}

export function isPilotSku(sku: string | null | undefined): boolean {
  if (!sku) return false;
  return PILOT_SKUS.includes(String(sku).trim() as PilotSkuCode);
}

/**
 * Packaging segment (5th of 6 dash-separated parts) of a structured
 * OAS-DIV-CAT-SUBCAT-PKG-SEQ SKU. Deliberately looser than isStructuredOasisSku's regex —
 * this only extracts a segment for cross-checking, it doesn't gate SKU validity.
 */
export function skuPackagingSegment(sku: string | null | undefined): string | null {
  const parts = String(sku ?? "").trim().toUpperCase().split("-");
  return parts.length === 6 && parts[0] === "OAS" ? parts[4] : null;
}

export type SkuGuardResult = { ok: true; sku: string } | { ok: false; reason: string };

/**
 * Enforce structured SKU for direct master writes.
 * Pilot SKUs must never use DRAFT-* placeholders.
 */
export function assertStructuredSkuForSave(
  sku: string | null | undefined,
  opts?: { pilotOnly?: boolean; allowExisting?: boolean },
): SkuGuardResult {
  const s = String(sku ?? "").trim();
  if (!s) {
    return {
      ok: false,
      reason:
        "SKU is required. Use SkuBuilder or generate_oasis_sku RPC — placeholder SKUs are blocked.",
    };
  }
  if (isDraftSku(s)) {
    return {
      ok: false,
      reason: `Draft placeholder SKU "${s}" cannot be saved. Assign a structured OAS SKU before approval.`,
    };
  }
  if (!isStructuredOasisSku(s)) {
    return {
      ok: false,
      reason: `SKU "${s}" is not a structured Oasis SKU (expected OAS-… format).`,
    };
  }
  if (opts?.pilotOnly && !isPilotSku(s)) {
    return { ok: false, reason: `SKU "${s}" is outside the 5-SKU pilot allowlist.` };
  }
  return { ok: true, sku: s };
}

export function blockPilotApprovalMessage(sku: string | null | undefined): string | null {
  if (!isPilotSku(sku) && !sku) return null;
  if (isDraftSku(sku)) {
    return "Pilot approval blocked: DRAFT-* SKU must be replaced with structured OAS SKU.";
  }
  if (sku && !isStructuredOasisSku(sku)) {
    return "Pilot approval blocked: SKU must match structured OAS format.";
  }
  return null;
}
