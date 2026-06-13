import type {
  MediaAsset,
  MediaAssetRequirement,
  MediaAssetType,
  MediaReadinessResult,
  MediaAssetSlotStatus,
  ProductMediaContext,
  ProductMediaProfile,
} from "./types";
import {
  optionalProfileSlots,
  profileSlots,
  requiredProfileSlots,
} from "@/features/productTruth/readinessProfiles";

function norm(s: string | null | undefined): string {
  return String(s ?? "").trim().toLowerCase();
}

export function detectProductMediaProfile(product: ProductMediaContext): ProductMediaProfile {
  const cat = norm(product.category);
  const sub = norm(product.subcategory);
  const pc = norm(product.productClass);
  const pt = norm(product.productType);

  if (pc.includes("gift_hamper") || cat.includes("hamper") || pt.includes("hamper")) {
    return "hamper";
  }
  if (pc.includes("export") || cat.includes("export") || pt.includes("export")) {
    return "export_pack";
  }
  if (
    pc.includes("gift") ||
    pc.includes("ready_pack") ||
    sub.includes("box") ||
    sub.includes("acrylic") ||
    pt.includes("box") ||
    pt.includes("pack")
  ) {
    return "gift_box";
  }
  if (
    cat.includes("baklawa") ||
    sub.includes("pyramid") ||
    sub.includes("roll") ||
    pt.includes("baklawa") ||
    sub.includes("baklawa")
  ) {
    return "baklawa_small_sweets";
  }
  return "general";
}

function toRequirement(slot: {
  type: MediaAssetType;
  label: string;
  requiredForCatalogue: boolean;
  requiredForCentralSync: boolean;
}): MediaAssetRequirement {
  return {
    type: slot.type,
    label: slot.label,
    requiredForCatalogue: slot.requiredForCatalogue,
    requiredForCentralSync: slot.requiredForCentralSync,
  };
}

export function getRequiredMediaAssets(product: ProductMediaContext): MediaAssetRequirement[] {
  const profile = detectProductMediaProfile(product);
  return requiredProfileSlots(profile).map(toRequirement);
}

export function getOptionalMediaAssets(product: ProductMediaContext): MediaAssetRequirement[] {
  const profile = detectProductMediaProfile(product);
  return optionalProfileSlots(profile).map(toRequirement);
}

function assetForType(assets: MediaAsset[], type: MediaAssetType): MediaAsset | undefined {
  return assets.find((a) => a.type === type && a.url);
}

function isApproved(asset: MediaAsset | undefined): boolean {
  if (!asset?.url) return false;
  if (asset.status === "rejected") return false;
  return asset.status === "approved";
}

export function getMissingMediaAssets(
  product: ProductMediaContext,
  mediaAssets: MediaAsset[],
): MediaAssetType[] {
  const requirements = getRequiredMediaAssets(product);
  return requirements
    .filter((req) => {
      const asset = assetForType(mediaAssets, req.type);
      return !asset?.url || !isApproved(asset);
    })
    .map((r) => r.type);
}

export function calculateMediaScore(
  product: ProductMediaContext,
  mediaAssets: MediaAsset[],
): { score: number; maxScore: number } {
  const requirements = getRequiredMediaAssets(product);
  const maxScore = requirements.length;
  let score = 0;
  for (const req of requirements) {
    const asset = assetForType(mediaAssets, req.type);
    if (asset?.url && isApproved(asset)) score += 1;
  }
  return { score, maxScore };
}

export function selectApprovedImageUrlsForCentral(mediaAssets: MediaAsset[]): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const a of mediaAssets) {
    if (!a.url || !isApproved(a)) continue;
    if (seen.has(a.url)) continue;
    seen.add(a.url);
    urls.push(a.url);
  }
  return urls;
}

export function canPublishMedia(
  product: ProductMediaContext,
  mediaAssets: MediaAsset[],
): boolean {
  return evaluateMediaReadiness(product, mediaAssets).canPublishMedia;
}

export function canSyncMediaToCentral(
  product: ProductMediaContext,
  mediaAssets: MediaAsset[],
): boolean {
  return evaluateMediaReadiness(product, mediaAssets).canSyncMediaToCentral;
}

function buildSlot(
  req: MediaAssetRequirement,
  asset: MediaAsset | undefined,
  required: boolean,
): MediaAssetSlotStatus {
  const present = !!asset?.url;
  const approved = isApproved(asset);
  return {
    type: req.type,
    label: req.label,
    required,
    requiredForCentralSync: req.requiredForCentralSync,
    present,
    approved,
    url: asset?.url ?? null,
    status: !present
      ? "missing"
      : approved
        ? "approved"
        : asset?.status === "pending_approval"
          ? "pending_approval"
          : "draft",
  };
}

export function evaluateMediaReadiness(
  product: ProductMediaContext,
  mediaAssets: MediaAsset[],
): MediaReadinessResult {
  const profile = detectProductMediaProfile(product);
  const required = requiredProfileSlots(profile).map(toRequirement);
  const optional = optionalProfileSlots(profile).map(toRequirement);
  const isLegacy = !!product.isLegacy;

  const requiredSlots = required.map((req) =>
    buildSlot(req, assetForType(mediaAssets, req.type), true),
  );
  const optionalSlots = optional.map((req) =>
    buildSlot(req, assetForType(mediaAssets, req.type), false),
  );
  const slots = [...requiredSlots, ...optionalSlots];

  const missingAssets = requiredSlots
    .filter((s) => !s.present || !s.approved)
    .map((s) => s.type);
  const blockers: string[] = [];

  for (const slot of requiredSlots) {
    if (!slot.present) {
      blockers.push(`Missing ${slot.label}`);
    } else if (!slot.approved) {
      blockers.push(`${slot.label} — draft pending approval`);
    }
  }

  const hasPendingAi = mediaAssets.some(
    (a) => a.source === "ai_generated" && a.status !== "approved" && a.url,
  );
  if (hasPendingAi) {
    blockers.push("AI-generated media must be human-approved before publish");
  }

  const { score, maxScore } = calculateMediaScore(product, mediaAssets);
  const approvedImageUrls = selectApprovedImageUrlsForCentral(mediaAssets);

  const catalogueReady = missingAssets.length === 0 && !hasPendingAi;
  const centralReady = catalogueReady && approvedImageUrls.length > 0;

  if (isLegacy && missingAssets.length > 0) {
    blockers.push("Legacy product — complete required media for catalogue publish");
  }

  return {
    profile,
    score,
    maxScore,
    requiredAssets: required.map((r) => r.type),
    slots,
    missingAssets,
    blockers: isLegacy && score === 0 ? ["Legacy product — media incomplete"] : blockers,
    canPublishMedia: isLegacy ? score > 0 : catalogueReady,
    canSyncMediaToCentral: centralReady,
    approvedImageUrls,
    isLegacy,
  };
}

export { profileSlots };
