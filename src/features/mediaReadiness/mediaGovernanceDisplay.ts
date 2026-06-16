import type { DerivedMediaStatus } from "./mediaAuthorityContract";
import { getMediaGovernanceMode } from "./mediaGovernanceMode";
import type { ProductReadinessResult } from "@/features/productTruth/productReadiness";

export function isTestingMediaGovernance(): boolean {
  return getMediaGovernanceMode() === "testing";
}

/** User-facing media line for Status sidebar / Product Master — no product_media internals. */
export function mediaGovernanceStatusLine(opts: {
  complete?: boolean;
  heroUrl?: string | null;
  derivedStatus?: DerivedMediaStatus | string | null;
}): string {
  if (!isTestingMediaGovernance()) {
    const raw = String(opts.derivedStatus ?? "missing");
    if (raw === "approved") return "Complete";
    if (raw === "pending_approval") return "Pending approval";
    return "Missing";
  }

  const hasHero =
    !!opts.heroUrl?.trim() || opts.derivedStatus === "approved" || opts.complete === true;
  return hasHero ? "Complete" : "Needs hero image";
}

/** Informational label line — never a catalogue readiness blocker in testing mode. */
export function labelStatusInfoLine(status?: string | null): string {
  const value = status?.trim() || "draft";
  if (isTestingMediaGovernance()) {
    return `Label status: ${value} — label designer not part of current catalogue readiness.`;
  }
  return `Label status: ${value}`;
}

export function dimensionMediaCardLabel(readiness: ProductReadinessResult): string {
  const dim = readiness.dimensions.find((d) => d.dimension === "media_status");
  if (!dim) return "—";

  if (isTestingMediaGovernance()) {
    return dim.complete ? "Complete" : "Needs hero image";
  }

  if (dim.complete) return "complete";
  if (dim.badge === "pending_approval") return "pending";
  return "missing";
}

export function productCardMediaNeedLabel(): string {
  return isTestingMediaGovernance() ? "Needs hero image" : "Needs media";
}

export function mediaMissingBlockerLabel(): string {
  return isTestingMediaGovernance() ? "Needs hero image" : "Media missing";
}

export function mediaMissingNote(): string {
  return isTestingMediaGovernance()
    ? "Hero image required"
    : "Approved product_media rows required for catalogue slots";
}

export function dimensionReadinessLabel(
  readiness: ProductReadinessResult,
  dimension: string,
): string {
  if (dimension === "media_status") {
    return dimensionMediaCardLabel(readiness);
  }
  const dim = readiness.dimensions.find((d) => d.dimension === dimension);
  if (!dim) return "—";
  if (dim.complete) return "complete";
  if (dim.badge === "pending_approval") return "pending";
  return "missing";
}
