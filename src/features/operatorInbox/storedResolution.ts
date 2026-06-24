import { extractOrderQuantity } from "@/features/productIntelligence/runtime/parseOrderQuantity";
import type {
  ConfidenceBand,
  ProductUtteranceResolution,
  ResolverAction,
  RuntimeAlternative,
} from "@/features/productIntelligence/runtime";

const BAND_DEFAULT_CONFIDENCE: Record<ConfidenceBand, number> = {
  HIGH: 0.9,
  MEDIUM: 0.78,
  LOW: 0.55,
};

function isConfidenceBand(value: unknown): value is ConfidenceBand {
  return value === "HIGH" || value === "MEDIUM" || value === "LOW";
}

function isResolverAction(value: unknown): value is ResolverAction {
  return value === "auto_suggest" || value === "operator_review" || value === "ask_clarification";
}

function parseAlternatives(value: unknown): RuntimeAlternative[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (alt): alt is RuntimeAlternative =>
      !!alt &&
      typeof alt === "object" &&
      typeof (alt as RuntimeAlternative).sku === "string" &&
      typeof (alt as RuntimeAlternative).product_name === "string",
  );
}

function inferAction(
  band: ConfidenceBand,
  resolvedSku: string | null,
  alternatives: RuntimeAlternative[],
): ResolverAction {
  if (band === "LOW" || alternatives.length > 1) return "ask_clarification";
  if (band === "MEDIUM") return "operator_review";
  if (resolvedSku) return "auto_suggest";
  return "ask_clarification";
}

function defaultReason(
  band: ConfidenceBand,
  resolvedSku: string | null,
  resolvedName: string | null,
): string {
  if (resolvedSku && resolvedName) {
    return `Stored resolver match: ${resolvedName} (${resolvedSku}).`;
  }
  if (resolvedSku) {
    return `Stored resolver match for SKU ${resolvedSku}.`;
  }
  if (band === "LOW") {
    return "Stored resolver could not confidently match a single product.";
  }
  return "Stored resolver output from ingest.";
}

/** Hydrate edge/DB partial resolver_result_json into a render-safe resolution. */
export function normalizeStoredResolution(
  value: unknown,
  fallbackQuery: string,
): ProductUtteranceResolution | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (!isConfidenceBand(raw.confidence_band)) return null;

  const query = typeof raw.query === "string" && raw.query.trim() ? raw.query : fallbackQuery.trim();
  if (!query) return null;

  const alternatives = parseAlternatives(raw.alternatives);
  const resolved_sku = typeof raw.resolved_sku === "string" ? raw.resolved_sku : null;
  const resolved_name = typeof raw.resolved_name === "string" ? raw.resolved_name : null;
  const band = raw.confidence_band;

  return {
    query,
    normalized_text:
      typeof raw.normalized_text === "string" ? raw.normalized_text : query.toLowerCase(),
    resolved_product_id:
      typeof raw.resolved_product_id === "string" ? raw.resolved_product_id : null,
    resolved_sku,
    resolved_name,
    confidence:
      typeof raw.confidence === "number"
        ? raw.confidence
        : BAND_DEFAULT_CONFIDENCE[band],
    confidence_band: band,
    action: isResolverAction(raw.action)
      ? raw.action
      : inferAction(band, resolved_sku, alternatives),
    reason:
      typeof raw.reason === "string" && raw.reason.trim()
        ? raw.reason
        : defaultReason(band, resolved_sku, resolved_name),
    clarification_required:
      typeof raw.clarification_required === "boolean"
        ? raw.clarification_required
        : band === "LOW" || alternatives.length > 1,
    alternatives,
    pack_count: typeof raw.pack_count === "number" ? raw.pack_count : null,
    order_quantity:
      typeof raw.order_quantity === "number" ? raw.order_quantity : extractOrderQuantity(query),
  };
}

/** Enough stored data to render ProductSuggestionCard without client re-resolve. */
export function isRenderableStoredResolution(
  resolution: ProductUtteranceResolution | null | undefined,
): resolution is ProductUtteranceResolution {
  if (!resolution) return false;
  return (
    typeof resolution.confidence_band === "string" &&
    (!!resolution.resolved_sku ||
      resolution.alternatives.length > 0 ||
      resolution.clarification_required ||
      resolution.action === "ask_clarification")
  );
}

/** Full resolver output (client/edge) — skip re-resolve. */
export function isCompleteResolution(
  resolution: ProductUtteranceResolution | null | undefined,
): resolution is ProductUtteranceResolution {
  if (!resolution) return false;
  return (
    typeof resolution.query === "string" &&
    typeof resolution.confidence_band === "string" &&
    typeof resolution.confidence === "number" &&
    typeof resolution.reason === "string" &&
    typeof resolution.action === "string" &&
    Array.isArray(resolution.alternatives)
  );
}

/** Has ingest metadata but not enough to render — eligible for one client re-resolve. */
export function isPartialStoredResolution(
  resolution: ProductUtteranceResolution | null | undefined,
): boolean {
  return !!resolution && !isRenderableStoredResolution(resolution);
}
