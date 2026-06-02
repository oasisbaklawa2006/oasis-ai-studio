import {
  evaluateProductReadiness,
  productTruthInputFromForm,
} from "@/features/productTruth/productReadiness";
import type { ConversionRule, PackagingHierarchy } from "@/features/productTruth/types";
import {
  evaluateMediaReadiness,
  selectApprovedImageUrlsForCentral,
} from "@/features/mediaReadiness/mediaReadinessEngine";
import {
  mediaAssetsFromForm,
  productMediaContextFromForm,
} from "@/features/mediaReadiness/mediaAssetsFromForm";
import type {
  GstClassificationStatus,
  CatalogueSnapshotJson,
  SnapshotGeneratorInput,
} from "./types";

function conversionRulesFromHierarchy(hierarchy: PackagingHierarchy): ConversionRule[] {
  const rules: ConversionRule[] = [];
  const piecesPerKg =
    hierarchy.piecesPerKg ??
    (hierarchy.gramsPerPiece ? 1000 / hierarchy.gramsPerPiece : null);
  if (piecesPerKg) {
    rules.push({ fromUom: "pcs", toUom: "kg", factor: 1 / piecesPerKg });
    rules.push({ fromUom: "kg", toUom: "pcs", factor: piecesPerKg });
  }
  const kgPerTray = hierarchy.kgPerTray ?? 1;
  if (kgPerTray > 0) {
    rules.push({ fromUom: "tray", toUom: "kg", factor: kgPerTray });
    rules.push({ fromUom: "kg", toUom: "tray", factor: 1 / kgPerTray });
  }
  const traysPerMc = hierarchy.traysPerMasterCarton ?? 8;
  if (traysPerMc > 0 && kgPerTray > 0) {
    rules.push({
      fromUom: "master_carton",
      toUom: "kg",
      factor: traysPerMc * kgPerTray,
    });
  }
  return rules;
}

function str(v: unknown): string | null {
  if (v == null || v === "") return null;
  return String(v);
}

function complianceFields(input: SnapshotGeneratorInput): CatalogueSnapshotJson["compliance"] {
  const manuallyApproved = !!input.complianceApproved && !input.complianceMetaPending;
  const gstStatus: GstClassificationStatus = manuallyApproved
    ? "approved"
    : "manual_review_required";

  return {
    status: manuallyApproved ? "approved" : "manual_review_required",
    gst_classification_status: gstStatus,
    gst_hsn: manuallyApproved ? str(input.form.hsn_code) : null,
    gst_rate: manuallyApproved
      ? (input.form.gst_rate as string | number | null) ?? null
      : null,
    ingredients: str(input.form.ingredients),
    allergen_warnings: str(input.form.allergen_information ?? input.form.allergen_warnings),
    manually_approved: manuallyApproved,
  };
}

export function generateCatalogueSnapshot(
  input: SnapshotGeneratorInput,
): CatalogueSnapshotJson {
  const truthInput = productTruthInputFromForm(input.form, {
    complianceApproved: input.complianceApproved,
    complianceMetaPending: input.complianceMetaPending,
    isLegacy: !input.form.sku,
    prices: input.prices,
    moqRules: input.moqRules,
  });

  const readiness = evaluateProductReadiness(truthInput);
  const packaging = truthInput.packaging ?? {};
  const conversionRules = conversionRulesFromHierarchy(packaging);

  const mediaAssets = mediaAssetsFromForm(input.form);
  const mediaContext = productMediaContextFromForm(input.form);
  const mediaReadiness = evaluateMediaReadiness(mediaContext, mediaAssets);
  const approvedImages = selectApprovedImageUrlsForCentral(mediaAssets);
  const hero = approvedImages[0] ?? str(input.form.hero_image_url);

  const primaryPack = {
    type: input.form.primary_pack_type,
    uom: input.form.primary_pack_uom,
    qty_per_pack: input.form.qty_per_pack,
    qty_content_uom: input.form.qty_content_uom,
    pack_label: input.form.pack_label,
  };

  const masterCarton = {
    qty: input.form.master_carton_qty,
    uom: input.form.master_carton_uom,
    weight_kg: input.form.master_carton_weight_kg,
  };

  const fulfillmentTransform = {
    primary_pack: primaryPack,
    master_carton: masterCarton,
    pieces_per_kg: input.form.pieces_per_kg,
    approximate_piece_weight_g: input.form.approximate_piece_weight_g,
    conversion_rules: conversionRules,
  };

  return {
    generated_at: new Date().toISOString(),
    catalogue_product_id: input.productId,
    catalogue_sku_id: str(input.form.sku_id) ?? null,
    identity: {
      sku: str(input.form.sku),
      code: str(input.form.product_code ?? input.form.code),
      name: String(input.form.product_name ?? ""),
      display_name: str(input.form.short_name ?? input.form.display_name),
      category: str(input.form.category),
      subcategory: str(input.form.subcategory),
      division: str(input.form.division ?? input.form.main_department),
      description: str(input.form.description ?? input.form.short_description),
    },
    readiness,
    compliance: complianceFields(input),
    uom_conversion_rules: {
      ...packaging,
      primary_uom: str(input.form.primary_uom),
      retail_uom: str(input.form.retail_uom),
      b2b_uom: str(input.form.b2b_uom),
      rules: conversionRules,
    },
    packaging_hierarchy: {
      primary_pack: primaryPack,
      master_carton: masterCarton,
    },
    channel_rules: input.moqRules ?? [],
    pricing_rules: input.prices ?? [],
    media: {
      hero_image_url: hero,
      approved_image_urls: approvedImages,
      media_status: str(input.form.media_status),
      requirements: mediaReadiness.requiredAssets,
      media_readiness_blockers: mediaReadiness.blockers,
      can_sync_media_to_central: mediaReadiness.canSyncMediaToCentral,
    },
    fulfillment_transform: fulfillmentTransform,
    synced_at: null,
    ready_for_central_sync: readiness.readyForCentralSync && !!input.complianceApproved,
  };
}
