import type {
  MediaAsset,
  MediaAssetRequirement,
  MediaAssetType,
  MediaReadinessResult,
  MediaAssetSlotStatus,
  ProductMediaContext,
  ProductMediaProfile,
} from "./types";

const PROFILE_REQUIREMENTS: Record<ProductMediaProfile, MediaAssetRequirement[]> = {
  baklawa_small_sweets: [
    { type: "primary_image", label: "Primary image", requiredForCatalogue: true, requiredForCentralSync: true },
    { type: "pairing_image", label: "Pairing / serve image", requiredForCatalogue: true, requiredForCentralSync: true },
    { type: "close_up_image", label: "Close-up", requiredForCatalogue: true, requiredForCentralSync: true },
  ],
  gift_box: [
    { type: "pack_front_image", label: "Closed pack (front)", requiredForCatalogue: true, requiredForCentralSync: true },
    { type: "open_pack_image", label: "Open pack", requiredForCatalogue: true, requiredForCentralSync: true },
    { type: "primary_image", label: "Primary image", requiredForCatalogue: true, requiredForCentralSync: true },
  ],
  export_pack: [
    { type: "label_front_image", label: "Front label", requiredForCatalogue: true, requiredForCentralSync: true },
    { type: "label_back_image", label: "Back label / barcode", requiredForCatalogue: true, requiredForCentralSync: true },
    { type: "master_carton_image", label: "Master carton", requiredForCatalogue: true, requiredForCentralSync: true },
  ],
  hamper: [
    { type: "hamper_arrangement_image", label: "Full arrangement", requiredForCatalogue: true, requiredForCentralSync: true },
    { type: "close_up_image", label: "Close-up", requiredForCatalogue: true, requiredForCentralSync: true },
    { type: "primary_image", label: "Pack / hero image", requiredForCatalogue: true, requiredForCentralSync: true },
  ],
  general: [
    { type: "primary_image", label: "Primary image", requiredForCatalogue: true, requiredForCentralSync: true },
  ],
};

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

export function getRequiredMediaAssets(product: ProductMediaContext): MediaAssetRequirement[] {
  const profile = detectProductMediaProfile(product);
  return PROFILE_REQUIREMENTS[profile];
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

export function evaluateMediaReadiness(
  product: ProductMediaContext,
  mediaAssets: MediaAsset[],
): MediaReadinessResult {
  const profile = detectProductMediaProfile(product);
  const requirements = PROFILE_REQUIREMENTS[profile];
  const isLegacy = !!product.isLegacy;

  const slots: MediaAssetSlotStatus[] = requirements.map((req) => {
    const asset = assetForType(mediaAssets, req.type);
    const present = !!asset?.url;
    const approved = isApproved(asset);
    return {
      type: req.type,
      label: req.label,
      required: req.requiredForCatalogue,
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
  });

  const missingAssets = slots.filter((s) => !s.present || !s.approved).map((s) => s.type);
  const blockers: string[] = [];

  for (const slot of slots) {
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
    requiredAssets: requirements.map((r) => r.type),
    slots,
    missingAssets,
    blockers: isLegacy && score === 0 ? ["Legacy product — media incomplete"] : blockers,
    canPublishMedia: isLegacy ? score > 0 : catalogueReady,
    canSyncMediaToCentral: centralReady,
    approvedImageUrls,
    isLegacy,
  };
}
