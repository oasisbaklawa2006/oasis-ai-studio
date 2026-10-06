export type BuyerBackendReadiness = {
  published_product_count: number;
  approved_b2b_price_rule_count: number;
  b2b_priced_published_product_count: number;
  published_private_label_count: number;
  private_label_price_ready_count: number;
  published_packaging_count: number;
  packaging_price_ready_count: number;
  connect_profile_count: number;
  active_connect_consumer_count: number;
  active_connect_binding_count: number;
  active_connect_token_count: number;
};

export type ReadinessStatus = "ready" | "partial" | "blocked";

export type BuyerReadinessCard = {
  key: "catalogue" | "pricing" | "private_label" | "packaging" | "connect";
  label: string;
  value: string;
  status: ReadinessStatus;
  detail: string;
};

const finiteCount = (value: unknown): number => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
};

export const normalizeBuyerBackendReadiness = (value: unknown): BuyerBackendReadiness | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const required = [
    "published_product_count",
    "approved_b2b_price_rule_count",
    "b2b_priced_published_product_count",
    "published_private_label_count",
    "private_label_price_ready_count",
    "published_packaging_count",
    "packaging_price_ready_count",
    "connect_profile_count",
    "active_connect_consumer_count",
    "active_connect_binding_count",
    "active_connect_token_count",
  ] as const;

  if (!required.every((key) => row[key] !== undefined && row[key] !== null)) return null;

  return Object.fromEntries(
    required.map((key) => [key, finiteCount(row[key])]),
  ) as BuyerBackendReadiness;
};

const coverageStatus = (covered: number, total: number): ReadinessStatus => {
  if (total <= 0 || covered <= 0) return "blocked";
  return covered >= total ? "ready" : "partial";
};

export const buildBuyerReadinessCards = (row: BuyerBackendReadiness): BuyerReadinessCard[] => {
  const connectReady =
    row.active_connect_consumer_count > 0 &&
    row.active_connect_binding_count > 0 &&
    row.active_connect_token_count > 0;
  const connectStarted =
    row.connect_profile_count > 0 ||
    row.active_connect_consumer_count > 0 ||
    row.active_connect_binding_count > 0 ||
    row.active_connect_token_count > 0;

  return [
    {
      key: "catalogue",
      label: "Published Buyer catalogue",
      value: String(row.published_product_count),
      status: row.published_product_count > 0 ? "ready" : "blocked",
      detail:
        row.published_product_count > 0
          ? `${row.published_product_count} product(s) pass the governed publication gate.`
          : "No product currently passes the governed publication gate.",
    },
    {
      key: "pricing",
      label: "B2B commercial coverage",
      value: `${row.b2b_priced_published_product_count}/${row.published_product_count}`,
      status: coverageStatus(row.b2b_priced_published_product_count, row.published_product_count),
      detail: `${row.approved_b2b_price_rule_count} approved active B2B price rule(s); ${row.b2b_priced_published_product_count} published product(s) have governed price coverage.`,
    },
    {
      key: "private_label",
      label: "Private-label readiness",
      value: `${row.private_label_price_ready_count}/${row.published_private_label_count}`,
      status: coverageStatus(
        row.private_label_price_ready_count,
        row.published_private_label_count,
      ),
      detail:
        row.published_private_label_count > 0
          ? `${row.published_private_label_count} published private-label product(s); ${row.private_label_price_ready_count} have an explicit customer-facing private-label price.`
          : "No published product is currently enabled for private label.",
    },
    {
      key: "packaging",
      label: "Packaging offers",
      value: `${row.packaging_price_ready_count}/${row.published_packaging_count}`,
      status: coverageStatus(row.packaging_price_ready_count, row.published_packaging_count),
      detail:
        row.published_packaging_count > 0
          ? `${row.published_packaging_count} published packaging offer(s); ${row.packaging_price_ready_count} have governed B2B price coverage.`
          : "No packaging/decoration product currently passes the publication gate.",
    },
    {
      key: "connect",
      label: "Oasis Connect activation",
      value: `${row.active_connect_consumer_count} consumer(s)`,
      status: connectReady ? "ready" : connectStarted ? "partial" : "blocked",
      detail: `${row.connect_profile_count} profile(s), ${row.active_connect_consumer_count} active consumer(s), ${row.active_connect_binding_count} active binding(s), ${row.active_connect_token_count} active token(s).`,
    },
  ];
};
