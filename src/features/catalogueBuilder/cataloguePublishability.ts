import { evaluateProductReadiness, productTruthInputFromForm } from "@/features/productTruth/productReadiness";
import { evaluateMediaReadiness } from "@/features/mediaReadiness/mediaReadinessEngine";
import {
  mediaAssetsFromForm,
  productMediaContextFromForm,
} from "@/features/mediaReadiness/mediaAssetsFromForm";
import type { ChannelMoqRule, ChannelPriceRecord } from "@/features/productTruth/types";

export type CataloguePublishabilityResult = {
  publishable: boolean;
  blockers: string[];
  contentOk: boolean;
  mediaOk: boolean;
  pricingOk: boolean;
  approvedOk: boolean;
  syncedOk: boolean;
};

export function evaluateCataloguePublishability(args: {
  form: Record<string, unknown>;
  complianceApproved?: boolean;
  prices?: ChannelPriceRecord[];
  moqRules?: ChannelMoqRule[];
  catalogueVersionStatus?: string | null;
}): CataloguePublishabilityResult {
  const blockers: string[] = [];

  const truthInput = productTruthInputFromForm(args.form, {
    complianceApproved: args.complianceApproved ?? false,
    isLegacy: !args.form.sku,
    prices: args.prices,
    moqRules: args.moqRules,
  });

  const readiness = evaluateProductReadiness(truthInput);
  const media = evaluateMediaReadiness(
    productMediaContextFromForm(args.form),
    mediaAssetsFromForm(args.form),
  );

  const contentOk = !!(args.form.product_name && String(args.form.product_name).trim());
  if (!contentOk) blockers.push("Content missing");

  const mediaOk = media.canPublishMedia;
  if (!mediaOk) blockers.push("Media missing or not approved");

  const pricingDim = readiness.dimensions.find((d) => d.dimension === "pricing_status");
  const pricingOk = !!pricingDim?.complete;
  if (!pricingOk) blockers.push("Pricing missing or not approved");

  const complianceDim = readiness.dimensions.find((d) => d.dimension === "compliance_status");
  const approvedOk = !!complianceDim?.complete && (args.complianceApproved ?? false);
  if (!approvedOk) blockers.push("Compliance not manually approved");

  const syncedOk =
    args.catalogueVersionStatus === "synced" || args.catalogueVersionStatus === "published";
  if (!syncedOk) blockers.push("Not synced to Central (preview only)");

  const publishable =
    contentOk && mediaOk && pricingOk && approvedOk && readiness.readyForCentralSync;

  if (!readiness.readyForCentralSync && publishable === false) {
    for (const b of readiness.blockers) {
      if (!blockers.includes(b)) blockers.push(b);
    }
  }

  return {
    publishable,
    blockers: Array.from(new Set(blockers)),
    contentOk,
    mediaOk,
    pricingOk,
    approvedOk,
    syncedOk,
  };
}
