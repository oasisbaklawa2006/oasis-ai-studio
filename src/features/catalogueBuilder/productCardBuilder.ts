import type { ProductMediaRow } from "@/features/mediaReadiness/mediaAssetsFromForm";
import {
  mediaAssetsFromSources,
  productMediaContextFromForm,
} from "@/features/mediaReadiness/mediaAssetsFromForm";
import { evaluateMediaReadiness } from "@/features/mediaReadiness/mediaReadinessEngine";
import { productDisplayName } from "@/features/productMaster/productListModel";
import {
  type MoqRuleRow,
  mapMoqRules,
  mapPricingRules,
  type PricingRuleRow,
} from "@/features/productTruth/channelAuthorityMappers";
import { resolveProductCardHeroMeta } from "@/lib/productImage";
import { deriveComplianceApprovedForReadiness } from "@/shared/ai/compliancePersistence";
import { evaluateCataloguePublishability } from "./cataloguePublishability";
import { applyPriceVisibilityToCard } from "./priceVisibility";
import type { CatalogueCollectionItemRow, CatalogueProductCard } from "./types";

function moqLabelFromProduct(
  product: Record<string, unknown>,
  moqRules: ReturnType<typeof mapMoqRules>,
  channel?: string | null,
): string | null {
  const moqText = product.moq_text;
  if (moqText && String(moqText).trim()) return String(moqText).trim();

  const moqValue = product.moq_value;
  if (moqValue != null && String(moqValue).trim() !== "") {
    const uom = product.moq_uom ? ` ${product.moq_uom}` : "";
    return `${moqValue}${uom}`.trim();
  }

  const rule =
    moqRules.find((r) => channel && r.channel === channel) ??
    moqRules.find((r) => r.channel === "b2b") ??
    moqRules[0];

  if (rule?.moqValue != null) {
    const uom = rule.moqUom ? ` ${rule.moqUom}` : "";
    return `${rule.moqValue}${uom}`.trim();
  }

  return null;
}

function pickApprovedPrices(prices: ReturnType<typeof mapPricingRules>, channel?: string | null) {
  const approved = prices.filter((p) => p.priceStatus === "approved");
  const normalizedChannel = channel?.toLowerCase().trim() || null;
  const mrp = approved.find((p) => p.channel.toLowerCase() === "mrp");
  const selling =
    (normalizedChannel
      ? approved.find((p) => p.channel.toLowerCase() === normalizedChannel)
      : null) ??
    approved.find((p) => p.channel.toLowerCase() === "b2b") ??
    approved.find((p) => p.channel.toLowerCase() !== "mrp");
  return {
    mrp: mrp?.mrp ?? mrp?.sellingPrice ?? null,
    sellingPrice: selling?.sellingPrice ?? selling?.mrp ?? null,
  };
}

export type BuildProductCardArgs = {
  product: Record<string, unknown> & { id: string };
  item: CatalogueCollectionItemRow;
  mediaRows?: ProductMediaRow[];
  pricingRows?: PricingRuleRow[];
  moqRows?: MoqRuleRow[];
  catalogueVersionStatus?: string | null;
  channel?: string | null;
};

export function buildCatalogueProductCard(args: BuildProductCardArgs): CatalogueProductCard {
  const { product, item } = args;
  const prices = mapPricingRules(args.pricingRows ?? []);
  const moqRules = mapMoqRules(args.moqRows ?? []);
  const { mrp, sellingPrice } = pickApprovedPrices(prices, args.channel);
  const complianceApproved = deriveComplianceApprovedForReadiness(product);
  const mediaReadiness = evaluateMediaReadiness(
    productMediaContextFromForm(product),
    mediaAssetsFromSources({ form: product, productMediaRows: args.mediaRows }),
  );

  const pub = evaluateCataloguePublishability({
    form: product,
    complianceApproved,
    prices,
    moqRules,
    productMediaRows: args.mediaRows,
    catalogueVersionStatus: args.catalogueVersionStatus ?? null,
  });

  const heroMeta = resolveProductCardHeroMeta(product, args.mediaRows ?? []);

  const base: CatalogueProductCard = {
    productId: product.id,
    name: item.display_name_override?.trim() || productDisplayName(product),
    sku: (product.sku as string | null) ?? null,
    category: (product.category as string | null) ?? null,
    description:
      item.description_override?.trim() ||
      (product.short_description as string | null) ||
      (product.description as string | null) ||
      null,
    imageUrl: heroMeta.url,
    mrp,
    sellingPrice,
    moqLabel: moqLabelFromProduct(product, moqRules, args.channel),
    isFeatured: item.is_featured,
    publishable: pub.publishable,
    blockers: pub.blockers,
    imageApproved: mediaReadiness.canPublishMedia,
    imageWidthPx: heroMeta.widthPx,
    imageHeightPx: heroMeta.heightPx,
  };

  return applyPriceVisibilityToCard(base, item.price_visibility);
}
