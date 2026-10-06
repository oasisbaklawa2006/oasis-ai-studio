export type OwnerDataLane = "private_label" | "packaging";

export type OwnerDataQueueItem = {
  productId: string;
  sku: string;
  productName: string;
  lane: OwnerDataLane;
  missing: string[];
  published: boolean;
  mediaApproved: boolean;
  governedB2bPrice: number | null;
  privateLabelPrice: number | null;
  privateLabelMoq: number | null;
  privateLabelMoqUom: string | null;
  legacyB2bPrice: number | null;
  legacyMoq: number | null;
  uom: string | null;
  leadTimeDays: number | null;
};

type ProductCandidate = {
  id: string;
  sku: string;
  product_name: string;
  category: string | null;
  product_type: string | null;
  product_class: string | null;
  is_active: boolean;
  is_catalogue_ready: boolean;
  visible_in_catalog: boolean;
  media_status: string | null;
  private_label_allowed: boolean;
  private_label_moq: number | null;
  private_label_moq_uom: string | null;
  private_label_price: number | null;
  lead_time_days: number | null;
  price_b2b: number | null;
  moq: number | null;
  uom: string | null;
  primary_uom: string | null;
};

type PriceRule = {
  product_id: string;
  price_channel: string;
  approval_status: string;
  base_price: number | null;
  calculated_price: number | null;
  valid_from: string | null;
  valid_until: string | null;
};

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const cleanText = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const bool = (value: unknown): boolean => value === true;

const numberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeProduct = (value: unknown): ProductCandidate | null => {
  const row = record(value);
  if (!row) return null;
  const id = cleanText(row.id);
  const sku = cleanText(row.sku);
  const productName = cleanText(row.product_name);
  if (!id || !sku || !productName) return null;

  return {
    id,
    sku,
    product_name: productName,
    category: cleanText(row.category),
    product_type: cleanText(row.product_type),
    product_class: cleanText(row.product_class),
    is_active: bool(row.is_active),
    is_catalogue_ready: bool(row.is_catalogue_ready),
    visible_in_catalog: bool(row.visible_in_catalog),
    media_status: cleanText(row.media_status),
    private_label_allowed: bool(row.private_label_allowed),
    private_label_moq: numberOrNull(row.private_label_moq),
    private_label_moq_uom: cleanText(row.private_label_moq_uom),
    private_label_price: numberOrNull(row.private_label_price),
    lead_time_days: numberOrNull(row.lead_time_days),
    price_b2b: numberOrNull(row.price_b2b),
    moq: numberOrNull(row.moq),
    uom: cleanText(row.uom),
    primary_uom: cleanText(row.primary_uom),
  };
};

const normalizePriceRule = (value: unknown): PriceRule | null => {
  const row = record(value);
  if (!row) return null;
  const productId = cleanText(row.product_id);
  const priceChannel = cleanText(row.price_channel);
  const approvalStatus = cleanText(row.approval_status);
  if (!productId || !priceChannel || !approvalStatus) return null;

  return {
    product_id: productId,
    price_channel: priceChannel,
    approval_status: approvalStatus,
    base_price: numberOrNull(row.base_price),
    calculated_price: numberOrNull(row.calculated_price),
    valid_from: cleanText(row.valid_from),
    valid_until: cleanText(row.valid_until),
  };
};

const isPackaging = (product: ProductCandidate): boolean => {
  const values = [product.category, product.product_type, product.product_class]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());
  return (
    values.includes("packaging & decoration material") ||
    values.includes("packaging_material")
  );
};

const isActiveApprovedB2bRule = (rule: PriceRule, todayIso: string): boolean => {
  const price = rule.calculated_price ?? rule.base_price;
  return (
    rule.price_channel.toLowerCase() === "b2b" &&
    rule.approval_status.toLowerCase() === "approved" &&
    price !== null &&
    price > 0 &&
    (!rule.valid_from || rule.valid_from <= todayIso) &&
    (!rule.valid_until || rule.valid_until >= todayIso)
  );
};

const published = (product: ProductCandidate): boolean =>
  product.is_active && product.is_catalogue_ready && product.visible_in_catalog;

export function buildOwnerDataCompletionQueue(
  rawProducts: unknown[],
  rawPriceRules: unknown[],
  todayIso: string,
): OwnerDataQueueItem[] {
  const products = rawProducts
    .map(normalizeProduct)
    .filter((product): product is ProductCandidate => product !== null);
  const priceRules = rawPriceRules
    .map(normalizePriceRule)
    .filter((rule): rule is PriceRule => rule !== null);

  const b2bPrices = new Map<string, number>();
  for (const rule of priceRules) {
    if (!isActiveApprovedB2bRule(rule, todayIso)) continue;
    const price = rule.calculated_price ?? rule.base_price;
    if (price !== null) b2bPrices.set(rule.product_id, price);
  }

  const items: OwnerDataQueueItem[] = [];

  for (const product of products) {
    if (!product.is_active) continue;

    const governedB2bPrice = b2bPrices.get(product.id) ?? null;
    const isPublished = published(product);

    if (product.private_label_allowed && isPublished) {
      const missing: string[] = [];
      if (product.private_label_price === null || product.private_label_price <= 0) {
        missing.push("Confirm explicit customer-facing private-label selling price");
      }
      if (product.lead_time_days === null || product.lead_time_days <= 0) {
        missing.push("Provide private-label lead time");
      }

      if (missing.length > 0) {
        items.push({
          productId: product.id,
          sku: product.sku,
          productName: product.product_name,
          lane: "private_label",
          missing,
          published: true,
          mediaApproved: product.media_status?.toLowerCase() === "approved",
          governedB2bPrice,
          privateLabelPrice: product.private_label_price,
          privateLabelMoq: product.private_label_moq,
          privateLabelMoqUom: product.private_label_moq_uom,
          legacyB2bPrice: product.price_b2b,
          legacyMoq: product.moq,
          uom: product.uom ?? product.primary_uom,
          leadTimeDays: product.lead_time_days,
        });
      }
    }

    if (isPackaging(product)) {
      const missing: string[] = [];
      if (!isPublished) missing.push("Confirm Buyer publication and catalogue readiness");
      if (governedB2bPrice === null) missing.push("Approve governed B2B selling price");
      if (product.lead_time_days === null || product.lead_time_days <= 0) {
        missing.push("Provide packaging lead time");
      }

      if (missing.length > 0) {
        items.push({
          productId: product.id,
          sku: product.sku,
          productName: product.product_name,
          lane: "packaging",
          missing,
          published: isPublished,
          mediaApproved: product.media_status?.toLowerCase() === "approved",
          governedB2bPrice,
          privateLabelPrice: null,
          privateLabelMoq: null,
          privateLabelMoqUom: null,
          legacyB2bPrice: product.price_b2b,
          legacyMoq: product.moq,
          uom: product.uom ?? product.primary_uom,
          leadTimeDays: product.lead_time_days,
        });
      }
    }
  }

  return items.sort((left, right) => {
    if (left.lane !== right.lane) return left.lane.localeCompare(right.lane);
    return left.productName.localeCompare(right.productName);
  });
}
