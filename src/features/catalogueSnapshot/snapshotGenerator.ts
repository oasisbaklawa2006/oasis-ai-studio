import {
  mediaAssetsFromSources,
  productMediaContextFromForm,
} from "@/features/mediaReadiness/mediaAssetsFromForm";
import {
  evaluateMediaReadiness,
  selectApprovedImageUrlsForCentral,
} from "@/features/mediaReadiness/mediaReadinessEngine";
import { evaluatePublicationReadiness } from "@/features/productAuthority/moqLeadTimeReadinessCanonical";
import { evaluatePackagingLabelReadiness } from "@/features/productAuthority/packagingLabelReadinessCanonical";
import { saleTypeFromForm } from "@/features/productAuthority/saleType";
import { buildSnapshotLanguageIntelligence } from "@/features/productIntelligence/snapshotLanguage";
import { serializePackagingHierarchyForSnapshot } from "@/features/productTruth/packagingHierarchyCanonical";
import {
  factualCompositionDraftPayload,
  serializeFactualCompositionForSnapshot,
} from "@/features/productTruth/productFactualCompositionCanonical";
import {
  evaluateProductReadiness,
  productTruthInputFromForm,
} from "@/features/productTruth/productReadiness";
import type { ConversionRule, PackagingHierarchy } from "@/features/productTruth/types";
import type {
  CatalogueSnapshotJson,
  GstClassificationStatus,
  SnapshotGeneratorInput,
} from "./types";

function positiveLeadTimeDays(v: unknown): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function conversionRulesFromHierarchy(hierarchy: PackagingHierarchy): ConversionRule[] {
  const rules: ConversionRule[] = [];
  const piecesPerKg =
    hierarchy.piecesPerKg ?? (hierarchy.gramsPerPiece ? 1000 / hierarchy.gramsPerPiece : null);
  if (piecesPerKg) {
    rules.push({ fromUom: "pcs", toUom: "kg", factor: 1 / piecesPerKg });
    rules.push({ fromUom: "kg", toUom: "pcs", factor: piecesPerKg });
  }
  const kgPerTray = hierarchy.kgPerTray;
  if (kgPerTray != null && kgPerTray > 0) {
    rules.push({ fromUom: "tray", toUom: "kg", factor: kgPerTray });
    rules.push({ fromUom: "kg", toUom: "tray", factor: 1 / kgPerTray });
  }
  const traysPerMc = hierarchy.traysPerMasterCarton;
  if (traysPerMc != null && traysPerMc > 0 && kgPerTray != null && kgPerTray > 0) {
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
  const factual = factualCompositionDraftPayload(input.form);

  return {
    status: manuallyApproved ? "approved" : "manual_review_required",
    gst_classification_status: gstStatus,
    gst_hsn: manuallyApproved ? str(input.form.hsn_code) : null,
    gst_rate: manuallyApproved ? ((input.form.gst_rate as string | number | null) ?? null) : null,
    ingredients: manuallyApproved ? factual.ingredients : null,
    allergen_warnings: manuallyApproved ? factual.allergen_information : null,
    manually_approved: manuallyApproved,
  };
}

export function generateCatalogueSnapshot(input: SnapshotGeneratorInput): CatalogueSnapshotJson {
  const truthInput = productTruthInputFromForm(input.form, {
    complianceApproved: input.complianceApproved,
    complianceMetaPending: input.complianceMetaPending,
    isLegacy: !input.form.sku,
    prices: input.prices,
    moqRules: input.moqRules,
    productMediaRows: input.productMediaRows,
  });

  const readiness = evaluateProductReadiness(truthInput);
  const packaging = truthInput.packaging ?? {};
  const conversionRules = conversionRulesFromHierarchy(packaging);

  const mediaAssets = mediaAssetsFromSources({
    form: input.form,
    productMediaRows: input.productMediaRows,
  });
  const mediaContext = productMediaContextFromForm(input.form);
  const mediaReadiness = evaluateMediaReadiness(mediaContext, mediaAssets);
  const approvedImages = selectApprovedImageUrlsForCentral(mediaAssets);
  const hero = approvedImages[0] ?? str(input.form.hero_image_url);

  const packagingHierarchy = serializePackagingHierarchyForSnapshot(input.form);
  const factualComposition = serializeFactualCompositionForSnapshot(input.form);
  const primaryPack = packagingHierarchy.primary_pack;
  const masterCarton = packagingHierarchy.master_carton;

  const fulfillmentTransform = {
    primary_pack: primaryPack,
    master_carton: masterCarton,
    case_carton: packagingHierarchy.case_carton,
    pieces_per_kg: input.form.pieces_per_kg,
    approximate_piece_weight_g: input.form.approximate_piece_weight_g,
    conversion_rules: conversionRules,
  };

  const pricedChannels = (input.prices ?? [])
    .filter((p) => p.sellingPrice != null || p.mrp != null)
    .map((p) => String(p.channel ?? "").trim())
    .filter(Boolean);
  const point36 = evaluatePublicationReadiness({
    saleType: saleTypeFromForm(input.form),
    moq: input.form,
    channelMoqRules: input.moqRules ?? [],
    pricedChannels,
    productLeadTimeDays: positiveLeadTimeDays(input.form.lead_time_days),
    bomMaxLeadTimeDays: input.bomMaxLeadTimeDays ?? null,
  });

  const aliasRows = input.languageAliasRows ?? [];
  const productAliases = aliasRows
    .map((row) => {
      const alias = String(row.alias ?? row.alias_text ?? "").trim();
      if (!alias) return null;
      return {
        alias,
        alias_type: row.alias_type ?? null,
        source: (row as { source?: string }).source ?? null,
      };
    })
    .filter(
      (row): row is { alias: string; alias_type: string | null; source: string | null } => !!row,
    );

  const point37 = evaluatePackagingLabelReadiness({
    form: input.form,
    saleType: saleTypeFromForm(input.form),
    packagingAuthority: input.packagingAuthority ?? null,
    mediaAssets,
  });

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
    packaging_hierarchy: packagingHierarchy,
    packaging_label_readiness: point37.snapshot,
    factual_composition: factualComposition,
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
    fulfillment_readiness: point36.snapshot,
    language_intelligence: buildSnapshotLanguageIntelligence({
      productId: input.productId,
      officialName: String(input.form.product_name ?? ""),
      aliasRows: input.languageAliasRows,
    }),
    product_aliases: productAliases,
    synced_at: null,
    ready_for_central_sync: readiness.readyForCentralSync && !!input.complianceApproved,
  };
}
