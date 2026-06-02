import type {
  DimensionStatus,
  ProductTruthInput,
  ReadinessBadge,
  ReadinessDimension,
} from "./types";
import { READINESS_DIMENSIONS } from "./types";
import { priceBlocksPublish } from "./channelPricingMoqEngine";
import { validateConversionRuleChain } from "./uomPackagingEngine";
import { evaluateMediaReadiness } from "@/features/mediaReadiness/mediaReadinessEngine";
import { mediaAssetsFromForm, productMediaContextFromForm } from "@/features/mediaReadiness/mediaAssetsFromForm";

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
  if (assets.length > 0) {
    const ctx =
      input.mediaContext ??
      ({
        productName: input.productName,
        isLegacy: input.isLegacy,
      } as import("@/features/mediaReadiness/types").ProductMediaContext);
    const mr = evaluateMediaReadiness(ctx, assets);
    const pending = assets.some(
      (a) => a.url && (a.status === "pending_approval" || a.status === "draft"),
    );
    const complete = mr.canPublishMedia;
    return {
      dimension: "media_status",
      badge: badgeFor(complete, { pending, legacy: input.isLegacy && !complete }),
      complete,
      note: complete ? undefined : mr.blockers[0] ?? "Required media missing or not approved",
    };
  }

  const complete = !!(input.heroImageUrl || input.mediaStatus === "approved");
  const pending = input.mediaStatus === "pending_approval";
  return {
    dimension: "media_status",
    badge: badgeFor(complete, { pending, legacy: input.isLegacy }),
    complete,
    note: complete ? undefined : "Hero image or approved media required",
  };
}

function evalPricing(input: ProductTruthInput): DimensionStatus {
  const prices = input.prices ?? [];
  const approvedPrice = prices.find((p) => p.priceStatus === "approved");
  const pending = prices.some((p) => p.priceStatus === "pending_approval");
  const hasAny = prices.length > 0;
  const complete = !!approvedPrice && !priceBlocksPublish(approvedPrice);
  return {
    dimension: "pricing_status",
    badge: badgeFor(complete, { approved: complete, pending, legacy: input.isLegacy && !hasAny }),
    complete,
    note: complete ? undefined : "Approved channel price required",
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
  const complete = chain.valid && !!(input.packaging?.piecesPerKg || input.packaging?.gramsPerPiece);
  return {
    dimension: "packaging_status",
    badge: badgeFor(complete, { legacy: input.isLegacy }),
    complete,
    note: complete ? undefined : chain.messages[0] ?? "Packaging conversion rules incomplete",
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
    blockers.push("Media missing");
  }
  if (!dimensions.find((d) => d.dimension === "production_mapping_status")?.complete) {
    blockers.push("Production mapping missing");
  }

  dimensions.push(evalCentralSync(input, blockers));

  const completeCount = dimensions.filter((d) => d.complete).length;
  const maxScore = READINESS_DIMENSIONS.length;
  const score = completeCount;

  let nextAction = "Review and approve compliance-sensitive fields";
  if (blockers.includes("Media missing")) nextAction = "Upload hero image or approve media";
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
  },
): ProductTruthInput {
  const mediaAssets = mediaAssetsFromForm(form);
  const mediaContext = productMediaContextFromForm(form);

  return {
    productId: (form.id as string) ?? null,
    productName: (form.product_name as string) ?? null,
    isLegacy: opts?.isLegacy ?? !form.sku,
    heroImageUrl: (form.hero_image_url as string) ?? null,
    mediaStatus: (form.media_status as string) ?? null,
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
    packaging: {
      gramsPerPiece: form.approximate_piece_weight_g
        ? Number(form.approximate_piece_weight_g)
        : null,
      piecesPerKg: form.pieces_per_kg ? Number(form.pieces_per_kg) : form.approximate_piece_weight_g
        ? 1000 / Number(form.approximate_piece_weight_g)
        : 40,
      kgPerTray: 1,
      traysPerMasterCarton: form.master_carton_qty ? Number(form.master_carton_qty) : 8,
      allowPartialPack: false,
      allowPartialCarton: false,
      roundingRule: "nearest",
      tolerancePercent: 0,
    },
    prices: opts?.prices,
    moqRules: opts?.moqRules,
    mediaAssets,
    mediaContext,
  };
}
