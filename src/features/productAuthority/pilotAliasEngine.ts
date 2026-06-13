import { applyCollisionChecks } from "./pilotAliasCollision";
import { PILOT_ALIAS_SEED_PACKS, PILOT_PRODUCT_IDS } from "./pilotAliasSeeds";
import type { PilotAliasSkuBundle, PilotAliasTermSuggestion, PilotReviewStatus } from "./pilotAliasTypes";
import type { PilotSkuCode } from "./skuGuard";
import { PILOT_SKUS } from "./skuGuard";

function termId(sku: PilotSkuCode, aliasText: string, aliasType: string): string {
  return `${sku}::${aliasType}::${aliasText.trim().toLowerCase().replace(/\s+/g, "_")}`;
}

function flattenPack(pack: (typeof PILOT_ALIAS_SEED_PACKS)[number]): PilotAliasTermSuggestion[] {
  const product_id = PILOT_PRODUCT_IDS[pack.sku];
  const all = [
    ...pack.official_and_search,
    ...pack.whatsapp,
    ...pack.phonetic,
    ...pack.sales,
  ];

  return all.map((raw) => ({
    id: termId(pack.sku, raw.alias_text, raw.alias_type),
    sku: pack.sku,
    product_id,
    product_name: pack.product_name,
    alias_text: raw.alias_text,
    alias_type: raw.alias_type,
    channel_scope: raw.channel_scope,
    review_status: "suggested" as PilotReviewStatus,
    collision: { level: "none", reason: "Pending collision scan." },
    source: "authority_preview" as const,
  }));
}

export function buildPilotAliasBundle(sku: PilotSkuCode): PilotAliasSkuBundle {
  const pack = PILOT_ALIAS_SEED_PACKS.find((p) => p.sku === sku);
  if (!pack) throw new Error(`No alias seed pack for ${sku}`);

  const terms = applyCollisionChecks(flattenPack(pack));
  return summarizeBundle(sku, pack.product_name, PILOT_PRODUCT_IDS[sku], terms);
}

export function buildAllPilotAliasBundles(): PilotAliasSkuBundle[] {
  return PILOT_SKUS.map((sku) => buildPilotAliasBundle(sku));
}

function summarizeBundle(
  sku: PilotSkuCode,
  product_name: string,
  product_id: string,
  terms: PilotAliasTermSuggestion[],
): PilotAliasSkuBundle {
  return {
    sku,
    product_id,
    product_name,
    terms,
    summary: {
      total: terms.length,
      suggested: terms.filter((t) => t.review_status === "suggested").length,
      approved: terms.filter((t) => t.review_status === "approved").length,
      rejected: terms.filter((t) => t.review_status === "rejected").length,
      collisions: terms.filter((t) => t.collision.level !== "none").length,
    },
  };
}

export function setTermReviewStatus(
  bundle: PilotAliasSkuBundle,
  termId: string,
  status: PilotReviewStatus,
  notes?: string,
): PilotAliasSkuBundle {
  const terms = bundle.terms.map((t) =>
    t.id === termId
      ? {
          ...t,
          review_status: status,
          review_notes: notes ?? t.review_notes,
        }
      : t,
  );
  return summarizeBundle(bundle.sku, bundle.product_name, bundle.product_id, terms);
}

export function approvedTerms(bundle: PilotAliasSkuBundle): PilotAliasTermSuggestion[] {
  return bundle.terms.filter((t) => t.review_status === "approved");
}
