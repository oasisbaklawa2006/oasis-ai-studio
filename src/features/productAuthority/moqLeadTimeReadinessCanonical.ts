/**
 * Point 36 — MOQ / lead-time / publication-readiness canonical authority.
 *
 * Ownership:
 * - Product MOQ scalars: Core `products` row (`moq_*`, `increment_*`, private-label MOQ, carton logic)
 * - Channel MOQ: Core `product_moq_rules` (governed separately; seed/approval in Central)
 * - Product lead time: Core `products.lead_time_days` (live @ Core #209 / release run 34027390507)
 * - BOM lead time: `product_bom_items.lead_time_days` — component-only; never substitutes product row
 * - Catalogue publication flag: `products.is_catalogue_ready` gated by `evaluateCatalogueReadyGate`
 *
 * Point 35 dimensions/CBM/grams are out of scope — referenced only, never computed here.
 */
import type { ChannelMoqRule } from "@/features/productTruth/types";
import { getSaleTypeRequirements, type SaleType } from "./saleType";

/** Core #209 @ `5066064` — production-live product dispatch lead time (days). */
export const POINT_36_LIVE_PRODUCT_LEAD_TIME_COLUMN = "products.lead_time_days";

export type MoqRuleType =
  | "not_applicable"
  | "fixed_min"
  | "carton_based"
  | "master_carton_based"
  | "private_label"
  | "quotation"
  | (string & {});

export type MoqAuthorityState = "complete" | "deferred" | "missing" | "invalid";

export type LeadTimeAuthorityState =
  | "deferred"
  | "product_stored"
  | "bom_component_only"
  | "not_applicable"
  | "invalid";

export interface ProductMoqInput {
  moq_rule_type?: string | null;
  moq_value?: number | null;
  moq_uom?: string | null;
  moq_text?: string | null;
  increment_value?: number | null;
  increment_uom?: string | null;
  fixed_carton_required?: boolean | null;
  carton_qty?: number | null;
  carton_uom?: string | null;
  master_carton_qty?: number | null;
  master_carton_uom?: string | null;
  private_label_allowed?: boolean | null;
  private_label_moq?: number | null;
  private_label_moq_uom?: string | null;
}

export interface MoqAuthorityResult {
  state: MoqAuthorityState;
  ruleType: string | null;
  summary: string | null;
  /** Hard blockers for catalogue-ready / publication — fail-closed. */
  publicationBlockers: string[];
  warnings: string[];
}

export interface LeadTimeAuthorityResult {
  persistence: "products_row" | "bom_only";
  state: LeadTimeAuthorityState;
  productDays: number | null;
  bomMaxDays: number | null;
  publicationBlockers: string[];
}

export type Point36FulfillmentReadinessSnapshot = {
  schema: "point36_v1";
  moq: {
    state: MoqAuthorityState;
    rule_type: string | null;
    summary: string | null;
    publication_blockers: string[];
  };
  lead_time: {
    persistence: "products_row" | "bom_only";
    state: LeadTimeAuthorityState;
    product_days: number | null;
    bom_max_days: number | null;
  };
};

function normalizeRuleType(raw: unknown): string | null {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  return s || null;
}

function positiveNum(v: unknown): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function hasText(v: unknown): boolean {
  return String(v ?? "").trim().length > 0;
}

function moqRequiresStructuredValue(ruleType: string | null): boolean {
  return (
    ruleType === "fixed_min" || ruleType === "carton_based" || ruleType === "master_carton_based"
  );
}

function moqExemptFromNumeric(ruleType: string | null): boolean {
  return ruleType === "not_applicable" || ruleType === "quotation";
}

/**
 * Deterministic product-row MOQ authority — channel rules are validated separately via
 * `channelMoqPublicationBlockers`.
 */
export function evaluateProductMoqAuthority(
  input: ProductMoqInput,
  saleType: SaleType,
): MoqAuthorityResult {
  const req = getSaleTypeRequirements(saleType);
  const ruleType = normalizeRuleType(input.moq_rule_type);
  const publicationBlockers: string[] = [];
  const warnings: string[] = [];

  if (!req.customerFacing) {
    return {
      state: "deferred",
      ruleType,
      summary: "MOQ not required for internal products",
      publicationBlockers: [],
      warnings: [],
    };
  }

  if (moqExemptFromNumeric(ruleType)) {
    if (positiveNum(input.moq_value) && ruleType === "not_applicable") {
      warnings.push("MOQ value present but rule type is not applicable — stale scalar ignored");
    }
    const summary = ruleType === "quotation" ? "MOQ: quotation only" : "MOQ: not applicable";
    return { state: "complete", ruleType, summary, publicationBlockers, warnings };
  }

  if (
    ruleType === "private_label" ||
    (input.private_label_allowed && ruleType === "private_label")
  ) {
    const plMoq = positiveNum(input.private_label_moq);
    const plUom = hasText(input.private_label_moq_uom);
    if (!plMoq || !plUom) {
      if (req.requiresMoqCartonLogic) {
        publicationBlockers.push("Private label MOQ and UOM required");
      }
      return {
        state: req.requiresMoqCartonLogic ? "missing" : "invalid",
        ruleType,
        summary: null,
        publicationBlockers,
        warnings,
      };
    }
    return {
      state: "complete",
      ruleType,
      summary: `MOQ: ${input.private_label_moq} ${input.private_label_moq_uom} (private label)`,
      publicationBlockers,
      warnings,
    };
  }

  if (input.private_label_allowed) {
    const plMoq = positiveNum(input.private_label_moq);
    const plUom = hasText(input.private_label_moq_uom);
    if (!plMoq || !plUom) {
      publicationBlockers.push("Private label MOQ and UOM required");
    }
  }

  if (
    ruleType === "carton_based" ||
    ruleType === "master_carton_based" ||
    input.fixed_carton_required
  ) {
    const cartonQty =
      ruleType === "master_carton_based"
        ? positiveNum(input.master_carton_qty)
        : positiveNum(input.carton_qty);
    if (!cartonQty) {
      if (req.requiresMoqCartonLogic) {
        publicationBlockers.push(
          ruleType === "master_carton_based"
            ? "Master carton quantity required for MOQ"
            : "Carton quantity required for MOQ",
        );
      }
      return {
        state: req.requiresMoqCartonLogic ? "missing" : "invalid",
        ruleType,
        summary: null,
        publicationBlockers,
        warnings,
      };
    }
    const uomLabel =
      ruleType === "master_carton_based"
        ? String(input.master_carton_uom ?? "master_carton")
        : String(input.carton_uom ?? "carton");
    return {
      state: "complete",
      ruleType,
      summary: `MOQ: closed ${cartonQty} ${uomLabel}`,
      publicationBlockers,
      warnings,
    };
  }

  if (moqRequiresStructuredValue(ruleType) || req.requiresMoqCartonLogic) {
    const moqValue = positiveNum(input.moq_value);
    const moqUom = hasText(input.moq_uom);

    if (!moqValue && !hasText(input.moq_text)) {
      if (req.requiresMoqCartonLogic) {
        publicationBlockers.push("MOQ value and UOM required");
      }
      return {
        state: req.requiresMoqCartonLogic ? "missing" : "missing",
        ruleType,
        summary: null,
        publicationBlockers,
        warnings,
      };
    }

    if (moqValue && !moqUom) {
      publicationBlockers.push("MOQ UOM required when MOQ value is set");
      return {
        state: "invalid",
        ruleType,
        summary: `MOQ: ${moqValue} (UOM missing — invalid)`,
        publicationBlockers,
        warnings,
      };
    }

    if (!moqValue && hasText(input.moq_text) && req.requiresMoqCartonLogic) {
      warnings.push("Legacy MOQ note only — structured MOQ value/UOM required for B2B publication");
      publicationBlockers.push("Structured MOQ value and UOM required (legacy note insufficient)");
      return {
        state: "invalid",
        ruleType,
        summary: `MOQ note: ${input.moq_text}`,
        publicationBlockers,
        warnings,
      };
    }

    if (moqValue && moqUom) {
      const inc = positiveNum(input.increment_value);
      const incUom = hasText(input.increment_uom);
      if (inc && !incUom) {
        publicationBlockers.push("Increment UOM required when increment value is set");
        return {
          state: "invalid",
          ruleType,
          summary: `MOQ: ${moqValue} ${input.moq_uom}`,
          publicationBlockers,
          warnings,
        };
      }
      if (
        incUom &&
        moqUom &&
        inc &&
        String(input.increment_uom).trim().toLowerCase() !==
          String(input.moq_uom).trim().toLowerCase()
      ) {
        warnings.push("MOQ UOM and increment UOM differ — confirm conversion is intentional");
      }
      return {
        state: "complete",
        ruleType,
        summary: `MOQ: ${moqValue} ${input.moq_uom}`,
        publicationBlockers,
        warnings,
      };
    }
  }

  if (hasText(input.moq_text) || positiveNum(input.moq_value)) {
    const summary = hasText(input.moq_text)
      ? `MOQ: ${input.moq_text}`
      : `MOQ: ${input.moq_value}${hasText(input.moq_uom) ? ` ${input.moq_uom}` : ""}`;
    return {
      state: req.requiresMoqCartonLogic ? "invalid" : "complete",
      ruleType,
      summary,
      publicationBlockers,
      warnings,
    };
  }

  if (req.requiresMoqCartonLogic) {
    publicationBlockers.push("MOQ rule type and value required");
  }

  return {
    state: req.requiresMoqCartonLogic ? "missing" : "deferred",
    ruleType,
    summary: null,
    publicationBlockers,
    warnings,
  };
}

const CHANNEL_MOQ_GAP_TARGETS = ["retail", "b2b"] as const;

/**
 * Channel MOQ gaps block publication when pricing exists without a matching rule.
 */
export function channelMoqPublicationBlockers(
  channelMoqRules: ChannelMoqRule[],
  pricedChannels: string[],
): string[] {
  const blockers: string[] = [];
  const normalizedPriced = new Set(pricedChannels.map((c) => c.toLowerCase()));
  const ruleChannels = new Set(
    channelMoqRules.filter((r) => r.channel).map((r) => String(r.channel).toLowerCase()),
  );

  for (const ch of CHANNEL_MOQ_GAP_TARGETS) {
    if (normalizedPriced.has(ch) && !ruleChannels.has(ch)) {
      blockers.push(`Channel MOQ missing for ${ch}`);
    }
  }
  return blockers;
}

/**
 * Product lead time binds to live `products.lead_time_days`. BOM `lead_time_days` is
 * component-only metadata — it never substitutes for a missing product-row value.
 */
export function evaluateLeadTimeAuthority(
  saleType: SaleType,
  opts?: {
    productLeadTimeDays?: number | null;
    bomMaxLeadTimeDays?: number | null;
  },
): LeadTimeAuthorityResult {
  const req = getSaleTypeRequirements(saleType);
  const rawProduct = opts?.productLeadTimeDays;
  const productDays = positiveNum(rawProduct);
  const bomMax = positiveNum(opts?.bomMaxLeadTimeDays);

  if (!req.customerFacing) {
    return {
      persistence: "products_row",
      state: "not_applicable",
      productDays: null,
      bomMaxDays: null,
      publicationBlockers: [],
    };
  }

  if (rawProduct != null && rawProduct !== "" && productDays == null) {
    return {
      persistence: "products_row",
      state: "invalid",
      productDays: null,
      bomMaxDays: bomMax,
      publicationBlockers: ["Lead time (days) must be a positive integer"],
    };
  }

  if (productDays != null) {
    return {
      persistence: "products_row",
      state: "product_stored",
      productDays,
      bomMaxDays: bomMax,
      publicationBlockers: [],
    };
  }

  const publicationBlockers: string[] = [];
  if (req.requiresExportFields) {
    publicationBlockers.push("Lead time (days) required for export products");
  }

  return {
    persistence: "products_row",
    state: bomMax != null ? "bom_component_only" : "deferred",
    productDays: null,
    bomMaxDays: bomMax,
    publicationBlockers,
  };
}

export function serializePoint36FulfillmentReadiness(
  moq: MoqAuthorityResult,
  leadTime: LeadTimeAuthorityResult,
): Point36FulfillmentReadinessSnapshot {
  return {
    schema: "point36_v1",
    moq: {
      state: moq.state,
      rule_type: moq.ruleType,
      summary: moq.summary,
      publication_blockers: moq.publicationBlockers,
    },
    lead_time: {
      persistence: leadTime.persistence,
      state: leadTime.state,
      product_days: leadTime.productDays,
      bom_max_days: leadTime.bomMaxDays,
    },
  };
}

export interface PublicationReadinessInput {
  saleType: SaleType;
  moq: ProductMoqInput;
  channelMoqRules?: ChannelMoqRule[];
  pricedChannels?: string[];
  productLeadTimeDays?: number | null;
  bomMaxLeadTimeDays?: number | null;
}

export function evaluatePublicationReadiness(input: PublicationReadinessInput): {
  moq: MoqAuthorityResult;
  leadTime: LeadTimeAuthorityResult;
  publicationBlockers: string[];
  snapshot: Point36FulfillmentReadinessSnapshot;
} {
  const moq = evaluateProductMoqAuthority(input.moq, input.saleType);
  const leadTime = evaluateLeadTimeAuthority(input.saleType, {
    productLeadTimeDays: input.productLeadTimeDays ?? null,
    bomMaxLeadTimeDays: input.bomMaxLeadTimeDays ?? null,
  });
  const channelBlockers = channelMoqPublicationBlockers(
    input.channelMoqRules ?? [],
    input.pricedChannels ?? [],
  );
  const publicationBlockers = Array.from(
    new Set([...moq.publicationBlockers, ...channelBlockers, ...leadTime.publicationBlockers]),
  );

  return {
    moq,
    leadTime,
    publicationBlockers,
    snapshot: serializePoint36FulfillmentReadiness(moq, leadTime),
  };
}
