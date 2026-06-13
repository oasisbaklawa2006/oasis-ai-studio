import type { ChannelPriceRecord } from "./types";
import type { PricingRuleRow } from "./channelAuthorityMappers";

/** Governed buyer-facing pricing ladder (costing excluded — internal only). */
export const PRICING_LADDER_CHANNELS = [
  "mrp",
  "retail",
  "bulk",
  "wholesale",
  "horeca",
  "b2b",
  "export",
  "franchisee",
  "own_outlet",
  "special",
] as const;

export type PricingLadderChannel = (typeof PRICING_LADDER_CHANNELS)[number];

/** Internal-only — never shown in buyer-facing Product Truth. */
export const INTERNAL_PRICING_CHANNELS = ["costing"] as const;

export type PriceAuthoritySource = "manual" | "derived" | "inherited" | "missing";

export type EffectiveChannelPrice = {
  channel: string;
  label: string;
  manualPrice: number | null;
  effectivePrice: number | null;
  source: PriceAuthoritySource;
  sourceDetail: string | null;
  currency: string;
  uom: string | null;
  priceStatus: ChannelPriceRecord["priceStatus"];
  isRequired: boolean;
  isInternalOnly: boolean;
  blocksPublish: boolean;
};

const CHANNEL_LABELS: Record<string, string> = {
  mrp: "MRP",
  retail: "Retail",
  bulk: "Bulk",
  wholesale: "Wholesale",
  horeca: "HoReCa",
  b2b: "B2B",
  export: "Export",
  franchisee: "Franchisee",
  own_outlet: "Own Outlet",
  special: "Special",
  special_customer: "Special",
  costing: "Costing",
};

/** Normalize DB channel names to ladder keys. */
export function normalizePricingChannel(channel: string): string {
  const key = channel.trim().toLowerCase();
  if (key === "franchise") return "franchisee";
  if (key === "special_customer" || key === "promotional") return "special";
  if (key === "distributor") return "wholesale";
  return key;
}

function roundPrice(value: number): number {
  return Math.round(value * 100) / 100;
}

function manualPriceFromRow(row: PricingRuleRow | undefined): number | null {
  if (!row) return null;
  const calculated = row.calculated_price;
  const base = row.base_price;
  if (calculated != null && Number.isFinite(Number(calculated))) return Number(calculated);
  if (base != null && Number.isFinite(Number(base))) return Number(base);
  return null;
}

function manualPriceFromRecord(record: ChannelPriceRecord | undefined): number | null {
  if (!record) return null;
  const ch = normalizePricingChannel(String(record.channel));
  if (ch === "mrp") return record.mrp ?? record.sellingPrice ?? null;
  return record.sellingPrice ?? record.mrp ?? null;
}

function buildManualMap(
  rows: PricingRuleRow[],
  records: ChannelPriceRecord[],
): Map<string, { price: number | null; row?: PricingRuleRow; record?: ChannelPriceRecord }> {
  const map = new Map<string, { price: number | null; row?: PricingRuleRow; record?: ChannelPriceRecord }>();

  for (const row of rows) {
    const ch = normalizePricingChannel(String(row.price_channel ?? ""));
    if (!ch) continue;
    const price = manualPriceFromRow(row);
    map.set(ch, { price, row, record: undefined });
  }

  for (const record of records) {
    const ch = normalizePricingChannel(String(record.channel));
    if (!ch) continue;
    const existing = map.get(ch);
    const price = manualPriceFromRecord(record);
    if (!existing) {
      map.set(ch, { price, record });
    } else if (existing.price == null && price != null) {
      map.set(ch, { ...existing, price, record });
    } else if (!existing.record) {
      map.set(ch, { ...existing, record });
    }
  }

  return map;
}

type SlotInput = {
  channel: string;
  manual: number | null;
  effective: number | null;
  source: PriceAuthoritySource;
  sourceDetail: string | null;
  isRequired?: boolean;
};

function slot(
  channel: string,
  manual: number | null,
  effective: number | null,
  source: PriceAuthoritySource,
  sourceDetail: string | null,
  isRequired = false,
): SlotInput {
  return { channel, manual, effective, source, sourceDetail, isRequired };
}

/**
 * Computes effective prices per governed ladder.
 * Manual DB values always win; derived values are never written back.
 */
export function computePricingLadder(input: {
  pricingRows?: PricingRuleRow[];
  priceRecords?: ChannelPriceRecord[];
}): EffectiveChannelPrice[] {
  const rows = input.pricingRows ?? [];
  const records = input.priceRecords ?? [];
  const manualMap = buildManualMap(rows, records);

  const getManual = (ch: string): number | null => manualMap.get(ch)?.price ?? null;
  const meta = (ch: string) => manualMap.get(ch);

  const mrpManual = getManual("mrp");
  const retailManual = getManual("retail");
  const bulkManual = getManual("bulk");
  const wholesaleManual = getManual("wholesale");
  const horecaManual = getManual("horeca");
  const b2bManual = getManual("b2b");
  const exportManual = getManual("export");
  const franchiseeManual = getManual("franchisee");
  const ownOutletManual = getManual("own_outlet");
  const specialManual = getManual("special");

  const mrpEffective = mrpManual;
  const retailEffective = retailManual ?? mrpEffective;
  const bulkEffective =
    bulkManual ?? (mrpEffective != null ? roundPrice(mrpEffective * 0.8) : null);
  const wholesaleEffective =
    wholesaleManual ?? (mrpEffective != null ? roundPrice(mrpEffective * 0.7) : null);
  const horecaEffective = horecaManual ?? wholesaleEffective;
  const b2bEffective = b2bManual;
  const exportEffective = exportManual ?? b2bEffective;
  const franchiseeEffective = franchiseeManual ?? b2bEffective;
  const ownOutletEffective = ownOutletManual ?? b2bEffective;
  const specialEffective = specialManual ?? b2bEffective;

  const slots: SlotInput[] = [
    slot(
      "mrp",
      mrpManual,
      mrpEffective,
      mrpManual != null ? "manual" : "missing",
      mrpManual != null ? "Manual MRP" : "MRP not set",
    ),
    slot(
      "retail",
      retailManual,
      retailEffective,
      retailManual != null ? "manual" : retailEffective != null ? "inherited" : "missing",
      retailManual != null ? "Manual retail" : retailEffective != null ? "Inherited from MRP" : null,
    ),
    slot(
      "bulk",
      bulkManual,
      bulkEffective,
      bulkManual != null ? "manual" : bulkEffective != null ? "derived" : "missing",
      bulkManual != null ? "Manual bulk" : bulkEffective != null ? "Derived: MRP −20%" : null,
    ),
    slot(
      "wholesale",
      wholesaleManual,
      wholesaleEffective,
      wholesaleManual != null ? "manual" : wholesaleEffective != null ? "derived" : "missing",
      wholesaleManual != null ? "Manual wholesale" : wholesaleEffective != null ? "Derived: MRP −30%" : null,
    ),
    slot(
      "horeca",
      horecaManual,
      horecaEffective,
      horecaManual != null ? "manual" : horecaEffective != null ? "inherited" : "missing",
      horecaManual != null ? "Manual HoReCa" : horecaEffective != null ? "Inherited from Wholesale" : null,
    ),
    slot(
      "b2b",
      b2bManual,
      b2bEffective,
      b2bManual != null ? "manual" : "missing",
      b2bManual != null ? "Manual B2B (required)" : "B2B price is required before product can be approved",
      true,
    ),
    slot(
      "export",
      exportManual,
      exportEffective,
      exportManual != null ? "manual" : exportEffective != null ? "inherited" : "missing",
      exportManual != null ? "Manual export" : exportEffective != null ? "Inherited from B2B" : null,
    ),
    slot(
      "franchisee",
      franchiseeManual,
      franchiseeEffective,
      franchiseeManual != null ? "manual" : franchiseeEffective != null ? "inherited" : "missing",
      franchiseeManual != null ? "Manual franchisee" : franchiseeEffective != null ? "Inherited from B2B" : null,
    ),
    slot(
      "own_outlet",
      ownOutletManual,
      ownOutletEffective,
      ownOutletManual != null ? "manual" : ownOutletEffective != null ? "inherited" : "missing",
      ownOutletManual != null ? "Manual own outlet" : ownOutletEffective != null ? "Inherited from B2B" : null,
    ),
    slot(
      "special",
      specialManual,
      specialEffective,
      specialManual != null ? "manual" : specialEffective != null ? "inherited" : "missing",
      specialManual != null ? "Manual special" : specialEffective != null ? "Inherited from B2B" : null,
    ),
  ];

  return slots.map((s) => {
    const m = meta(s.channel);
    const row = m?.row;
    const record = m?.record;
    const status = record?.priceStatus ?? "draft";
    const blocks =
      s.channel === "b2b"
        ? s.effective == null
        : status === "draft" || status === "pending_approval";

    return {
      channel: s.channel,
      label: CHANNEL_LABELS[s.channel] ?? s.channel,
      manualPrice: s.manual,
      effectivePrice: s.effective,
      source: s.source,
      sourceDetail: s.sourceDetail,
      currency: row?.currency ?? record?.currency ?? "INR",
      uom: row?.uom ? String(row.uom) : null,
      priceStatus: status,
      isRequired: !!s.isRequired,
      isInternalOnly: false,
      blocksPublish: blocks,
    };
  });
}

export function b2bPriceMissing(ladder: EffectiveChannelPrice[]): boolean {
  const b2b = ladder.find((r) => r.channel === "b2b");
  return b2b?.effectivePrice == null;
}

export function formatPriceSource(source: PriceAuthoritySource): string {
  switch (source) {
    case "manual":
      return "manual";
    case "derived":
      return "derived";
    case "inherited":
      return "inherited";
    default:
      return "missing";
  }
}
