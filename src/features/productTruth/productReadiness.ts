import type {
  DimensionStatus,
  ProductTruthInput,
  ReadinessBadge,
  ReadinessDimension,
} from "./types";
import { READINESS_DIMENSIONS } from "./types";
import { priceBlocksPublish } from "./channelPricingMoqEngine";
import { packagingHierarchyFromForm } from "./packagingHierarchyFromForm";
import { validateConversionRuleChain } from "./uomPackagingEngine";
import { evaluateMediaReadiness } from "@/features/mediaReadiness/mediaReadinessEngine";
import {
  authoritativeMediaAssets,
  deriveMediaStatusFromRows,
} from "@/features/mediaReadiness/mediaAuthorityContract";
import {
  mediaMissingBlockerLabel,
  mediaMissingNote,
} from "@/features/mediaReadiness/mediaGovernanceDisplay";
import { resolveProductHeroUrl } from "@/lib/productImage";
import { isPackBasedSelling } from "@/features/productAuthority/packLogic";
import {
  productMediaContextFromForm,
  type ProductMediaRow,
} from "@/features/mediaReadiness/mediaAssetsFromForm";
import type { MediaAsset } from "@/features/mediaReadiness/types";

export type ProductReadinessResult = {
  score: number;
  maxScore: number;
  missingFields: string[];
  blockers: string[];
  nextAction: string;
  readyForCentralSync: boolean;
  dimensions: DimensionStatus[];
  badges: ReadinessBadge[];
  isLegacy: boolean;
};

function badgeFor(
  complete: boolean,
  opts: { approved?: boolean; pending?: boolean; ai?: boolean; legacy?: boolean; rejected?: boolean },
): ReadinessBadge {
  if (opts.legacy && !complete) return "legacy_incomplete";
  if (opts.rejected) return "rejected";
  if (opts.approved && complete) return "approved";
  if (opts.pending) return "pending_approval";
  if (opts.ai && !complete) return "ai_generated";
  if (complete) return "human_edited";
  return "draft";
}

function evalContent(input: ProductTruthInput): DimensionStatus {
  const complete = !!(input.productName && input.productName.trim());
  return {
    dimension: "content_status",
    badge: badgeFor(complete, { legacy: input.isLegacy }),
    complete,
    note: complete ? undefined : "Product name required",
  };
}

function evalMedia(input: ProductTruthInput): DimensionStatus {
  const assets = input.mediaAssets ?? [];
  const ctx =
    input.mediaContext ??
    ({
      productName: input.productName,
      isLegacy: input.isLegacy,
    } as import("@/features/mediaReadiness/types").ProductMediaContext);

  if (assets.length > 0) {
    const mr = evaluateMediaReadiness(ctx, assets);
    const pending = assets.some(
      (a) => a.url && (a.status === "pending_approval" || a.status === "draft"),
    );
    const complete = mr.canPublishMedia;
    return {
      dimension: "media_status",
      badge: badgeFor(complete, { pending, approved: complete, legacy: input.isLegacy && !complete }),
      complete,
      note: complete ? undefined : mr.blockers[0] ?? mediaMissingNote(),
    };
  }

  const complete = input.mediaStatus === "approved";
  const pending = input.mediaStatus === "pending_approval";
  return {
    dimension: "media_status",
    badge: badgeFor(complete, { pending, legacy: input.isLegacy }),
    complete,
    note: complete ? undefined : mediaMissingNote(),
  };
}

function evalPricing(input: ProductTruthInput): DimensionStatus {
  const prices = input.prices ?? [];
  const approvedPrice = prices.find((p) => p.priceStatus === "approved");
  const pending = prices.some((p) => p.priceStatus === "pending_approval");
  const hasAny = prices.length > 0;
  const channelComplete = !!approvedPrice && !priceBlocksPublish(approvedPrice);
  // Products carry legacy/Central-owned mrp / price_b2b values that this app never writes
  // but must still recognize — otherwise a product with real prices reads "pricing missing".
  const fallbackComplete = !!(input.fallbackPrices?.mrp || input.fallbackPrices?.b2bPrice);
  const complete = channelComplete || fallbackComplete;
  return {
    dimension: "pricing_status",
    badge: badgeFor(complete, { approved: channelComplete, pending, legacy: input.isLegacy && !hasAny }),
    complete,
    note: complete ? undefined : "Approved channel price or product MRP/B2B price required",
  };
}

function evalUom(input: ProductTruthInput): DimensionStatus {
  const complete = !!(input.primaryUom || input.retailUom || input.b2bUom);
  return {
    dimension: "uom_status",
    badge: badgeFor(complete, { legacy: input.isLegacy }),
    complete,
    note: complete ? undefined : "Primary or channel UOM missing",
  };
}

function evalPackaging(input: ProductTruthInput): DimensionStatus {
  const chain = validateConversionRuleChain(input.packaging ?? {});
  // Pack-based products (ready packs, boxes, jars) complete via pack contents —
  // the chain's pcs ↔ kg requirement only applies to loose / weight-based selling.
  const packChainMessages = chain.messages.filter((m) => !m.includes("pcs ↔ kg"));
  const complete = input.packBasedSelling
    ? packChainMessages.length === 0 && !!input.packaging?.pcsPerPack
    : chain.valid && !!(input.packaging?.piecesPerKg || input.packaging?.gramsPerPiece);
  return {
    dimension: "packaging_status",
    badge: badgeFor(complete, { legacy: input.isLegacy }),
    complete,
    note: complete
      ? undefined
      : input.packBasedSelling
        ? packChainMessages[0] ?? "Qty per pack missing"
        : chain.messages[0] ?? "Packaging conversion rules incomplete",
  };
}

function evalCompliance(input: ProductTruthInput): DimensionStatus {
  const hasTax = !!(input.hsnCode && input.gstRate != null && input.gstRate !== "");
  const approved = !!input.complianceApproved && !input.complianceMetaPending;
  const complete = hasTax && approved;
  const pending = input.complianceMetaPending || (!approved && hasTax);
  return {
    dimension: "compliance_status",
    badge: badgeFor(complete, {
      approved,
      pending,
      ai: input.complianceMetaPending,
      legacy: input.isLegacy,
    }),
    complete,
    note: complete
      ? undefined
      : !approved
        ? "GST/HSN require manual approval"
        : "HSN and GST required",
  };
}

function evalProductionMapping(input: ProductTruthInput): DimensionStatus {
  const needsMapping =
    input.mainDepartment === "ready_goods_store" || input.mainDepartment === "packing_assembly";
  const complete =
    !needsMapping ||
    !!(input.productionDepartment || input.mainDepartment === "packing_assembly");
  return {
    dimension: "production_mapping_status",
    badge: badgeFor(complete, { legacy: input.isLegacy }),
    complete,
    note: complete ? undefined : "Production department mapping missing",
  };
}

function evalCentralSync(
  input: ProductTruthInput,
  blockers: string[],
): DimensionStatus {
  const ready = blockers.length === 0;
  return {
    dimension: "central_sync_status",
    badge: ready ? "approved" : input.isLegacy ? "legacy_incomplete" : "draft",
    complete: ready,
    note: ready ? "Ready for Central sync review" : "Blocked — resolve blockers first",
  };
}

export function evaluateProductReadiness(input: ProductTruthInput): ProductReadinessResult {
  const dimensions: DimensionStatus[] = [
    evalContent(input),
    evalMedia(input),
    evalPricing(input),
    evalUom(input),
    evalPackaging(input),
    evalCompliance(input),
    evalProductionMapping(input),
  ];

  const missingFields: string[] = [];
  const blockers: string[] = [];

  for (const d of dimensions) {
    if (!d.complete && d.note) missingFields.push(d.note);
  }

  if (!dimensions.find((d) => d.dimension === "compliance_status")?.complete) {
    blockers.push("Compliance not approved / manual-reviewed");
  }
  if (!dimensions.find((d) => d.dimension === "pricing_status")?.complete) {
    blockers.push("Pricing missing or pending approval");
  }
  if (!dimensions.find((d) => d.dimension === "uom_status")?.complete) {
    blockers.push("UOM missing");
  }
  if (!dimensions.find((d) => d.dimension === "packaging_status")?.complete) {
    blockers.push("Packaging conversion rules missing");
  }
  if (!dimensions.find((d) => d.dimension === "media_status")?.complete) {
    blockers.push(mediaMissingBlockerLabel());
  }
  if (!dimensions.find((d) => d.dimension === "production_mapping_status")?.complete) {
    blockers.push("Production mapping missing");
  }

  dimensions.push(evalCentralSync(input, blockers));

  const completeCount = dimensions.filter((d) => d.complete).length;
  const maxScore = READINESS_DIMENSIONS.length;
  const score = completeCount;

  let nextAction = "Review and approve compliance-sensitive fields";
  if (blockers.includes(mediaMissingBlockerLabel())) {
    nextAction = mediaMissingBlockerLabel() === "Needs hero image"
      ? "Upload hero image"
      : "Upload hero image or approve media";
  }
  else if (blockers.includes("UOM missing")) nextAction = "Configure primary UOM on UOM tab";
  else if (blockers.includes("Packaging conversion rules missing")) {
    nextAction = "Complete packaging hierarchy (pcs/kg/tray/carton)";
  } else if (blockers.includes("Pricing missing or pending approval")) {
    nextAction = "Approve channel pricing";
  } else if (blockers.length === 0) nextAction = "Ready — queue for Central sync";

  const badges = Array.from(new Set(dimensions.map((d) => d.badge)));

  return {
    score,
    maxScore,
    missingFields,
    blockers,
    nextAction,
    readyForCentralSync: blockers.length === 0,
    dimensions,
    badges,
    isLegacy: !!input.isLegacy,
  };
}

export function productTruthInputFromForm(
  form: Record<string, unknown>,
  opts?: {
    complianceApproved?: boolean;
    complianceMetaPending?: boolean;
    isLegacy?: boolean;
    prices?: ProductTruthInput["prices"];
    moqRules?: ProductTruthInput["moqRules"];
    productMediaRows?: ProductMediaRow[];
    /** Pre-computed authority assets (from buildProductReadinessSnapshot). */
    mediaAssets?: MediaAsset[];
    derivedMediaStatus?: string;
  },
): ProductTruthInput {
  const mediaRows = opts?.productMediaRows ?? [];
  const mediaAssets =
    opts?.mediaAssets ?? authoritativeMediaAssets(mediaRows, form);
  const fallbackHeroUrl = resolveProductHeroUrl(form);
  const derivedStatus =
    opts?.derivedMediaStatus ??
    deriveMediaStatusFromRows(mediaRows, { fallbackHeroUrl });
  const mediaContext = productMediaContextFromForm(form);

  return {
    productId: (form.id as string) ?? null,
    productName: (form.product_name as string) ?? null,
    isLegacy: opts?.isLegacy ?? !form.sku,
    heroImageUrl: (form.hero_image_url as string) ?? null,
    mediaStatus: derivedStatus ?? (form.media_status as string) ?? null,
    hsnCode: (form.hsn_code as string) ?? null,
    gstRate: (form.gst_rate as string | number) ?? null,
    ingredients: (form.ingredients as string) ?? null,
    complianceApproved: opts?.complianceApproved ?? false,
    complianceMetaPending: opts?.complianceMetaPending ?? false,
    primaryUom: (form.primary_uom as string) ?? null,
    retailUom: (form.retail_uom as string) ?? null,
    b2bUom: (form.b2b_uom as string) ?? null,
    mainDepartment: (form.main_department as string) ?? null,
    productionDepartment: (form.production_department as string) ?? null,
    bomRequired: !!form.bom_required,
    packaging: packagingHierarchyFromForm(form),
    prices: opts?.prices,
    moqRules: opts?.moqRules,
    mediaAssets,
    mediaContext,
    fallbackPrices: {
      mrp: positiveNumOrNull(form.mrp),
      b2bPrice:
        positiveNumOrNull(form.b2b_price) ??
        positiveNumOrNull(form.price_b2b) ??
        positiveNumOrNull(form.b2b_price_inr),
      exportPrice: positiveNumOrNull(form.export_price),
    },
    packBasedSelling: isPackBasedSelling(
      (form.primary_uom as string) ?? (form.retail_uom as string) ?? null,
    ),
  };
}

function positiveNumOrNull(v: unknown): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}
